# Appendix G — Plan: full audit of vibe-session-bridge and 0.1.0 delivery (untested)

Languages: **English** | [Français](../../fr/appendices/G-audit-plan.md)

Back to: [README](../../../README.md) · [ADR](../adr/README.md)

## Phase 1 — Reference sources (sources only, nothing invented)
1. **VS Code / Copilot** (`microsoft/vscode@main`):
   - Claude/Copilot "Continue In" mechanism: where it is declared, which API, what is transferred (history, files, session option);
   - proposed APIs `chatSessionsProvider`, `chatParticipantAdditions`, `chatParticipantPrivate`: full list of members;
   - Copilot CLI `chatSessions` contribution (`extensions/copilot/package.json`): fields used (commands, capabilities, when…).
2. **ACP** (`@agentclientprotocol/sdk` 1.8.0): list of all agent/client methods and all `SessionUpdate` variants.
3. **Vibe 2.26.1** (`vibe/acp/*.py`): methods actually implemented, notifications sent, capabilities advertised, `_meta` read.

## Phase 2 — Coverage matrix
For each element (ACP method, notification, capability, VS Code API member, Claude feature): used by Vibe? / available in VS Code? / implemented in the bridge? / tested? → list of gaps, classified:
- **A** useful and feasible with real APIs → fix;
- **B** partially feasible → fix with a documented limitation;
- **C** not possible (internal API, not exposed by Vibe) → document.

## Phase 3 — "Continue In"
Compare the Claude flow (handoff from a local session to another target, and back) with what the extension API and ACP allow. Implement the realistic equivalent if there is one (e.g. handoff contribution, history through `ChatContext.history`, `session/load`), otherwise document.

## Phase 4 — Fixes
Implement the A/B items, each linked to its source (file + function) in a comment.

## Phase 5 — Checks
`tsc --strict`, unit tests, integration tests on both Vibe engines, new tests for each fix, smoke test.

## Phase 6 — Delivery
`vibe-session-bridge-<version>.tar.gz`: sources, tests, scripts, built `.vsix`, `README.md`, `MODE-EMPLOI.md`, `PREREQUIS.md`, `COMPARAISON.md`, `AUDIT.md` (matrix), `CHANGELOG.md`.

These files have since been reorganized into ADRs and appendices (`docs/en/`, `docs/fr/`).
