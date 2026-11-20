# R6 analysis of a rendered/captured event: envelope, band decays, late energy, pre-rush, onsets, glide, centroid; PNG
import sys, wave, struct, numpy as np, subprocess, os
def load(p):
    # RIFF chunks; WAVE_FORMAT_EXTENSIBLE (0xFFFE) carries the real format in its sub-format GUID
    b = open(p, 'rb').read(); i = 12; fmt = ch = sr = bits = None; data = None
    while i + 8 <= len(b):
        cid = b[i:i+4]; sz = struct.unpack('<I', b[i+4:i+8])[0]; body = b[i+8:i+8+sz]
        if cid == b'fmt ':
            fmt, ch, sr = struct.unpack('<HHI', body[:8]); bits = struct.unpack('<H', body[14:16])[0]
            if fmt == 0xFFFE: fmt = struct.unpack('<H', body[24:26])[0]
        if cid == b'data': data = body; break
        i += 8 + sz + (sz & 1)
    if fmt == 3: d = np.frombuffer(data, dtype='<f4' if bits == 32 else '<f8').astype(np.float64)
    else: d = np.frombuffer(data, dtype='<i2').astype(np.float64) / 32767
    d = d.reshape(-1, ch); return d, sr
def rmsdb(x, sr, ms):
    n = max(1, int(sr * ms / 1000)); return 10 * np.log10(np.convolve(x * x, np.ones(n) / n, 'same') + 1e-14)
def bp(x, sr, lo, hi):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / sr); X[(f < lo) | (f >= hi)] = 0; return np.fft.irfft(X, len(x))
def glide(x, sr, rising=False):
    n = int(sr * 0.04); h = int(sr * 0.01); f = np.fft.rfftfreq(n, 1 / sr); sel = (f >= 60) & (f <= 1500); w = np.hanning(n); pk = []; lv = []
    for i in range(0, min(len(x), int(sr * 0.8)) - n, h):
        X = np.abs(np.fft.rfft(x[i:i + n] * w)); j = np.argmax(X[sel]); pk.append(f[sel][j]); lv.append(X[sel][j])
    pk = np.array(pk); lv = np.array(lv); ok = lv > lv.max() * 0.1; best = (0, 0); i = 0
    while i < len(pk):
        if not ok[i]: i += 1; continue
        j = i
        while j + 1 < len(pk) and ok[j + 1] and ((pk[j + 1] >= pk[j] * 0.97) if rising else (pk[j + 1] <= pk[j] * 1.03)): j += 1
        dur = (j - i) * 0.01; semis = abs(12 * np.log2(pk[j] / max(pk[i], 1)))
        if dur >= 0.1 and semis > best[1]: best = (dur, semis)
        i = j + 1
    return best
def onsets(e5, sr, t0, t1):
    hop = int(sr * 0.005); e = e5[int(t0 * sr):int(t1 * sr)][::hop]; top = e.max(); out = []
    for i in range(8, len(e) - 2):
        if e[i] >= e[i - 1] and e[i] > e[i + 1] and e[i] > top - 30 and e[i] - e[max(0, i - 8):i].min() >= 6:
            if not out or (i - out[-1][0]) * 5 >= 40: out.append((i, e[i]))
    return [(round(t0 + i * 0.005 - rel, 3), round(v - top, 1)) for i, v in out]
path = sys.argv[1]; rel = float(sys.argv[2]); wu = float(sys.argv[3]) if len(sys.argv) > 3 else rel - 0.117; tag = sys.argv[4] if len(sys.argv) > 4 else os.path.basename(path)
d, sr = load(path); x = d.mean(axis=1)
e = rmsdb(x, sr, 5); i0 = int(rel * sr); pk = e[i0:i0 + int(0.06 * sr)].max(); tpk = (np.argmax(e[i0:i0 + int(0.06 * sr)])) / sr
print(f"== {tag}: sr {sr}, sample peak {np.abs(d).max():.3f}, 5 ms RMS peak at +{tpk*1000:.1f} ms ({pk:.1f} dBFS)")
print("  5 ms RMS re its peak at ms after the blast: " + ', '.join(f"{ms}:{e[i0+int(ms*sr/1000)]-pk:+.1f}" for ms in [1, 3, 8, 15, 25, 40, 60, 100, 150, 200, 300, 450, 600, 800, 1000, 1300]))
pre = e[int((wu + 0.005) * sr):i0]
if len(pre): print(f"  pre-rush re blast peak: at windup+50 ms {e[int((wu+0.05)*sr)]-pk:+.1f}, +90 ms {e[int((wu+0.09)*sr)]-pk:+.1f}, 5 ms before the blast {e[i0-int(0.005*sr)]-pk:+.1f}; min over the last 40 ms {pre[-int(0.04*sr):].min()-pk:+.1f} dB")
seg = x[i0:i0 + int(1.6 * sr)]; tot = (seg ** 2).sum()
print(f"  energy after 150 ms {100*(seg[int(.15*sr):]**2).sum()/tot:.1f}% | after 300 ms {100*(seg[int(.3*sr):]**2).sum()/tot:.1f}% | after 600 ms {100*(seg[int(.6*sr):]**2).sum()/tot:.2f}%")
for lo, hi in [(40, 125), (125, 500), (500, 2000), (2000, 8000)]:
    b = bp(seg, sr, lo, hi); E = b * b; s = np.cumsum(E[::-1])[::-1]; s = 10 * np.log10(s / s[0] + 1e-15)
    tt = lambda db: (np.argmax(s <= db) / sr * 1000) if (s <= db).any() else float('nan')
    print(f"  {lo:>5}-{hi:<5} Hz: share {100*E.sum()/tot:5.1f}% | Schroeder -10/-20/-30 dB at {tt(-10):5.0f}/{tt(-20):5.0f}/{tt(-30):5.0f} ms | after 150 ms {100*E[int(.15*sr):].sum()/E.sum():5.1f}%")
print(f"  onsets (s re blast, dB re max): {onsets(e, sr, max(0, wu - 0.02), rel + 0.9)}")
print(f"  longest falling glide {glide(seg, sr)}; longest rising glide (pre-rush + blast) {glide(x[int(wu*sr):], sr, True)}")
L, R = d[:, 0], d[:, 1] if d.shape[1] > 1 else d[:, 0]
side = (L - R) / 2; mid = (L + R) / 2
print(f"  stereo: side/mid energy {10*np.log10((side[i0:]**2).sum()/((mid[i0:]**2).sum()+1e-12)+1e-12):.1f} dB; L/R correlation (0-1.5 s) {np.corrcoef(L[i0:i0+int(1.5*sr)], R[i0:i0+int(1.5*sr)])[0,1]:.2f}")
if len(sys.argv) > 5:
    png = sys.argv[5]; s0 = max(0, wu - 0.1); dur = min(len(x) / sr - s0, 1.9)
    subprocess.run(['ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', str(s0), '-t', str(dur), '-i', path, '-filter_complex',
        f"[0:a]aformat=channel_layouts=mono,showwavespic=s=900x140:colors=0x7fd0ff:scale=lin[w];[0:a]aformat=channel_layouts=mono,showspectrumpic=s=900x300:legend=0:scale=log:fscale=log:color=intensity:start=30:stop=12000[s];[w][s]vstack,drawtext=text='{tag}  (blast at {rel-s0:.2f} s)':x=10:y=6:fontcolor=white:fontsize=18", '-frames:v', '1', png])
