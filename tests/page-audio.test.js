import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { PageTurnAudio, analyzePageTurnBuffer } from "../src/page-audio.js";
function fixture() {
  const channels = [new Float32Array(2000), new Float32Array(2000)];
  channels[0][600] = 0.5;
  channels[1][1200] = 0.4;
  return {
    numberOfChannels: 2,
    length: 2000,
    sampleRate: 1000,
    duration: 2,
    getChannelData: (i) => channels[i],
  };
}
class Param {
  constructor() {
    this.value = 0;
    this.events = [];
  }
  setValueAtTime(v, t) {
    this.events.push(["set", v, t]);
    this.value = v;
  }
  linearRampToValueAtTime(v, t) {
    this.events.push(["ramp", v, t]);
  }
  cancelAndHoldAtTime(t) {
    this.events.push(["hold", t]);
  }
}
class Source {
  constructor() {
    this.playbackRate = { value: 0 };
    this.stops = [];
  }
  connect(node) {
    return node;
  }
  disconnect() {
    this.disconnected = true;
  }
  start(...args) {
    this.started = args;
  }
  stop(...args) {
    this.stops.push(args);
  }
}
class Context {
  constructor() {
    this.state = "suspended";
    this.currentTime = 0;
    this.sources = [];
    this.decodes = 0;
    this.destination = {};
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  decodeAudioData() {
    this.decodes++;
    return this.decoded ? this.decoded : Promise.resolve(fixture());
  }
  createBufferSource() {
    const s = new Source();
    this.sources.push(s);
    return s;
  }
  createGain() {
    return { gain: new Param(), connect: (n) => n, disconnect() {} };
  }
}
function setup(options = {}) {
  const context = new Context();
  let fetches = 0,
    clock = 0;
  const errors = [];
  const audio = new PageTurnAudio({
    url: "/sample.mp3",
    createContext: () => context,
    fetcher: async () => {
      fetches++;
      return { ok: true, arrayBuffer: async () => new ArrayBuffer(16) };
    },
    now: () => clock,
    onError: (e) => errors.push(e),
    ...options,
  });
  return {
    audio,
    context,
    errors,
    setClock: (n) => (clock = n),
    fetches: () => fetches,
  };
}
test("bundled MP3 is byte-for-byte the user-provided Base64 decode", () => {
  const bytes = readFileSync(
    new URL("../src/assets/page-turn.mp3", import.meta.url),
  );
  assert.equal(bytes.length, 83591);
  assert.equal(
    createHash("sha256").update(bytes).digest("hex"),
    "543118ab2c6c9268b0ab0070ebdb1ec29d5cabd12bceeee67af184ccb3c39c51",
  );
  assert.equal(bytes[0], 255);
});
test("stereo-aware analysis skips quiet padding, keeps a natural tail, and bounds gain", () => {
  const clip = analyzePageTurnBuffer(fixture());
  assert.equal(clip.offset, 0.57);
  assert.ok(Math.abs(clip.duration - 0.711) < 0.00001);
  assert.equal(clip.gain, 0.56);
  const silent = { ...fixture(), getChannelData: () => new Float32Array(2000) };
  assert.throws(() => analyzePageTurnBuffer(silent), /silent/);
});
test("preloading never autoplays; one context/decoded buffer is reused at original pitch", async () => {
  const { audio, context, fetches } = setup();
  await audio.preload();
  assert.equal(context.decodes, 0);
  assert.equal(await audio.play(), false);
  await audio.unlock();
  assert.equal(await audio.play(), true);
  assert.equal(await audio.play(), true);
  assert.equal(context.decodes, 1);
  assert.equal(fetches(), 1);
  assert.equal(context.sources[0].playbackRate.value, 1);
  assert.equal(context.sources[0].started[1], 0.57);
  assert.equal(context.sources[0].buffer, context.sources[1].buffer);
});
test("rapid turns retain at most two voices and fade old tails", async () => {
  const { audio, context } = setup();
  await audio.unlock();
  for (let i = 0; i < 8; i++) await audio.play();
  assert.equal(audio.voices.size, 2);
  assert.ok(context.sources.slice(0, -2).every((s) => s.disconnected));
  audio.setMuted(true);
  assert.ok(context.sources.every((s) => s.stops.length > 0));
  assert.equal(await audio.play(), false);
});
test("muting invalidates pending playback even if quickly unmuted", async () => {
  const { audio, context } = setup();
  let resolve;
  context.decoded = new Promise((r) => (resolve = r));
  const warming = audio.unlock();
  const pending = audio.play();
  audio.setMuted(true);
  audio.setMuted(false);
  resolve(fixture());
  await warming;
  assert.equal(await pending, false);
  assert.equal(context.sources.length, 0);
  assert.equal(await audio.play(), true);
});
test("only the latest waiting turn can start and late decoding never plays stale audio", async () => {
  const { audio, context, setClock } = setup();
  let resolve;
  context.decoded = new Promise((r) => (resolve = r));
  const warming = audio.unlock();
  const first = audio.play(),
    second = audio.play();
  resolve(fixture());
  await warming;
  assert.equal(await first, false);
  assert.equal(await second, true);
  const slow = setup();
  let finish;
  slow.context.decoded = new Promise((r) => (finish = r));
  const warm = slow.audio.unlock(),
    play = slow.audio.play();
  slow.setClock(300);
  finish(fixture());
  await warm;
  assert.equal(await play, false);
  assert.equal(slow.context.sources.length, 0);
});
test("backgrounding stops playback and discards pending requests without replay on return", async () => {
  const { audio, context } = setup();
  await audio.unlock();
  await audio.play();
  audio.setBackgrounded(true);
  assert.equal(await audio.play(), false);
  assert.ok(context.sources[0].stops.length > 0);
  audio.setBackgrounded(false);
  assert.equal(context.sources.length, 1);
});
test("missing or undecodable audio never rejects page navigation and can be retried", async () => {
  const errors = [];
  const unsupported = setup({
    createContext: () => null,
    onError: (e) => errors.push(e),
  });
  assert.equal(await unsupported.audio.unlock(), false);
  assert.equal(await unsupported.audio.play(), false);
  assert.equal(errors.length, 1);
  const invalid = setup();
  invalid.context.decodeAudioData = async () => {
    throw Error("bad MP3");
  };
  assert.equal(await invalid.audio.unlock(), false);
  assert.equal(await invalid.audio.play(), false);
  assert.ok(invalid.errors.length >= 1);
  invalid.context.decodeAudioData = async () => fixture();
  assert.equal(await invalid.audio.unlock(), true);
  assert.equal(await invalid.audio.play(), true);
});

test("an unresolved decode times out without a deferred sound when it eventually finishes", async () => {
  const { audio, context } = setup();
  let finish;
  context.decoded = new Promise((resolve) => (finish = resolve));
  const warming = audio.unlock();
  assert.equal(await audio.play(), false);
  finish(fixture());
  await warming;
  assert.equal(context.sources.length, 0);
  assert.equal(await audio.play(), true);
});

test("gesture-driven resume can finish after decoding without losing the current turn", async () => {
  const { audio, context } = setup();
  let resume;
  context.resume = () =>
    new Promise((resolve) => {
      resume = () => {
        context.state = "running";
        resolve();
      };
    });
  const warming = audio.unlock(),
    playing = audio.play();
  await new Promise((resolve) => setTimeout(resolve, 5));
  resume();
  await warming;
  assert.equal(await playing, true);
});
