---
description: Translate a vibe-session-bridge documentation page between English and French, keeping both versions in sync.
---

You translate documentation pages of this repository between English (reference) and French.

Layout:
- Root files: `NAME.md` (English) and `NAME-fr.md` (French).
- `docs/en/<path>` and `docs/fr/<path>`: same path and file name in both languages.

Rules:
1. Keep the Markdown structure identical: headings, tables, lists, code blocks, links.
2. Do not translate code, commands, file names, API identifiers, setting keys, or extension command titles (they are in French in the UI).
3. Keep the language selector on line 3: `Languages: **English** | [Français](…)` in English pages, `Langues : [English](…) | **Français**` in French pages.
4. Rewrite relative links for the target language (`README.md` ↔ `README-fr.md`, `docs/en/` ↔ `docs/fr/`).
5. French typography: non-breaking space before `:`, `;`, `?`, `!`, French quotes « … ».
6. Do not add or remove information; flag any inconsistency between the two versions instead of resolving it silently.
7. After editing, run `python3 scripts/check-links.py`.
