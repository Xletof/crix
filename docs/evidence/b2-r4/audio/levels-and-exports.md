In-game levels (before any export gain):

| clip | full-band I (LUFS) | TP (dBTP) | phone-filter I (LUFS) |
|---|---|---|---|
| iso-target-R3 | -33.3 | -3.8 | -36.4 |
| iso-target-R4 | -33.2 | -3.8 | -36.6 |
| mix-R3 | -25.4 | -3.8 | -28.0 |
| mix-R4 | -25.4 | -3.8 | -28.0 |
| mix-R4L | -25.4 | -3.8 | -28.0 |

Super windows (0.3 s before the release to 1.5 s after):

iso-target-R3  release 2.7666666666666666s | window: I -27.1  maxS   TP -4.7 | phone: I -33.1  maxS   TP -12.7 | whole clip: I -33.3 LUFS  TP -3.8 dBFS
iso-target-R4  release 2.7666666666666666s | window: I -26.9  maxS   TP -9.5 | phone: I -33.9  maxS   TP -14.0 | whole clip: I -33.2 LUFS  TP -3.8 dBFS
mix-R3  release 10.1s | window: I -26.7  maxS   TP -6.3 | phone: I -30.2  maxS   TP -13.5 | whole clip: I -25.4 LUFS  TP -3.8 dBFS
mix-R4  release 10.1s | window: I -26.0  maxS   TP -7.8 | phone: I -30.0  maxS   TP -13.8 | whole clip: I -25.4 LUFS  TP -3.8 dBFS
mix-R4L  release 10.1s | window: I -26.7  maxS   TP -6.3 | phone: I -30.2  maxS   TP -13.5 | whole clip: I -25.4 LUFS  TP -3.8 dBFS

Exports (target -20 LUFS, never above -1 dBTP; measured after export):

| file | source I | source TP | gain dB | export I | export TP |
|---|---|---|---|---|---|
| super-isolated-legacy-B2-R3.flac | -33.3 | -3.8 | 2.8 | -30.5 | -1.0 |
| super-isolated-new-B2S-R4.flac | -33.2 | -3.8 | 2.8 | -30.4 | -1.0 |
| super-isolated-legacy-B2-R3-phone.flac | -36.4 | -1.2 | 0.2 | -36.1 | -1.0 |
| super-isolated-new-B2S-R4-phone.flac | -36.6 | -1.2 | 0.2 | -36.4 | -1.0 |
| fight-fullmix-legacy-B2-R3.flac | -25.4 | -3.8 | 2.8 | -22.6 | -1.0 |
| fight-fullmix-new-B2S-R4.flac | -25.4 | -3.8 | 2.8 | -22.6 | -1.0 |
| fight-fullmix-legacy-B2-R3-phone.flac | -28.0 | -5.5 | 4.5 | -23.5 | -1.0 |
| fight-fullmix-new-B2S-R4-phone.flac | -28.0 | -5.5 | 4.5 | -23.5 | -1.0 |
