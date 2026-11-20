import wave, sys, numpy as np
def load(p):
    import struct
    b = open(p, 'rb').read(); d = np.frombuffer(b[44:], dtype='<f4').astype(np.float64); return d
SR = 44100; rel = 0.37 + 0.02  # tick 22 -> 0.3667 + LOOK
for k in ['B2HC', 'B2RD']:
    c, b = load(f'chain/{k}-chain.wav'), load(f'chain/{k}-bypass.wav')
    def env(x, ms): n = int(SR * ms / 1000); return np.sqrt(np.convolve(x * x, np.ones(n) / n, 'same'))
    ec, eb = env(c, 5), env(b, 5)
    r0 = int(0.36 * SR)
    def at(ms): i = r0 + int(ms * SR / 1000); return 20 * np.log10((ec[i + 265] + 1e-9) / (eb[i] + 1e-9))
    seg = slice(int(0.38 * SR), int(1.2 * SR))
    crest = lambda x: 20 * np.log10(np.abs(x[seg]).max() / np.sqrt((x[seg] ** 2).mean()))
    pk_b = np.abs(b).max(); pk_c = np.abs(c).max()
    print(f"{k}: peak bypass {pk_b:.2f} ({20*np.log10(pk_b):+.1f} dBFS) -> chain {pk_c:.2f}; crest 0.38-1.2 s: bypass {crest(b):.1f} dB, chain {crest(c):.1f} dB")
    # chain gain vs bypass over time (5 ms RMS), relative to the release
    print('   chain/bypass level (dB) at ms after 0.36 s: ' + ', '.join(f"{ms}:{at(ms):+.1f}" for ms in [10, 25, 30, 35, 45, 60, 90, 130, 200, 300, 450]))
    # dynamic range of the bypass and chain envelopes: peak 5ms RMS minus level at +100/+200 ms after it
    for name, e in [('bypass', eb), ('chain', ec)]:
        ip = r0 + np.argmax(e[r0:r0 + int(0.1 * SR)]); p = 20 * np.log10(e[ip])
        print(f"   {name}: 5 ms RMS peak at +{(ip-r0)/SR*1000:.0f} ms {p:+.1f} dBFS; drop after 50/100/200 ms: " + ', '.join(f"{20*np.log10(e[ip+int(ms*SR/1000)]+1e-9)-p:+.1f}" for ms in [50, 100, 200]))
