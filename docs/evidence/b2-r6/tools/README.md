# B2-R6 evidence tools (as used; paths are this session's scratch directories)

These produced the numbers in `../README.md`. They are kept for reproduction, not as maintained tests:
the maintained checks are in `tests/smoke-b2r6.mjs`.

- `cap.sh`: drives the full-game capture rig (`r5film.mjs`, the B2-R4/R5 offline film rig: the game's
  own AudioContext replaced by an OfflineAudioContext on the stepped game clock).
- `ev6.py`: from the captures, levels (full, phone band, laptop band, mono), punch, and the native,
  matched, phone-band and mono FLAC exports, plus the spectrogram figures (`spec.py`).
- `an6.py`: envelope, band shares and Schroeder decays, late energy, pre-rush level, onsets, glides,
  stereo. `calib.py` is the first version, used on R5's own renders to find measurements that reproduce
  the HUMAN's verdicts.
- `bands.py`: absolute band levels after scaling every file to the same max momentary loudness.
- `p-lone.mjs`: renders each kit's Super alone through `createB2Audio` in an OfflineAudioContext.
- `p-null.mjs`: the Web Audio path against the Node render times `R6_TRIM` (residual = B2's idle floor).
- `p-chain.mjs` + `chainan.py`: R5's Super with and without its compressor and clipper.
- `stems-export.mjs`, `node-render.mjs`, `variant.mjs`, `rushstep.mjs`, `punch6.py`: the Node renders of
  `src/systems/b2Thunder.js` (stems, mix variants, the rush across the hand-over, punch).
