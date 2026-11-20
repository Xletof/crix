# B2-R6 audio evidence from the browser captures (F/<tag>/mix.wav + vlog.json): tone-clean, levels (full band, phone band,
# laptop band, mono), the calibrated metrics, punch, native-level and loudness-matched FLAC exports (TP <= -1 dBTP), images.
import json, os, subprocess, sys, numpy as np
sys.argv_save = sys.argv; sys.argv = ['x']; exec(open('an6.py').read().split("path = sys.argv[1]")[0]); sys.argv = sys.argv_save
OUT = '/home/user/crix/docs/evidence/b2-r6/audio'; IMG = '/home/user/crix/docs/evidence/b2-r6/img'
PHONE = 'highpass=f=300:poles=2,highpass=f=300:poles=2,lowpass=f=8000'
LAPTOP = 'highpass=f=150:poles=2,highpass=f=150:poles=2,lowpass=f=14000'
MONO = 'pan=mono|c0=0.5*c0+0.5*c1'
NAMES = {'RT': 'R6-reactor-thunder', 'HC': 'R5-heavy-cannon', 'S': 'R4-B2S'}
def run(*a): return subprocess.run(a, capture_output=True, text=True)
def meas(p, ss=None, t=None, filt=''):
    a = ['ffmpeg', '-hide_banner', '-nostats'] + (['-ss', str(ss), '-t', str(t)] if ss is not None else []) + ['-i', p, '-af', (filt + ',' if filt else '') + 'ebur128=peak=true', '-f', 'null', '-']
    o = run(*a).stderr; I = TP = None; M = -99.0
    for l in o.splitlines():
        if 'M:' in l and 'TARGET' in l:
            try: M = max(M, float(l.split('M:')[1].split()[0]))
            except Exception: pass
    s = o[o.find('Summary'):]
    for l in s.splitlines():
        l = l.strip()
        if l.startswith('I:'): I = float(l.split()[1])
        if l.startswith('Peak:'): TP = float(l.split()[1])
    return I, M, TP
def rel_of(d):
    v = json.load(open(f'F/{d}/vlog.json')); w = [t for t, m, a in v if m == 'windup']; r = [t for t, m, a in v if m == 'release']
    return (w[0] / 60 + 0.02 if w else None), (r[0] / 60 + 0.02 if r else None)
def clean(d, x):
    src, dst = f'F/{d}/mix.wav', f'F/{d}/mixc.wav'
    run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', src, '-af', f"volume=volume=0:enable='lt(t,{x})',afade=t=in:st={x}:d=0.005", '-c:a', 'pcm_s16le', dst)
    return dst
def onset(p, rel):
    # the crack: the steepest rise of the 1 ms RMS envelope (dB over 2 ms) from 10 ms before to 80 ms after the logged release
    d, sr = load(p); x = d.mean(axis=1); e = rmsdb(x, sr, 1)
    i0 = int((rel - 0.01) * sr); n2 = int(0.002 * sr); seg = e[i0:i0 + int(0.09 * sr)]
    rise = seg[n2:] - seg[:-n2]; j = int(np.argmax(rise)); return rel - 0.01 + j / sr
