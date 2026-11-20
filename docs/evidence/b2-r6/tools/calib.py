# Calibration: do these measures reproduce the HUMAN's verdicts (HC "dead", RD "two events")?
import sys, wave, numpy as np
def load(p):
    w = wave.open(p); sr = w.getframerate(); ch = w.getnchannels()
    d = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32767
    d = d.reshape(-1, ch).mean(axis=1); return d, sr
def bp(x, sr, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / sr); X[(f < lo) | (f >= hi)] = 0; return np.fft.irfft(X, len(x))
def rms_db(x, sr, ms):
    n = max(1, int(sr * ms / 1000)); e = np.convolve(x * x, np.ones(n) / n, 'same'); return 10 * np.log10(e + 1e-12)
def schroeder(x, sr):
    e = x * x; s = np.cumsum(e[::-1])[::-1]; s = 10 * np.log10(s / s[0] + 1e-15)
    def t(db):
        i = np.argmax(s <= db); return i / sr if s[i] <= db else np.nan
    return t(-10), t(-20), t(-30)
def onsets(x, sr, t0, t1):
    # 10 ms RMS envelope; local maxima with >= 6 dB rise over the preceding 40 ms minimum, >= 40 ms apart, within 30 dB of the max
    e = rms_db(x, sr, 10)[int(t0 * sr):int(t1 * sr)]; hop = int(sr * 0.005); e = e[::hop]; top = e.max(); out = []
    for i in range(8, len(e) - 2):
        if e[i] >= e[i - 1] and e[i] > e[i + 1] and e[i] > top - 30 and e[i] - e[max(0, i - 8):i].min() >= 6:
            if not out or (i - out[-1][0]) * 5 >= 40: out.append((i, e[i]))
    return [(round(t0 + i * 0.005, 3), round(v - top, 1)) for i, v in out]
for spec in sys.argv[1:]:
    p, wu, rel = spec.split('@'); wu = float(wu); rel = float(rel)
    x, sr = load(p); seg = x[int(rel * sr): int((rel + 1.5) * sr)]
    tot = (seg ** 2).sum(); late = (seg[int(0.15 * sr):] ** 2).sum(); late3 = (seg[int(0.3 * sr):] ** 2).sum()
    print(f"== {p.split('/')[-2]}  windup {wu:.3f}s release {rel:.3f}s")
    print(f"  energy after 150 ms: {100*late/tot:.1f}%   after 300 ms: {100*late3/tot:.2f}%")
    for lo, hi in [(40, 125), (125, 500), (500, 2000), (2000, 8000)]:
        b = bp(seg, sr, lo, hi); t10, t20, t30 = schroeder(b, sr)
        eb = (b ** 2).sum(); lb = (b[int(0.15 * sr):] ** 2).sum()
        print(f"  {lo:>5}-{hi:<5} Hz: -10/-20/-30 dB decay at {t10*1000:6.0f}/{t20*1000:6.0f}/{t30*1000:6.0f} ms; after 150 ms {100*lb/eb:5.1f}%")
    e = rms_db(x, sr, 5)
    pre = e[int((wu + 0.01) * sr):int((rel + 0.005) * sr)]
    pk = e[int(rel * sr):int((rel + 0.05) * sr)].max()
    print(f"  pre-blast (wind-up) level: mean {pre.mean()-pk:.1f} dB, min {pre.min()-pk:.1f} dB re blast peak; level just before blast {e[int((rel-0.01)*sr)]-pk:.1f} dB")
    print(f"  onsets (10 ms env, >=6 dB rise): {onsets(x, sr, wu - 0.02, rel + 0.7)}")
