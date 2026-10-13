"""Generate our original stockwhip crack; no third-party sound samples."""
from pathlib import Path
import math
import random
import struct
import wave

DESTINATION = Path(__file__).resolve().parents[1] / "mods/clawd/assets/whip-crack.wav"
RATE = 44100
DURATION = 0.55
CRACK_AT = 0.12
# Slap echoes off distant ground and walls: (delay s, gain).
ECHOES = [(0.075, 0.22), (0.17, 0.11), (0.29, 0.05)]


def bandpass(signal, centre, q=2.5):
    """Chamberlin state-variable band-pass; `centre(i)` may sweep."""
    low = band = 0.0
    out = []
    for index, value in enumerate(signal):
        f = 2 * math.sin(math.pi * centre(index) / RATE)
        high = value - low - band / q
        band += f * high
        low += f * band
        out.append(band)
    return out


def lowpass(signal, cutoff):
    a = 1 - math.exp(-2 * math.pi * cutoff / RATE)
    state = 0.0
    out = []
    for value in signal:
        state += a * (value - state)
        out.append(state)
    return out


def generate():
    rng = random.Random(1111)
    count = round(RATE * DURATION)
    crack_index = round(RATE * CRACK_AT)
    noise = [rng.uniform(-1.0, 1.0) for _ in range(count)]

    # The swish: thin hiss rising in pitch and level as the tip accelerates.
    swish = bandpass(noise, lambda i: 700 + 4300 * min(1.0, i / crack_index) ** 2, q=3)
    swish = [v * 0.10 * min(1.0, i / crack_index) ** 3 if i < crack_index else 0.0
             for i, v in enumerate(swish)]

    # The crack: the tip outruns sound, a sub-millisecond N-wave pressure spike,
    # plus a few milliseconds of bright noise. No tone, so it reads as a snap.
    # White noise alone hisses; a crack's energy sits around 2-5 kHz.
    snap = lowpass(lowpass(noise, 5000), 5000)
    level = math.sqrt(sum(v * v for v in snap) / count)
    snap = [v / level / 1.7 for v in snap]
    crack = [0.0] * count
    for i in range(crack_index, count):
        t = (i - crack_index) / RATE
        if t < 0.0003:
            crack[i] += 0.7
        elif t < 0.0007:
            crack[i] -= 0.6
        crack[i] += snap[i] * 1.0 * math.exp(-t / 0.003)
        crack[i] += snap[i] * 0.15 * math.exp(-t / 0.015)

    # Open air: delayed, dulled copies of the crack, then a short diffuse tail.
    dull = lowpass(crack, 3500)
    air = [0.0] * count
    for delay, gain in ECHOES:
        offset = round(RATE * delay)
        for i in range(count - offset):
            air[i + offset] += dull[i] * gain
    tail_noise = lowpass(noise, 2500)
    for i in range(crack_index, count):
        t = (i - crack_index) / RATE
        air[i] += tail_noise[i] * 0.05 * math.exp(-t / 0.09) * min(1.0, t / 0.01)

    raw = [s + c + a for s, c, a in zip(swish, crack, air)]
    fade = round(RATE * 0.03)
    for i in range(fade):
        raw[count - 1 - i] *= i / fade
    peak = max(abs(value) for value in raw)
    samples = [struct.pack("<h", round(value / peak * 31000)) for value in raw]
    DESTINATION.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(DESTINATION), "wb") as output:
        output.setnchannels(1)
        output.setsampwidth(2)
        output.setframerate(RATE)
        output.writeframes(b"".join(samples))
    print(f"Generated {DESTINATION.name}: {DURATION}s, mono PCM, {RATE} Hz")


if __name__ == "__main__":
    generate()
