# ADR 0007 — Integration tests with a real vibe-acp and a simulated model

Languages: **English** | [Français](../../fr/adr/0007-integration-tests-real-vibe.md)

- Status: Accepted (not validated in real conditions)
- Date: 2026-10-13
- Version: 0.1.0 (development)

## Context

The bridge depends on Vibe's actual behavior, which sometimes differs from the ACP specification (no exit code, camelCase schema, `_` prefix). Tests against a fake agent would not have revealed this. VS Code cannot run headless in the CI environment.

## Decision

Run the real `vibe-acp` driven by the real `src/` code. Only VS Code (`test/integration/vscode-host.ts`) and the model (`mock-llm.ts`, an SSE `/v1/chat/completions` server declared as `backend = "generic"`, like Vibe's e2e tests) are simulated. Every scenario runs on both engines. Optional mode against the real Mistral API (`test:integration:mistral`).

## Consequences

- Deterministic, no key or network needed.
- Rendering in VS Code still has to be validated manually.
- The simulator must follow Vibe's tool schemas (e.g. `path` in unified, `file_path` in legacy for `write_file`).

## Sources

[mistral-vibe](https://github.com/mistralai/mistral-vibe) `tests/e2e`; appendix [D](../appendices/D-tests.md)
