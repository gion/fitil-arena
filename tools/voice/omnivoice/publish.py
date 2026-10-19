#!/usr/bin/env python3
"""Pune replicile generate în joc: wav -> mp3 mono (-16 LUFS) + manifestul pe care îl citește clientul.

    python3 tools/voice/omnivoice/publish.py            # toate personajele pentru care există fișiere
    python3 tools/voice/omnivoice/publish.py gugu zuzu  # doar acestea

Citește  tools/voice/out/omnivoice/<personaj>/<id>.wav  și  tools/voice/omnivoice/lines.json
Scrie    apps/client/public/voice/<personaj>/<id>.mp3  și  apps/client/public/voice/manifest.json
         { "characters": { "<personaj>": { "<text exact din joc>": ["voice/<personaj>/<id>.mp3", ...] } } }
"""
import json, subprocess, sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
OUT = HERE.parent / "out" / "omnivoice"
PUB = ROOT / "apps" / "client" / "public" / "voice"

# Replicile pe care jocul le cere cu alt text decât cel din content (vezi apps/client/src/app.ts)
KEY_OVERRIDE = {"bye": "Bye bye!"}


def to_mp3(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(src), "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ac", "1", "-ar", "44100", "-c:a", "libmp3lame", "-q:a", "5", str(dst)], check=True)


def main() -> None:
    lines = json.loads((HERE / "lines.json").read_text())
    only = sys.argv[1:] or list(lines)
    manifest = json.loads((PUB / "manifest.json").read_text()) if (PUB / "manifest.json").exists() else {"characters": {}}
    for cid in only:
        chars: dict[str, list[str]] = {}
        n = 0
        for l in lines[cid]:
            wav = OUT / cid / f"{l['id']}.wav"
            if not wav.exists():
                continue
            mp3 = PUB / cid / f"{l['id']}.mp3"
            if not mp3.exists() or mp3.stat().st_mtime < wav.stat().st_mtime:
                to_mp3(wav, mp3)
            key = KEY_OVERRIDE.get(l["kind"], l["key"])
            chars.setdefault(key, []).append(f"voice/{cid}/{l['id']}.mp3")
            n += 1
        if chars:
            manifest["characters"][cid] = chars
        print(f"  {cid}: {n}/{len(lines[cid])} replici")
    (PUB / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1) + "\n")
    print(f"manifest: {PUB / 'manifest.json'}")


if __name__ == "__main__":
    main()
