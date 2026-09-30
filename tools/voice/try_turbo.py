"""Chatterbox Turbo: etichete paralingvistice ([laugh], [sigh]...), fără reglaj de exagerare.

Rulare: tools/voice/.venv/bin/python tools/voice/try_turbo.py
"""

import time
from pathlib import Path

import torch
import torchaudio as ta
from chatterbox.tts_turbo import ChatterboxTurboTTS

from lines import LINES, render

TAGS = {"laugh": "[laugh]", "sigh": "[sigh]", "gasp": "[gasp]", "groan": "[groan]"}
OUT = Path(__file__).parent / "out" / "turbo"


def main() -> None:
    device = "mps" if torch.backends.mps.is_available() else "cpu"
    _load = torch.load
    torch.load = lambda *a, **k: _load(*a, **{**k, "map_location": torch.device(device)})
    model = ChatterboxTurboTTS.from_pretrained(device=device)
    OUT.mkdir(parents=True, exist_ok=True)
    for name, text, _ in LINES:
        t = time.time()
        line = render(text, TAGS)
        wav = model.generate(line)
        ta.save(str(OUT / f"{name}.wav"), wav, model.sr)
        print(f"{name:16} {time.time() - t:5.1f}s  «{line}»", flush=True)


if __name__ == "__main__":
    main()