sets = {'iso': [('RT', 'iso-RT2'), ('HC', 'iso-HC'), ('S', 'iso-S')], 'fight': [('RT', 'mix-RT'), ('HC', 'mix-HC'), ('S', 'mix-S')]}
rows = []; metrics = {}
for kind, items in sets.items():
    ex = {}
    # one blast time per set: the onset detected on the Heavy Cannon capture (same ticks; a sharp onset, no rush before it)
    for k, d in items:
        if not os.path.exists(f'F/{d}/mix.wav'): print('missing', d); continue
        p = clean(d, 0.10 if kind == 'iso' else 0.18); wu, rel = rel_of(d)
        on = onset(p, rel); wu = wu + (on - rel)   # the rig's audio timeline sits an offset from the tick log; the Super buses with a compressor add its 6 ms look-ahead
        S0 = max(0, rel - 0.3); I, M, TP = meas(p, S0, 1.8); Ip, Mp, TPp = meas(p, S0, 1.8, PHONE); Il, Ml, _ = meas(p, S0, 1.8, LAPTOP); Im, Mm, _ = meas(p, S0, 1.8, MONO)
        dd, sr = load(p); x = dd.mean(axis=1); e5 = rmsdb(x, sr, 5); pk5 = e5[int(on * sr):int((on + 0.05) * sr)].max()
        rows.append((kind, k, d, rel, on, I, M, TP, Ip, Mp, Il, Ml, Im, Mm, pk5 - M))
        txt = run('python3', 'an6.py', p, str(on), str(wu), f'{kind}-{NAMES[k]}').stdout
        metrics[f'{kind}-{k}'] = txt
        # excerpt: 1.0 s before the blast to 2.0 s after (lossless float for processing)
        ss = max(0, on - 1.0); run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-ss', str(ss), '-t', '3.0', '-i', p, '-c:a', 'pcm_f32le', f'A_{kind}_{k}.wav')
        ex[k] = (f'A_{kind}_{k}.wav', I, M, TP, on - ss)
    if len(ex) < 2: continue
    # native level: one gain for the set (the loudest true peak at -1 dBTP), relative levels as in the game
    g = -1.0 - max(v[3] for v in ex.values())
    for k, (f, I, M, TP, at) in ex.items():
        o = f'{OUT}/super-{"isolated" if kind == "iso" else "in-fight"}-native-{NAMES[k]}.flac'
        run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', f, '-af', f'volume={g:.2f}dB', '-c:a', 'flac', '-sample_fmt', 's16', '-compression_level', '8', o)
    # loudness matched on the Super window's max momentary loudness (the in-game matching metric), TP <= -1
    Mx = [meas(f, max(0, at - 0.3), 1.8)[1] for f, *_ in ex.values()]; TPx = [v[3] for v in ex.values()]
    target = min(-18.0, *[m - 1 - tp for m, tp in zip([meas(f)[1] for f, *_ in ex.values()], [meas(f)[2] for f, *_ in ex.values()])])
    for (k, (f, I, M, TP, at)), mwin in zip(ex.items(), Mx):
        _, mall, tpall = meas(f); gain = target - mall
        for tag, filt in [('matched', ''), ('matched-phone-band', PHONE), ('matched-mono', MONO)]:
            o = f'{OUT}/super-{"isolated" if kind == "iso" else "in-fight"}-{tag}-{NAMES[k]}.flac'
            af = f'volume={gain:.2f}dB' + (',' + filt if filt else '')
            run('ffmpeg', '-y', '-hide_banner', '-loglevel', 'error', '-i', f, '-af', af, '-c:a', 'flac', '-sample_fmt', 's16', '-compression_level', '8', o)
    # images
    run('python3', 'spec.py', f'{IMG}/{"isolated" if kind == "iso" else "in-fight"}-RT-HC-S.png', *[f'{"isolated" if kind == "iso" else "in fight"}: {NAMES[k]} (browser capture; red = the blast)|{f}|{max(0, at - 0.35)}|1.9|{min(at, 0.35)}' for k, (f, *_x, at) in ex.items()])
with open(f'{OUT}/levels.md', 'w') as fh:
    fh.write('| set | sound | capture | blast (s) | Super window I (LUFS) | max M (LUFS) | TP (dBTP) | phone-band I / max M | laptop-band I / max M | mono I / max M | punch: first 5 ms RMS peak minus max M (dB) |\n|---|---|---|---|---|---|---|---|---|---|---|\n')
    for r in rows: fh.write(f'| {r[0]} | {NAMES[r[1]]} | {r[2]} | {r[4]:.3f} | {r[5]} | {r[6]:.1f} | {r[7]} | {r[8]} / {r[9]:.1f} | {r[10]} / {r[11]:.1f} | {r[12]} / {r[13]:.1f} | {r[14]:+.1f} |\n')
with open(f'{OUT}/metrics.txt', 'w') as fh:
    for k, v in metrics.items(): fh.write(v + '\n')
print(open(f'{OUT}/levels.md').read())
