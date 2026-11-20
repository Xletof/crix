# labelled waveform + log-frequency spectrogram (numpy + PIL): spec.py OUT.png "LABEL|file.wav|t0|dur|mark" ...
import sys, struct, numpy as np
from PIL import Image, ImageDraw, ImageFont
sys_argv = sys.argv; sys.argv = ['x']; exec(open(__file__.replace('spec.py', 'an6.py')).read().split("path = sys.argv[1]")[0]); sys.argv = sys_argv
F = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf', 13); FB = ImageFont.truetype('/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf', 15)
W, HW, HS, PAD = 980, 110, 300, 52
def panel(label, path, t0, dur, mark, ref=None):
    d, sr = load(path); x = d.mean(axis=1); x = x[int(t0 * sr):int((t0 + dur) * sr)]
    img = Image.new('RGB', (W, HW + HS + 34), (14, 16, 22)); dr = ImageDraw.Draw(img)
    dr.text((8, 4), label, font=FB, fill=(235, 238, 245))
    pw = W - PAD - 10; top = 26
    # waveform (peak per column), scaled to full scale 1.0
    cols = np.array_split(x, pw)
    for c, seg in enumerate(cols):
        if len(seg) == 0: continue
        a, b = seg.max(), seg.min(); y0 = top + HW / 2
        dr.line([(PAD + c, y0 - a * HW / 2), (PAD + c, y0 - b * HW / 2)], fill=(127, 208, 255))
    dr.text((4, top + 2), '+1', font=F, fill=(150, 150, 160)); dr.text((4, top + HW - 16), '-1', font=F, fill=(150, 150, 160))
    # spectrogram: 2048-pt frames, hop to fill the width; log-frequency rows 30 Hz-12 kHz; dB scale -90..0 re the panel max
    n = 2048; hop = max(1, len(x) // pw); win = np.hanning(n); fr = np.fft.rfftfreq(n, 1 / sr); xp = np.pad(x, (n // 2, n))   # frames centred on their column
    S = np.array([np.abs(np.fft.rfft(xp[i:i + n] * win)) for i in range(0, hop * pw, hop)])[:pw]
    S = 20 * np.log10(S + 1e-9); S -= (ref if ref is not None else S.max())
    rows = np.geomspace(30, 12000, HS)[::-1]; idx = np.clip(np.searchsorted(fr, rows), 0, len(fr) - 1)
    M = np.clip((S[:, idx].T + 80) / 80, 0, 1) ** 1.6
    rgb = np.stack([np.clip(M * 3 - 1.2, 0, 1), np.clip(M * 2.2 - 0.6, 0, 1) ** 1.2, np.clip(M * 1.6, 0, 1) ** 0.8], axis=-1) * 255
    img.paste(Image.fromarray(rgb.astype(np.uint8)), (PAD, top + HW + 4))
    for f in [50, 100, 200, 500, 1000, 2000, 5000, 10000]:
        y = top + HW + 4 + int(np.argmin(np.abs(rows - f))); dr.line([(PAD - 4, y), (PAD, y)], fill=(180, 180, 190)); dr.text((4, y - 7), f'{f//1000}k' if f >= 1000 else str(f), font=F, fill=(180, 180, 190))
    for k in range(0, int(dur * 10) + 1):
        xx = PAD + int(k * 0.1 / dur * pw); dr.line([(xx, top + HW + HS + 4), (xx, top + HW + HS + 9)], fill=(180, 180, 190))
        if k % 2 == 0: dr.text((xx - 10, top + HW + HS + 10), f'{k/10:.1f}s', font=F, fill=(150, 150, 160))
    if mark is not None:
        xx = PAD + int(mark / dur * pw); dr.line([(xx, top), (xx, top + HW + HS + 4)], fill=(255, 90, 90), width=1)
    return img
out = sys.argv[1]; panels = []
for spec in sys.argv[2:]:
    label, path, t0, dur, mark = spec.split('|'); panels.append(panel(label, path, float(t0), float(dur), float(mark) if mark else None))
H = sum(p.height for p in panels); im = Image.new('RGB', (W, H)); y = 0
for p in panels: im.paste(p, (0, y)); y += p.height
im.save(out); print(out, im.size)
