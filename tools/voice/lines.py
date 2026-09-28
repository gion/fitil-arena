"""Setul comun de replici pentru compararea modelelor TTS.

Etichetele neutre ({laugh}, {sigh}, {gasp}, {scream}, {groan}) sunt traduse de fiecare script
în sintaxa modelului lui, sau scoase dacă modelul nu le suportă.
"""

import re

# (nume fișier, text, emoție pentru modelele cu control explicit)
LINES = [
    ("bye_bye", "{sigh} Bye bye...", "sad"),
    ("bye_bye_drama", "Bye byeee! {scream}", "fear"),
    ("ouch", "Ouch!", "pain"),
    ("oh_no", "{gasp} Oh no!", "fear"),
    ("not_fair", "Not fair! {groan}", "anger"),
    ("my_mustache", "My mustache!", "fear"),
    ("lightning", "I'm lightning!", "happy"),
    ("legend", "I'm a legend! {laugh}", "happy"),
    ("too_easy", "Too easy! {laugh}", "happy"),
    ("hurry_up", "Hurry up! The arena is shrinking!", "surprise"),
]


def render(text: str, tags: dict[str, str]) -> str:
    """Înlocuiește etichetele neutre; cele necunoscute modelului dispar."""
    out = re.sub(r"\{(\w+)\}", lambda m: tags.get(m.group(1), ""), text)
    return re.sub(r"\s+", " ", out).strip()
