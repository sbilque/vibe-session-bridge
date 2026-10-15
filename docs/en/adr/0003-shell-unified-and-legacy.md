# ADR 0003 — Shell engine: Unified Harness by default, ACP terminal as an option

Languages: **English** | [Français](../../fr/adr/0003-shell-unified-and-legacy.md)

- Status: Accepted (not validated in real conditions)
- Date: 2026-10-13
- Version: 0.1.0 (development)

## Context

Vibe 2.26.1 has two engines. By default (Unified Harness), the shell runs inside Vibe, without `terminal/create` and without an exit code (`rawOutput` = `stdout`, `stderr`, `output`, `truncated`). With `--legacy-harness`, the shell is delegated to the client's ACP terminal and the `plan` mode appears.

## Decision

Fully implement the ACP terminal on the VS Code side (`terminal/create`, `output`, `wait_for_exit`, `kill`, `release`, `Pseudoterminal` mirror), advertise the `terminal` capability, but keep Vibe's default engine. The choice is made with `vibeBridge.args: ["--legacy-harness"]`. Both engines are tested.

## Consequences

- Default: no exit code in the chat (documented Vibe limitation).
- Legacy: commands visible in the Terminal panel, exit code available, but this engine is expected to be retired by Vibe.

## Sources

[mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/app_server/_tool_io.py::run_shell`, `_effect_models.py`; appendix [D](../appendices/D-tests.md)
