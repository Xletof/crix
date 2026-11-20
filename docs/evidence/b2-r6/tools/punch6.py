import sys, subprocess, numpy as np
sys.argv_s = sys.argv; sys.argv = ['x']; exec(open('an6.py').read().split("path = sys.argv[1]")[0]); sys.argv = sys.argv_s
for p in sys.argv[1:]:
    d, sr = load(p); x = d.mean(axis=1); rel = 0.367; e5 = rmsdb(x, sr, 5)
    pk = e5[int(rel * sr):int((rel + 0.05) * sr)].max()
    o = subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-i', p, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    M = max(float(l.split('M:')[1].split()[0]) for l in o.splitlines() if 'M:' in l and 'TARGET' in l)
    seg = x[int(rel * sr):int((rel + 1.5) * sr)]; tot = (seg ** 2).sum()
    print(f"{p}: punch {pk - M:+.1f} dB | late>150ms {100*(seg[int(.15*sr):]**2).sum()/tot:.1f}% | 5ms RMS at +2/+15/+40/+100 ms re peak: {e5[int((rel+.002)*sr)]-pk:+.1f} {e5[int((rel+.015)*sr)]-pk:+.1f} {e5[int((rel+.04)*sr)]-pk:+.1f} {e5[int((rel+.1)*sr)]-pk:+.1f}")
