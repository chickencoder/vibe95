"""Generates the Vibe95 theme: an original 90s-style chiptune loop.

Square/pulse voices + noise drums, written straight to a 16-bit PCM WAV.
Run: python3 scripts/make-music.py
"""
import math
import struct
import wave

SR = 44100
BPM = 125.0
BEAT = 60.0 / BPM
SIX = BEAT / 4.0          # sixteenth note
BAR = BEAT * 4.0
DURATION = 37.0

buf = [0.0] * int(SR * DURATION)


def midi(n):
    return 440.0 * (2.0 ** ((n - 69) / 12.0))


_seed = 12345


def noise():
    global _seed
    _seed = (1103515245 * _seed + 12345) & 0x7FFFFFFF
    return (_seed / 0x3FFFFFFF) - 1.0


def add(start, samples, gain):
    i = int(start * SR)
    n = len(buf)
    for k, v in enumerate(samples):
        j = i + k
        if 0 <= j < n:
            buf[j] += v * gain


def pulse(freq, dur, duty=0.5, decay=6.0, attack=0.004, vibrato=0.0):
    n = int(dur * SR)
    out = [0.0] * n
    phase = 0.0
    for k in range(n):
        t = k / SR
        f = freq * (1.0 + vibrato * math.sin(2 * math.pi * 5.5 * t))
        phase += f / SR
        env = math.exp(-decay * t)
        if t < attack:
            env *= t / attack
        out[k] = (1.0 if (phase % 1.0) < duty else -1.0) * env
    return out


def kick(dur=0.16):
    n = int(dur * SR)
    out = [0.0] * n
    phase = 0.0
    for k in range(n):
        t = k / SR
        f = 45.0 + 110.0 * math.exp(-28.0 * t)
        phase += f / SR
        out[k] = math.sin(2 * math.pi * phase) * math.exp(-16.0 * t)
    return out


def snare(dur=0.14):
    n = int(dur * SR)
    out = [0.0] * n
    for k in range(n):
        t = k / SR
        e = math.exp(-26.0 * t)
        out[k] = (noise() * 0.85 + math.sin(2 * math.pi * 185 * t) * 0.3) * e
    return out


def hat(dur=0.035):
    n = int(dur * SR)
    out = [0.0] * n
    prev = 0.0
    for k in range(n):
        t = k / SR
        x = noise()
        hp = x - prev          # crude high pass so it sounds tinny
        prev = x
        out[k] = hp * math.exp(-95.0 * t)
    return out


# --- arrangement -------------------------------------------------------------
# vi - IV - I - V, two bars each.
CHORDS = [
    [57, 60, 64],  # Am
    [53, 57, 60],  # F
    [48, 52, 55],  # C
    [55, 59, 62],  # G
]

MELODY = [
    [(76, 2), (81, 2), (79, 2), (76, 2), (72, 4), (None, 2), (74, 2),
     (76, 6), (None, 2), (72, 4), (None, 4)],
    [(77, 2), (81, 2), (84, 2), (81, 2), (79, 4), (None, 2), (77, 2),
     (81, 6), (None, 2), (77, 4), (None, 4)],
    [(76, 2), (79, 2), (84, 2), (83, 2), (79, 4), (None, 2), (76, 2),
     (79, 6), (None, 2), (72, 4), (None, 4)],
    [(74, 2), (78, 2), (83, 2), (81, 2), (79, 4), (None, 2), (74, 2),
     (78, 6), (None, 2), (83, 4), (None, 4)],
]

ARP_STEPS = [0, 1, 2, 1, 2, 1, 0, 1]

bar = 0
t = 0.0
while t < DURATION:
    block = (bar // 2) % 4        # which chord we are on
    chord = CHORDS[block]
    first_bar_of_block = bar % 2 == 0
    drums_on = bar >= 2
    lead_on = bar >= 4

    # bass: root, eighth notes with an octave lift on the & of 3
    for step in range(0, 16, 2):
        note = chord[0] - 12 + (12 if step == 10 else 0)
        add(t + step * SIX, pulse(midi(note), SIX * 2.1, duty=0.25, decay=4.5), 0.30)

    # arpeggio: sixteenths climbing the triad
    for step in range(16):
        note = chord[ARP_STEPS[step % len(ARP_STEPS)]] + 12
        add(t + step * SIX, pulse(midi(note), SIX * 1.4, duty=0.5, decay=13.0), 0.10)

    # drums
    if drums_on:
        for step in (0, 10):
            add(t + step * SIX, kick(), 0.85)
        for step in (4, 12):
            add(t + step * SIX, snare(), 0.42)
        for step in range(0, 16, 2):
            add(t + step * SIX, hat(), 0.20)

    # lead melody, laid over the two-bar block
    if lead_on and first_bar_of_block:
        pos = 0
        for note, length in MELODY[block]:
            if note is not None:
                add(
                    t + pos * SIX,
                    pulse(midi(note), length * SIX * 0.95, duty=0.5,
                          decay=2.6, vibrato=0.006),
                    0.24,
                )
            pos += length

    t += BAR
    bar += 1

# soft-clip, then fade the tail out
peak = max(abs(v) for v in buf) or 1.0
norm = 0.82 / peak
fade = int(1.6 * SR)
frames = bytearray()
for i, v in enumerate(buf):
    v *= norm
    v = math.tanh(v * 1.25) * 0.8
    if i > len(buf) - fade:
        v *= (len(buf) - i) / fade
    frames += struct.pack("<h", int(max(-1.0, min(1.0, v)) * 32000))

with wave.open("public/music/vibe95-theme.wav", "wb") as w:
    w.setnchannels(1)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(bytes(frames))

print("wrote public/music/vibe95-theme.wav", len(buf) / SR, "s")
