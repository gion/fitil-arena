"""Test rapid Chatterbox: generează câteva replici din joc în out/ (wav).

Rulare: tools/voice/.venv/bin/python tools/voice/try_lines.py [--ref voce.wav]
--ref = un wav de 5–10s cu vocea de imitat (opțional; fără el folosește vocea implicită).
"""

import argparse
import time
from pathlib import Path

import torch
import torchaudio as ta
from chatterbox.tts import ChatterboxTTS

# Replici din packages/content/src/texts.ts, cu exagerarea emoției (0.25 = calm, 1+ = teatral).
LINES = [
    ("bye_bye", "Bye bye...", 0.4),
    ("bye_bye_drama", "Bye byeee!", 1.0),
    ("ouch", "Ouch!", 0.9),
    ("oh_no", "Oh no!", 0.9),
    ("not_fair", "Not fair!", 1.0),
    ("my_mustache", "My mustache!", 1.1),
    ("lightning", "I'm lightning!", 0.8),
    ("legend", "I'm a legend!", 0.9),
    ("too_easy", "Too easy!", 0.7),
    ("hurry_up", "Hurry up! The arena is shrinking!", 0.8),
]

OUT = Path(__file__).parent / "out"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--ref", help="wav cu vocea de imitat")
    args = ap.parse_args()

    device = "mps" if torch.backends.mps.is_available() else "cpu"
    # checkpoint-urile sunt salvate pentru CUDA; pe Mac le mapăm pe dispozitivul local
    _load = torch.load
    torch.load = lambda *a, **k: _load(*a, **{**k, "map_location": torch.device(device)})

    t0 = time.time()
    model = ChatterboxTTS.from_pretrained(device=device)
    print(f"model încărcat pe {device} în {time.time() - t0:.0f}s")

    OUT.mkdir(exist_ok=True)
    for name, text, ex in LINES:
        t = time.time()
        wav = model.generate(text, audio_prompt_path=args.ref, exaggeration=ex, cfg_weight=0.3)
        path = OUT / f"{name}.wav"
        ta.save(str(path), wav, model.sr)
        print(f"{path.name:22} {time.time() - t:5.1f}s  «{text}»")


if __name__ == "__main__":
    main()
