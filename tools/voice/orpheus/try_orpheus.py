"""Orpheus TTS (Canopy Labs, Apache 2.0): LLM de 3B care scoate tokeni audio SNAC.

Etichete: <laugh> <chuckle> <sigh> <cough> <sniffle> <groan> <yawn> <gasp>.
Voci: tara, leah, jess, leo, dan, mia, zac, zoe.
Rulare: tools/voice/orpheus/.venv/bin/python tools/voice/orpheus/try_orpheus.py [voce ...]
"""

import sys
import time
from pathlib import Path

import soundfile as sf
import torch
from snac import SNAC
from transformers import AutoModelForCausalLM, AutoTokenizer

sys.path.insert(0, str(Path(__file__).parent.parent))
from lines import LINES, render  # noqa: E402

MODEL = "unsloth/orpheus-3b-0.1-ft"  # copie negated-ă a canopylabs/orpheus-3b-0.1-ft
TAGS = {"laugh": "<laugh>", "sigh": "<sigh>", "gasp": "<gasp>", "groan": "<groan>"}
OUT = Path(__file__).parent.parent / "out" / "orpheus"

# tokeni speciali din formatul Orpheus
START_HUMAN, END_TEXT, END_HUMAN = 128259, 128009, 128260
START_AUDIO, END_AUDIO, AUDIO_BASE = 128257, 128258, 128266


def to_codes(ids: list[int]) -> list[list[int]] | None:
    """Tokenii de după START_AUDIO → cele 3 niveluri de coduri SNAC (7 tokeni pe cadru)."""
    if START_AUDIO in ids:
        ids = ids[len(ids) - 1 - ids[::-1].index(START_AUDIO) + 1 :]
    ids = [t - AUDIO_BASE for t in ids if t != END_AUDIO]
    n = len(ids) // 7 * 7
    if n == 0:
        return None
    l1, l2, l3 = [], [], []
    for i in range(0, n, 7):
        f = ids[i : i + 7]
        l1.append(f[0])
        l2 += [f[1] - 4096, f[4] - 4 * 4096]
        l3 += [f[2] - 2 * 4096, f[3] - 3 * 4096, f[5] - 5 * 4096, f[6] - 6 * 4096]
    return [l1, l2, l3]


def main() -> None:
    voices = sys.argv[1:] or ["leo", "tara"]
    dev = "mps" if torch.backends.mps.is_available() else "cpu"
    tok = AutoTokenizer.from_pretrained(MODEL)
    model = AutoModelForCausalLM.from_pretrained(MODEL, dtype=torch.bfloat16).to(dev).eval()
    snac = SNAC.from_pretrained("hubertsiuzdak/snac_24khz").to(dev).eval()

    for voice in voices:
        out = OUT / voice
        out.mkdir(parents=True, exist_ok=True)
        for name, text, _ in LINES:
            t = time.time()
            line = render(text, TAGS)
            txt = tok(f"{voice}: {line}", return_tensors="pt").input_ids
            ids = torch.cat(
                [torch.tensor([[START_HUMAN]]), txt, torch.tensor([[END_TEXT, END_HUMAN]])], dim=1
            ).to(dev)
            with torch.no_grad():
                gen = model.generate(
                    ids,
                    attention_mask=torch.ones_like(ids),
                    max_new_tokens=1200,
                    do_sample=True,
                    temperature=0.7,
                    top_p=0.95,
                    repetition_penalty=1.1,
                    eos_token_id=END_AUDIO,
                )
            codes = to_codes(gen[0, ids.shape[1] :].tolist())
            if not codes:
                print(f"{voice}/{name}: fără audio")
                continue
            with torch.no_grad():
                audio = snac.decode([torch.tensor(c, device=dev).unsqueeze(0) for c in codes])
            sf.write(out / f"{name}.wav", audio.squeeze().float().cpu().numpy(), 24000)
            print(f"{voice}/{name:16} {time.time() - t:5.1f}s  «{line}»", flush=True)


if __name__ == "__main__":
    main()
