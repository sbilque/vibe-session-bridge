# ADR 0004 — Permissions et questions de Vibe dans l'interface native du Chat

Langues : [English](../../en/adr/0004-permissions-and-elicitation.md) | **Français**

- Statut : Acceptée (non validée en conditions réelles)
- Date : 2026-10-13
- Version : 0.1.0 (développement)

## Contexte

Vibe demande des permissions (`session/request_permission`, options `Allow once`, `Allow for remainder of this session`, `Always allow`, `Deny`) et pose des questions (`ask_user_question` via `elicitation/create`, actif seulement si le client annonce `elicitation.form`).

## Décision

Permissions : outil interne `vscode_get_confirmation_with_options`, comme Copilot CLI (`permissionHelpers.ts`), repli sur `stream.questionCarousel`. Questions : annoncer `elicitation.form` et convertir le schéma JSON en `questionCarousel`. Format des réponses repris de `chatQuestionCarouselPart.ts` (`{selectedValue, freeformValue}`, `{selectedValues, freeformValue}`). « Passer » → `cancel`, question requise vide → `decline`, mode `url` non annoncé.

## Conséquences

- Réponses validées par le code Python de Vibe (`_elicit_user_answers`) dans les tests unitaires.
- Désactivable : `vibeBridge.elicitation.enabled`.

## Sources

[mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/acp/agent.py::_supports_user_input` ; [microsoft/vscode](https://github.com/microsoft/vscode) `chatQuestionCarouselPart.ts`
