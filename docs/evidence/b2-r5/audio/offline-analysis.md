| clip | I (LUFS, 1.25 s) | max M (400 ms) | TP (dBTP) | phone I | phone max M (400 ms) | attack: blast -> 90% of its peak envelope (ms) | time above -20 dB (s) | crest (dB) | 0-300 ms energy: <100 / 100-200 / 200-900 / 0.9-3k / >3k Hz (%) | longest falling glide (s, semitones) |
|---|---|---|---|---|---|---|---|---|---|---|
| B2S-dry.wav | -20.7 | -18.3 | -0.8 | -28.7 | -24.3 | 29.2 | 0.25 | 21.8 | 1 / 74 / 17 / 6 / 3 | 0.13 s, 13.7 |
| B2HC-dry.wav | -21.1 | -18.6 | -1.5 | -23.1 | -20.6 | 33.0 | 0.47 | 21.7 | 6 / 19 / 51 / 22 / 1 | 0.00 s, 0.0 |
| B2RD-dry.wav | -20.5 | -18.3 | -2.7 | -23.2 | -21.0 | 33.0 | 0.40 | 20.2 | 3 / 39 / 37 / 19 / 3 | 0.00 s, 0.0 |
| B2S-ctx.wav | -20.9 | -18.5 | -1.2 | -28.8 | -24.3 | 29.3 | 0.39 | 21.6 | 1 / 75 / 16 / 5 / 2 | 0.12 s, 16.5 |
| B2HC-ctx.wav | -21.2 | -18.5 | -1.7 | -23.1 | -20.6 | 33.1 | 0.47 | 21.4 | 5 / 18 / 52 / 23 / 2 | 0.00 s, 0.0 |
| B2RD-ctx.wav | -20.4 | -18.2 | -3.0 | -23.2 | -21.1 | 33.1 | 0.40 | 19.7 | 2 / 40 / 37 / 17 / 3 | 0.00 s, 0.0 |

band-envelope similarity (1/3-octave log envelopes over the 1.25 s window; 1 = identical shape):
  B2S-dry.wav vs B2HC-dry.wav: time-frequency 0.85 | loudness-contour corr 0.89 | spectral-shape distance 7.4 dB
  B2S-dry.wav vs B2RD-dry.wav: time-frequency 0.80 | loudness-contour corr 0.89 | spectral-shape distance 5.7 dB
  B2S-dry.wav vs B2S-ctx.wav: time-frequency 0.98 | loudness-contour corr 0.98 | spectral-shape distance 0.9 dB
  B2S-dry.wav vs B2HC-ctx.wav: time-frequency 0.84 | loudness-contour corr 0.88 | spectral-shape distance 7.6 dB
  B2S-dry.wav vs B2RD-ctx.wav: time-frequency 0.79 | loudness-contour corr 0.88 | spectral-shape distance 5.3 dB
  B2HC-dry.wav vs B2RD-dry.wav: time-frequency 0.86 | loudness-contour corr 0.89 | spectral-shape distance 2.1 dB
  B2HC-dry.wav vs B2S-ctx.wav: time-frequency 0.84 | loudness-contour corr 0.88 | spectral-shape distance 7.0 dB
  B2HC-dry.wav vs B2HC-ctx.wav: time-frequency 0.99 | loudness-contour corr 0.98 | spectral-shape distance 0.7 dB
  B2HC-dry.wav vs B2RD-ctx.wav: time-frequency 0.87 | loudness-contour corr 0.88 | spectral-shape distance 2.5 dB
  B2RD-dry.wav vs B2S-ctx.wav: time-frequency 0.79 | loudness-contour corr 0.87 | spectral-shape distance 5.4 dB
  B2RD-dry.wav vs B2HC-ctx.wav: time-frequency 0.85 | loudness-contour corr 0.87 | spectral-shape distance 2.1 dB
  B2RD-dry.wav vs B2RD-ctx.wav: time-frequency 0.98 | loudness-contour corr 0.98 | spectral-shape distance 0.7 dB
  B2S-ctx.wav vs B2HC-ctx.wav: time-frequency 0.85 | loudness-contour corr 0.89 | spectral-shape distance 7.2 dB
  B2S-ctx.wav vs B2RD-ctx.wav: time-frequency 0.80 | loudness-contour corr 0.89 | spectral-shape distance 5.0 dB
  B2HC-ctx.wav vs B2RD-ctx.wav: time-frequency 0.87 | loudness-contour corr 0.90 | spectral-shape distance 2.6 dB
