# Instrucțiuni pentru agenți (orice LLM)

Instrucțiunile complete ale proiectului sunt în `CLAUDE.md` și se aplică oricărui agent (Claude, Codex, Cursor etc.), nu doar lui Claude. Citește-l înainte de orice task, împreună cu documentele pe care le indică.

## Jurnalul de prompturi (obligatoriu)

Orice interacțiune cu un LLM care schimbă ceva în proiect (cod, documente, configurație, asset-uri) sau ia o decizie se încheie cu o intrare nouă în `docs/prompt-log.md`. Scopul: un istoric al cererilor făcute agenților, util la debug ulterior.

- Intrarea nouă se pune **sus** (cele mai noi primele), în același commit cu schimbarea sau într-unul imediat după.
- Întrebările pur informative, fără schimbări, pot fi grupate într-o singură intrare sau omise dacă n-au dus la nicio decizie.
- Formatul:

```markdown
## AAAA-LL-ZZ — <agent și model> — <titlu scurt>

- **Cerut:** ce a cerut omul, cu contextul necesar (pe scurt, parafrazat).
- **Făcut:** ce s-a schimbat concret (fișiere, comportament) și commit-urile.
- **Verificat:** comenzile rulate și rezultatul (sau ce nu s-a putut verifica).
- **Notă operațională:** (opțional) pași manuali, capcane, lucruri de știut mai târziu.
```
