# Page-turn recording

`page-turn.mp3` is the original MP3 decoded directly from the user's uploaded
`base64.txt`. No transcoding, resampling, or destructive editing was performed.
The Base64 text itself is not shipped: the binary asset is smaller and avoids
parsing a large Base64 JavaScript string on phones.

- Original file length: **83,591 bytes**
- SHA-256: `543118ab2c6c9268b0ab0070ebdb1ec29d5cabd12bceeee67af184ccb3c39c51`
- Browser-decoded duration: approximately **2.61 seconds**, stereo
- Provenance: supplied by the project user; rights to the source recording remain
  with its respective rights holder.

`src/page-audio.js` analyzes the decoded sample once to skip quiet padding around
the paper sound. Playback stays at the original pitch and speed; a bounded gain
adjustment and short fades make the supplied quiet recording usable as a UI sound.
The source MP3 remains unchanged and is bundled in the native app and offline web
precache. The unit test pins its hash to catch unintended replacement or damage.
