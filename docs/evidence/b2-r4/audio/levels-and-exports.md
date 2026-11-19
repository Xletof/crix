# B2-R4 audio: levels and exports

**Capture-rig tone (inherited, removed here).** Every offline full-game capture starts with a steady
440 Hz tone at about 0.55 amplitude: 0.67 s in the hold-F capture, 0.17 s in the fights, 6 ms in
the music-muted captures. It is identical in R3, R4, B2 and B2S. It goes through the music bus, so
muting the music removes it. B2-R3's delivered full-mix fight films carry the same 0.17 s tone.
440 Hz is an `OscillatorNode`'s default frequency, so the most likely cause is the rig's virtual
clock: it turns `.value` writes into `setValueAtTime` at virtual time, and a music voice sounds at
its defaults until those land. A live `AudioContext` applies `.value` writes immediately, and the
game was not changed. The cleaned sources (`mixc.wav`) silence 0–0.70 s (hold-F), 0–0.10 s (music
muted) and 0–0.18 s (fights; the first rifle shot starts at 0.167 s, so its first ~13 ms are
lost in all variants alike). Every number and file below comes from the cleaned sources. The
Super windows and the matched excerpts (`matched-super-excerpts.md`) start after the tone and are
unaffected.

In-game levels (before any export gain):

| clip | full-band I (LUFS) | TP (dBTP) | phone-filter I (LUFS) |
|---|---|---|---|
| iso-target-R3 | -33.9 | -4.7 | -37.1 |
| iso-target-R4 | -33.8 | -9.5 | -37.4 |
| mix-R3 | -27.6 | -3.8 | -30.9 |
| mix-R4 | -27.5 | -3.8 | -30.9 |
| mix-R4L | -27.6 | -3.8 | -30.9 |

Super windows (0.3 s before the release to 1.5 s after):

iso-target-R3  release 2.7666666666666666s | window: I -27.1  maxS   TP -4.7 | phone: I -33.1  maxS   TP -12.7 | whole clip: I -33.9 LUFS  TP -4.7 dBFS
iso-target-R4  release 2.7666666666666666s | window: I -26.9  maxS   TP -9.5 | phone: I -33.9  maxS   TP -14.0 | whole clip: I -33.8 LUFS  TP -9.5 dBFS
mix-R3  release 10.1s | window: I -26.7  maxS   TP -6.3 | phone: I -30.2  maxS   TP -13.5 | whole clip: I -27.6 LUFS  TP -3.8 dBFS
mix-R4  release 10.1s | window: I -26.0  maxS   TP -7.8 | phone: I -30.0  maxS   TP -13.8 | whole clip: I -27.5 LUFS  TP -3.8 dBFS
mix-R4L  release 10.1s | window: I -26.7  maxS   TP -6.3 | phone: I -30.2  maxS   TP -13.5 | whole clip: I -27.6 LUFS  TP -3.8 dBFS

Exports, level-matched in pairs (each pair at ONE common loudness = the loudest both reach with true peak <= -1 dBTP, at most -20 LUFS; measured after export):

| file | source I | source TP | gain dB | export I | export TP |
|---|---|---|---|---|---|
| super-isolated-legacy-B2-R3.flac | -33.9 | -4.7 | 3.7 | -30.2 | -1.0 |
| super-isolated-new-B2S-R4.flac | -33.8 | -9.5 | 3.6 | -30.2 | -5.9 |
| super-isolated-legacy-B2-R3-phone.flac | -37.1 | -12.7 | 11.7 | -25.4 | -1.0 |
| super-isolated-new-B2S-R4-phone.flac | -37.4 | -14.0 | 12.0 | -25.4 | -2.0 |
| fight-fullmix-legacy-B2-R3.flac | -27.6 | -3.8 | 2.8 | -24.8 | -1.0 |
| fight-fullmix-new-B2S-R4.flac | -27.5 | -3.8 | 2.7 | -24.8 | -1.1 |
| fight-fullmix-legacy-B2-R3-phone.flac | -30.9 | -13.1 | 10.9 | -20.0 | -2.2 |
| fight-fullmix-new-B2S-R4-phone.flac | -30.9 | -13.1 | 10.9 | -20.0 | -2.2 |
