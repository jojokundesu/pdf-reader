/** Find the audible paper gesture without changing the supplied MP3 bytes. */
export function analyzePageTurnBuffer(buffer) {
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, i) =>
    buffer.getChannelData(i),
  );
  let peak = 0;
  for (const data of channels)
    for (let i = 0; i < data.length; i++)
      peak = Math.max(peak, Math.abs(data[i]));
  if (!Number.isFinite(peak) || peak < 0.00001)
    throw new Error("The page-turn recording is silent.");
  const threshold = peak * 0.06;
  let first = buffer.length,
    last = -1;
  for (const data of channels) {
    for (let i = 0; i < data.length; i++) {
      if (Math.abs(data[i]) >= threshold) {
        first = Math.min(first, i);
        last = Math.max(last, i);
      }
    }
  }
  const offset = Math.max(0, first / buffer.sampleRate - 0.03);
  const end = Math.min(buffer.duration, (last + 1) / buffer.sampleRate + 0.08);
  return {
    offset,
    duration: end - offset,
    gain: Math.min(4, 0.28 / peak),
    peak,
  };
}

/** One decoded buffer and at most two voices (the current turn plus a fading tail). */
export class PageTurnAudio {
  constructor({
    url,
    fetcher = (...args) => fetch(...args),
    createContext = () => {
      const Context = globalThis.AudioContext || globalThis.webkitAudioContext;
      return Context ? new Context({ latencyHint: "interactive" }) : null;
    },
    now = () => performance.now(),
    onError = () => {},
  }) {
    this.url = url;
    this.fetcher = fetcher;
    this.createContext = createContext;
    this.now = now;
    this.onError = onError;
    this.context = null;
    this.bytesPromise = null;
    this.decodePromise = null;
    this.resumePromise = null;
    this.buffer = null;
    this.clip = null;
    this.voices = new Set();
    this.muted = false;
    this.backgrounded = false;
    this.request = 0;
    this.reportedError = false;
  }

  report(error) {
    if (!this.reportedError) {
      this.reportedError = true;
      this.onError(error);
    }
  }

  preload() {
    if (!this.bytesPromise) {
      this.bytesPromise = Promise.resolve()
        .then(() => this.fetcher(this.url))
        .then((response) => {
          if (!response.ok)
            throw new Error("Cannot load the bundled page-turn MP3.");
          return response.arrayBuffer();
        })
        .catch((error) => {
          this.bytesPromise = null;
          this.report(error);
          return null;
        });
    }
    return this.bytesPromise;
  }

  prepare() {
    if (this.buffer) return Promise.resolve(this.buffer);
    if (!this.context) return Promise.resolve(null);
    if (!this.decodePromise) {
      this.decodePromise = this.preload()
        .then(async (bytes) => {
          if (!bytes) return null;
          // decodeAudioData may detach its argument. Keep the fetched bytes for a retry.
          const buffer = await this.context.decodeAudioData(bytes.slice(0));
          this.clip = analyzePageTurnBuffer(buffer);
          this.buffer = buffer;
          this.reportedError = false;
          return buffer;
        })
        .catch((error) => {
          this.report(error);
          return null;
        })
        .finally(() => {
          this.decodePromise = null;
        });
    }
    return this.decodePromise;
  }

  // Called synchronously inside trusted pointer/key handlers, before any PDF awaits.
  unlock() {
    if (this.muted || this.backgrounded) return Promise.resolve(false);
    try {
      if (!this.context || this.context.state === "closed") {
        this.context = this.createContext();
        this.buffer = null;
        this.clip = null;
      }
      if (!this.context)
        throw new Error("This browser does not support page audio.");
      if (this.context.state !== "running" && !this.resumePromise) {
        this.resumePromise = this.context
          .resume()
          .catch((error) => {
            this.report(error);
          })
          .finally(() => {
            this.resumePromise = null;
          });
      }
      const resumed = this.resumePromise || Promise.resolve();
      return Promise.all([this.prepare(), resumed]).then(
        ([buffer]) => !!buffer && this.context.state === "running",
      );
    } catch (error) {
      this.report(error);
      return Promise.resolve(false);
    }
  }

  cleanVoice(voice) {
    this.voices.delete(voice);
    voice.source.onended = null;
    voice.source.disconnect();
    voice.gain.disconnect();
  }

  fadeVoice(voice, seconds = 0.025) {
    if (voice.stopping) return;
    voice.stopping = true;
    const time = this.context.currentTime;
    const param = voice.gain.gain;
    if (typeof param.cancelAndHoldAtTime === "function")
      param.cancelAndHoldAtTime(time);
    else {
      param.cancelScheduledValues(time);
      param.setValueAtTime(param.value, time);
    }
    param.linearRampToValueAtTime(0, time + seconds);
    voice.source.stop(time + seconds);
  }

  stop() {
    this.request++;
    for (const voice of this.voices) this.fadeVoice(voice, 0.012);
  }

  setMuted(muted) {
    this.muted = !!muted;
    if (this.muted) this.stop();
  }

  setBackgrounded(hidden) {
    this.backgrounded = !!hidden;
    if (this.backgrounded) this.stop();
    // Foregrounding never replays a queued or interrupted page sound.
  }

  async play() {
    if (this.muted || this.backgrounded || !this.context) return false;
    const request = ++this.request,
      started = this.now();
    try {
      // Context creation happens only in a trusted gesture handler. Allow its
      // decode/resume a short head start, never a long or stale playback queue.
      if (!this.buffer || this.context.state !== "running") {
        let timer;
        try {
          await Promise.race([
            Promise.all([
              this.prepare(),
              this.resumePromise || Promise.resolve(),
            ]),
            new Promise((resolve) => {
              timer = setTimeout(resolve, 180);
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
      }
      if (
        request !== this.request ||
        this.muted ||
        this.backgrounded ||
        this.now() - started > 200 ||
        !this.buffer ||
        this.context.state !== "running"
      )
        return false;
      // Avoid a pile-up on quick page navigation; keep only one short fading tail.
      for (const voice of [...this.voices]) {
        if (voice.stopping) {
          voice.source.stop();
          this.cleanVoice(voice);
        } else this.fadeVoice(voice);
      }
      const source = this.context.createBufferSource(),
        gain = this.context.createGain();
      source.buffer = this.buffer;
      source.playbackRate.value = 1; // Preserve the recording's pitch and paper texture.
      const time = this.context.currentTime,
        { offset, duration, gain: level } = this.clip;
      const fadeIn = Math.min(0.006, duration / 4),
        fadeOut = Math.min(0.045, duration / 4);
      gain.gain.setValueAtTime(0, time);
      gain.gain.linearRampToValueAtTime(level, time + fadeIn);
      gain.gain.setValueAtTime(level, time + duration - fadeOut);
      gain.gain.linearRampToValueAtTime(0, time + duration);
      source.connect(gain).connect(this.context.destination);
      const voice = { source, gain, stopping: false };
      this.voices.add(voice);
      source.onended = () => this.cleanVoice(voice);
      source.start(time, offset, duration);
      return true;
    } catch (error) {
      this.report(error);
      return false;
    }
  }
}
