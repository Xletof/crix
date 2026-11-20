# absolute band levels at matched loudness: each file scaled so its max momentary loudness = -20 LUFS (ffmpeg ebur128),
# then band RMS (dBFS) over the blast window, and the energy share per band
import sys, subprocess, numpy as np
sys.argv_s = sys.argv; sys.argv = ['x']; exec(open('an6.py').read().split("path = sys.argv[1]")[0]); sys.argv = sys.argv_s
def maxM(p):
    o = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    return max(float(l.split('M:')[1].split()[0]) for l in o.splitlines() if 'M:' in l and 'TARGET' in l)
print('| file | gain to -20 LUFS max M | 40-125 Hz RMS (dBFS, 0-1 s) | 125-500 Hz | 500-2k | 2-8k | 40-125 Hz in 0-150 ms | 125-500 Hz in 0-150 ms | 125-500 Hz in 150-600 ms |')
print('|---|---|---|---|---|---|---|---|---|')
for spec in sys.argv[1:]:
    p, rel = spec.split('@'); rel = float(rel); d, sr = load(p); x = d.mean(axis=1)
    g = 10 ** ((-20 - maxM(p)) / 20); x = x * g
    def lv(lo, hi, a, b):
        s = x[int((rel + a) * sr):int((rel + b) * sr)]; y = bp(s, sr, lo, hi); return 10 * np.log10((y ** 2).mean() + 1e-20)
    print(f"| {p} | {20*np.log10(g):+.1f} dB | {lv(40,125,-0.02,1.0):.1f} | {lv(125,500,-0.02,1.0):.1f} | {lv(500,2000,-0.02,1.0):.1f} | {lv(2000,8000,-0.02,1.0):.1f} | {lv(40,125,-0.0,0.15):.1f} | {lv(125,500,0,0.15):.1f} | {lv(125,500,0.15,0.6):.1f} |")
