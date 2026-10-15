# ADR 0006 — Vibe extension methods prefixed with "_"

Languages: **English** | [Français](../../fr/adr/0006-vibe-extension-methods.md)

- Status: Accepted (not validated in real conditions)
- Date: 2026-10-13
- Version: 0.1.0 (development)

## Context

Vibe implements, outside the specification, `auth/status`, `auth/signOut`, `session/set_title`, `session/delete` (`agent.py::ext_method`). The TypeScript SDK sends the name as is; the Python router (`acp/router.py`) only treats a name starting with `_` as an extension, and strips it. Without the prefix, Vibe answers `-32601 Method not found` (observed in tests).

## Decision

Call `extMethod('_auth/status')`, `'_auth/signOut'`, `'_session/set_title'`, `'_session/delete'`. They provide sign-in status, sign-out, renaming and deleting sessions (`chat/chatSessions` menu, as in Copilot CLI).

## Consequences

- Dependency on non-standard methods: covered by integration tests.
- Error `-32601` means Vibe is too old (troubleshooting, appendix F).

## Sources

[mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/acp/agent.py`; Python package `acp/router.py`
