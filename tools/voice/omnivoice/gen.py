#!/usr/bin/env python3
"""Generează replicile personajelor cu OmniVoice, clonând seed-urile din tools/voice/ref/.

    tools/voice/omnivoice/run.sh --chars gugu,zuzu                 # toate replicile lor
    tools/voice/omnivoice/run.sh --chars gugu --kinds win,quip     # doar anumite tipuri
    tools/voice/omnivoice/run.sh --chars gugu --check              # re-încearcă până whisper înțelege replica

Citește  tools/voice/omnivoice/lines.json   (din packages/content/scripts/export-voice-lines.ts)
         tools/voice/ref/<personaj>.wav + .txt   (din prepare_refs.sh)
Scrie    tools/voice/out/omnivoice/<personaj>/<id>.wav   (nu se regenerează dacă există; --force le rescrie)
"""
import argparse, json, re, sys, time
from pathlib import Path
import numpy as np
import soundfile as sf

HERE = Path(__file__).resolve().parent
REF = HERE.parent / "ref"
OUT = HERE.parent / "out" / "omnivoice"
SR = 24000


def trim(x, thresh=0.01, pad=0.06):
    idx = np.where(np.abs(x) > thresh)[0]
    if len(idx) == 0:
        return x
    return x[max(0, idx[0] - int(pad * SR)): min(len(x), idx[-1] + int(pad * SR))]


_whisper = None
def heard_score(x, text):
    """Cât de bine se potrivește transcrierea whisper cu textul (0..1)."""
    import difflib
    global _whisper
    from faster_whisper import WhisperModel
    if _whisper is None:
        _whisper = WhisperModel("small.en", device="cpu", compute_type="int8")
    y = np.pad(x, (SR // 4, SR // 4))
    y = np.interp(np.linspace(0, len(y) - 1, int(len(y) * 16000 / SR)), np.arange(len(y)), y).astype(np.float32)
    segs, _ = _whisper.transcribe(y, language="en", vad_filter=False)
    heard = " ".join(s.text for s in segs)
    words = lambda s: re.findall(r"[a-z0-9]+", re.sub(r"\[[^\]]*\]", " ", s.lower()).replace("'", ""))
    return difflib.SequenceMatcher(None, words(text), words(heard)).ratio(), heard.strip()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--chars", required=True, help="ids separate prin virgulă, sau 'all'")
    ap.add_argument("--kinds", default="", help="filtrează după tip (win,quip,kill,bye,menu_fight,menu_idle,hero_*,announcer)")
    ap.add_argument("--device", default="auto")
    ap.add_argument("--check", action="store_true", help="verifică cu whisper și re-încearcă (max 4 încercări)")
    ap.add_argument("--force", action="store_true")
    a = ap.parse_args()

    lines = json.loads((HERE / "lines.json").read_text())
    chars = list(lines) if a.chars == "all" else a.chars.split(",")
    kinds = [k for k in a.kinds.split(",") if k]

    import torch
    from omnivoice import OmniVoice
    dev = a.device
    if dev == "auto":
        dev = "cuda:0" if torch.cuda.is_available() else ("mps" if torch.backends.mps.is_available() else "cpu")
    print(f"Loading OmniVoice on {dev}...")
    model = OmniVoice.from_pretrained("k2-fsa/OmniVoice", device_map=dev, dtype=torch.float32)

    for cid in chars:
        if cid not in lines:
            sys.exit(f"personaj necunoscut: {cid}")
        wav, txt = REF / f"{cid}.wav", REF / f"{cid}.txt"
        if not (wav.exists() and txt.exists()):
            sys.exit(f"lipsește referința {wav} (rulează prepare_refs.sh)")
        prompt = model.create_voice_clone_prompt(ref_audio=str(wav), ref_text=txt.read_text().strip())
        d = OUT / cid
        d.mkdir(parents=True, exist_ok=True)
        todo = [l for l in lines[cid] if not kinds or any(l["kind"] == k or l["kind"].startswith(k.rstrip("*")) and k.endswith("*") for k in kinds)]
        print(f"== {cid}: {len(todo)} replici")
        t0 = time.time()
        for l in todo:
            f = d / f"{l['id']}.wav"
            if f.exists() and not a.force:
                continue
            best = None
            for k in range(4 if a.check else 1):
                torch.manual_seed(17 + k); np.random.seed(17 + k)
                x = trim(np.asarray(model.generate(text=l["text"], voice_clone_prompt=prompt)[0], dtype=np.float32))
                if not a.check:
                    best = (1.0, x, "")
                    break
                s, heard = heard_score(x, l["text"])
                if best is None or s > best[0]:
                    best = (s, x, heard)
                if s >= 0.8:
                    break
            sf.write(f, best[1], SR)
            note = "" if not a.check else f"  whisper {best[0]:.2f} \"{best[2]}\""
            print(f"  {l['id']:<16} {len(best[1]) / SR:4.1f}s  {l['text']}{note}")
        print(f"   ({time.time() - t0:.0f}s)")


if __name__ == "__main__":
    main()
