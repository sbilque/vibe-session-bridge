# Appendix D — Test strategy and results

Languages: **English** | [Français](../../fr/appendices/D-tests.md)

Back to: [README](../../../README.md) · Related ADR: [0007](../adr/0007-integration-tests-real-vibe.md)

### Integration tests (real Vibe session)

`test/integration/` runs a real `vibe-acp` (agent loop, tools, persistence) driven by the real bridge code (`src/`). Only VS Code (`vscode-host.ts`, stable and proposed API) and, by default, the model (`mock-llm.ts`, an SSE `/v1/chat/completions` server declared as a `backend = "generic"` provider, as in mistral-vibe `tests/e2e`) are simulated.

```bash
npm run test:integration           # simulated model, unified harness then --legacy-harness
npm run test:integration:mistral   # real Mistral API (~/.vibe config, key or subscription)
IT_VERBOSE=1 npm run test:integration   # bridge logs
```

| Test | Checks |
|---|---|
| initialize | `loadSession`, `list/fork/close`, `vibe-setup` auth method |
| new session options | `mode`/`model`/`thinking` groups through the pre-created session |
| text turn | `session/prompt` → `stream.markdown`, `stopReason = end_turn` |
| bash + permission granted | carousel with Vibe options, command shown, output, VS Code terminal (legacy) |
| bash + permission denied | file not created, `isConfirmed = false` |
| auto-approve mode | option applied at request time, no permission prompt |
| user question | `ask_user_question` → `elicitation/create` → carousel → answers received by the model |
| cancellation | `session/cancel` on `sleep 30`, `stopReason = cancelled` |
| fork | `session/fork` after some exchanges |
| list + reload | `session/list`, new process, `session/load` → history (tools included), new turn |

Findings from these tests (Vibe 2.26.1):
- Default "Unified Harness" engine: the shell runs inside Vibe, **without** `terminal/create`; output arrives in `tool_call_update`, but **with no exit code** (`rawOutput` = `stdout`, `stderr`, `output`, `truncated`), and `exit 3` is reported as `completed`.
- `--legacy-harness` (`vibeBridge.args` setting): shell delegated to the VS Code ACP terminal, exit code available; additional `plan` mode.
- Permission options: `Allow once`, `Allow for remainder of this session`, `Always allow`, `Deny`.
- `browser-auth` is not advertised when a key is configured.
- `ask_user_question` schema uses camelCase (`multiSelect`, `footerNote`, `hideOther`).
- Fix found by the tests: `vibe-acp` survived SIGTERM; shutdown now closes stdin, then sends SIGTERM, then SIGKILL after 2 s.


### Tests added during the audit

| Test | Checks |
|---|---|
| slash command | `request.command` → `/help` executed by Vibe without calling the model |
| references | pasted text and selection (`Location`) sent as embedded content, range only |
| image | `ChatReferenceBinaryData` → `image` `ContentBlock` received by the model (`supports_images = true`) |
| incoming delegation | `ChatContext.history` injected on the first turn only |
| Continue in… | `workbench.action.chat.delegateToAgentHostSession` command, `agent-host-claude` type, VS Code transcript format |
| changed files and usage | `ChatSessionItem.changes` (+3 −0), context badge, `timing.lastRequestEnded` |
| rename / delete | extension methods `_session/set_title`, `_session/delete` |

0.1.0 result: 17/17 per engine (unified and legacy), i.e. 34/34; unit tests 12/12.

### What has not been tested

These results are not a validation: VS Code and the model are simulated.

- Never run in VS Code Insiders: Chat rendering, menus, Session Target picker, real proposed APIs.
- No exchange with the Mistral API (`npm run test:integration:mistral` never run, no key available).
- "Continue in…" VS Code commands: only the call is checked, not its effect.
- Linux only; not Windows, WSL or macOS.
