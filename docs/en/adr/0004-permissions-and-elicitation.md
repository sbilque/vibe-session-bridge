# ADR 0004 — Vibe permissions and questions in the native Chat UI

Languages: **English** | [Français](../../fr/adr/0004-permissions-and-elicitation.md)

- Status: Accepted (not validated in real conditions)
- Date: 2026-10-13
- Version: 0.1.0 (development)

## Context

Vibe asks for permissions (`session/request_permission`, options `Allow once`, `Allow for remainder of this session`, `Always allow`, `Deny`) and asks questions (`ask_user_question` via `elicitation/create`, enabled only if the client advertises `elicitation.form`).

## Decision

Permissions: internal tool `vscode_get_confirmation_with_options`, as in Copilot CLI (`permissionHelpers.ts`), falling back to `stream.questionCarousel`. Questions: advertise `elicitation.form` and convert the JSON schema into a `questionCarousel`. Answer format taken from `chatQuestionCarouselPart.ts` (`{selectedValue, freeformValue}`, `{selectedValues, freeformValue}`). Skip → `cancel`, empty required question → `decline`, `url` mode not advertised.

## Consequences

- Answers validated by Vibe's Python code (`_elicit_user_answers`) in unit tests.
- Can be disabled: `vibeBridge.elicitation.enabled`.

## Sources

[mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/acp/agent.py::_supports_user_input`; [microsoft/vscode](https://github.com/microsoft/vscode) `chatQuestionCarouselPart.ts`
