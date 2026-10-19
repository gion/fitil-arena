#!/usr/bin/env bash
# Rulează gen.py cu venv-ul OmniVoice din glimpse-studio (torch + omnivoice + faster-whisper deja instalate acolo;
# modelul k2-fsa/OmniVoice e în cache-ul global Hugging Face, deci nu se descarcă din nou).
#   tools/voice/omnivoice/run.sh --chars gugu,zuzu --kinds win,quip
set -euo pipefail
py="${OMNIVOICE_PYTHON:-/private/var/www/glimpse-studio/.venv/bin/python}"
[ -x "$py" ] || { echo "Nu găsesc $py. Setează OMNIVOICE_PYTHON la un python cu omnivoice instalat." >&2; exit 1; }
exec "$py" "$(dirname "$0")/gen.py" "$@"
