"""Dia (Nari Labs, Apache 2.0), prin transformers: dialog cu sunete fără cuvinte în text.

Etichete: (laughs) (sighs) (gasps) (screams) (groans) etc. Vocea e aleasă la întâmplare,
deci fixăm seed-ul ca toate replicile unei rulări să sune la fel.
Rulare: tools/voice/orpheus/.venv/bin/python tools/voice/orpheus/try_dia.py [seed ...]
"""

import sys
import time
from pathlib import Path

import torch
from transformers import AutoProcessor, DiaForConditionalGeneration

sys.path.insert(0, str(Path(__file__).parent.parent))
from lines import LINES, render  # noqa: E402

MODEL = "nari-labs/Dia-1.6B-0626"
TAGS = {
    "laugh": "(laughs)",
    "sigh": "(sighs)",
    "gasp": "(gasps)",
    "groan": "(groans)",
    "scream": "(screams)",
}
OUT = Path(__file__).parent.parent / "out" / "dia"


def main() -> None:
    seeds = [int(s) for s in sys.argv[1:]] or [7, 42]
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    proc = AutoProcessor.from_pretrained(MODEL)
    model = DiaForConditionalGeneration.from_pretrained(MODEL).to(dev).eval()

    for seed in seeds:
        out = OUT / f"seed{seed}"
        out.mkdir(parents=True, exist_ok=True)
        for name, text, _ in LINES:
            t = time.time()
            line = "[S1] " + render(text, TAGS)
            torch.manual_seed(seed)
            inputs = proc(text=[line], padding=True, return_tensors="pt").to(dev)
            with torch.no_grad():
                gen = model.generate(
                    **inputs, max_new_tokens=1024, guidance_scale=3.0, temperature=1.8, top_p=0.9, top_k=45
                )
            proc.save_audio(proc.batch_decode(gen), str(out / f"{name}.wav"))
            print(f"seed{seed}/{name:16} {time.time() - t:5.1f}s  «{line}»", flush=True)


if __name__ == "__main__":
    main()
