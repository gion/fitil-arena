#!/usr/bin/env bash
# Convertește seed-urile descărcate din ElevenLabs (~/Downloads/<nume>.mp3) în referințe pentru clonare:
# tools/voice/ref/<personaj>.wav (24 kHz mono) + <personaj>.txt (textul exact al seed-ului).
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
src="${SEED_DIR:-$HOME/Downloads}"
ref="$here/../ref"
mkdir -p "$ref"
python3 - "$here/seeds.json" "$src" "$ref" <<'PY'
import json, subprocess, sys
from pathlib import Path
seeds, src, ref = json.load(open(sys.argv[1])), Path(sys.argv[2]), Path(sys.argv[3])
for cid, s in seeds.items():
    mp3 = src / f"{s['download']}.mp3"
    if not mp3.exists():
        print(f"  ! lipsește {mp3}")
        continue
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", str(mp3), "-ac", "1", "-ar", "24000", str(ref / f"{cid}.wav")], check=True)
    (ref / f"{cid}.txt").write_text(s["seedText"] + "\n")
    print(f"  {cid}: {mp3.name} -> ref/{cid}.wav")
PY
