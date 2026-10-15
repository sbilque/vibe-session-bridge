# Appendix B — Review: vibe-session-bridge vs Claude / Copilot CLI in VS Code, and vs the Mistral Vibe code

Languages: **English** | [Français](../../fr/appendices/B-claude-copilot-comparison.md)

Back to: [README](../../../README.md) · [ADR](../adr/README.md)

References read (October 13, 2026):
- `microsoft/vscode@10c7c9e` (main): Copilot Chat now lives in `extensions/copilot/`; the `microsoft/vscode-copilot-chat` repository has not been updated since May 2026.
- `mistral-vibe` 2.26.1 (PyPI), `vibe/acp/` folder, plus `vibe/app_server/_tool_io.py`, `_effect_models.py`.

## 1. Where Claude lives today

| Version | Claude implementation | Usable by a third-party extension |
|---|---|---|
| Copilot Chat ≤ May 2026 | `src/extension/chatSessions/vscode-node/claudeChatSessionContentProvider.ts` (`chatSessionsProvider` API) | Yes (same proposed API) |
| `microsoft/vscode` main | `IAgent` harness in the Agent Host: `src/vs/platform/agentHost/node/claude/` (`claudeAgent.ts`, `claudeCanUseTool.ts`, `claudeTerminalOutput.ts`…) | **No**: agents built into the core (claude, codex, copilot), no extension point and no ACP harness |

Consequence: an extension cannot copy Claude as is. The reference that still applies to extensions is **Copilot CLI** (`extensions/copilot/src/extension/chatSessions/vscode-node/copilotCLIChatSessions.ts`, `chatSessions` contribution of type `copilotcli`), which uses the same API as this bridge. The `.d.ts` files for `chatSessionsProvider`, `chatParticipantAdditions` and `chatParticipantPrivate` are identical between `main` and the project (empty diff).

## 2. Gaps found against Copilot CLI and fixes

| # | Copilot CLI (reference) | Before the review | Fix |
|---|---|---|---|
| 1 | `getChatSessionInputState` builds option groups **before** the session exists (no resource) | Empty groups for a new session | ACP session pre-created: its `configOptions` feed the picker; consumed by `newChatSessionItemHandler`, then replaced |
| 2 | Options read **at request time** (`getSelectedSessionOptions(chatSessionContext.inputState)`) | Sent on `onDidChange` | `applyOptions()` before each `session/prompt` → `session/set_config_option` |
| 3 | `newChatSessionItemHandler`: label = `prompt` or `command` | Truncated prompt | Aligned |
| 4 | History: `new ChatRequestTurn2(prompt, undefined, [], '', [], [], …)` (`chatHistoryBuilder.ts`) | `participant = SCHEME`, `editedFileEvents = undefined` | Aligned; thinking and tool parts added to history |
| 5 | Completed tools: `isComplete`, `isError`, `isConfirmed` (`processToolExecutionComplete`) | `isConfirmed` missing | Added (`false` if the user refused) |
| 6 | Shell: `ChatTerminalToolInvocationData` with `language: 'bash'` / `'powershell'`, output `\n → \r\n`, `state.exitCode` | `'sh'` / `'pwsh'`, no conversion | Aligned |
| 7 | Permissions: `vscode.lm.invokeTool('vscode_get_confirmation' …, toolInvocationToken)` (`permissionHelpers.ts`) | `questionCarousel` only | Internal tool `vscode_get_confirmation_with_options` (buttons = ACP options), falling back to `questionCarousel` if it is not exposed to the extension |

## 3. Gaps found against the actual Vibe code and fixes

| # | Finding in Vibe 2.26.1 | Impact before the review | Fix |
|---|---|---|---|
| A | Shell tools **do not send** a `terminal` `ToolCallContent` (`TerminalToolCallContent` only appears in the `teleport` command) | Terminal ↔ tool call linking never triggered | Command read from `rawInput.command` (`ShellEffectInput`); output accumulated from text `content` deltas (`_effect_progress_updates`) |
| B | `ShellEffectOutput` = `stdout`, `stderr`, `output`, `truncated`: **no exit code** | Exit code missing | Taken from the client ACP terminal that ran the same command (`lastExitCode`) |
| C | `request_permission` only sends `ToolCallUpdate(toolCallId)`, without a title (`agent.py::_answer_callback`) | Title always generic | Title and command recovered from `tool_call` tracking |
| D | `fork_session` requires a session **loaded in the process** (`self._get_session`) | Failure on a session listed but not opened | `ensureLive()` → `session/load` before forking |
| E | Forking a session with no message: `-32602 Session not found` (observed in tests) | Raw error | Explicit message |
| F | `ForkSessionParams.message_id` exists | Not used | Left as is: a VS Code request id is not a Vibe message id, so the whole session is forked |
| G | `close_session` advertised (`sessionCapabilities.close`); **stable** `closeSession` method in the TS SDK | Not used | Pre-created session closed on deactivation |
| H | `load_session` replays history (`replay_session_updates`): messages, thinking, `tool_call` | Only text was rebuilt | Thinking and tools included |

## 4. ACP calls checked in `vibe/acp/agent.py`

| Bridge call | Vibe method | Checked by a real test |
|---|---|---|
| `initialize` + `_meta.terminal-auth` | `initialize` | Yes |
| `authenticate` | `authenticate` (`browser-auth`, `browser-auth-delegated`, `vibe-setup`) | `-32000` path, yes |
| `newSession` | `new_session` | Yes |
| `loadSession` | `load_session` | No (requires a session with messages) |
| `listSessions` | `list_sessions` | Yes |
| `unstable_forkSession` | `fork_session` | Yes (expected error on an empty session) |
| `closeSession` | `close_session` | Yes |
| `setSessionConfigOption` | `set_config_option` | Yes (`mode` accept-edits → ask, `thinking` high → off) |
| `prompt` / `cancel` | `prompt` / `cancel` | No (requires a valid key) |
| Client: `fs/*`, `request_permission`, `terminal/*` | `vibe/acp/tool_io.py`, `vibe/app_server/_tool_io.py::run_shell` | `terminal/*` through unit tests |

This table reflects the initial review. The integration tests in [appendix D](D-tests.md) later covered `loadSession`, `prompt` and `cancel` with a simulated model.

Notifications used, all sent by `vibe/acp/session_updates.py` or `agent.py`: `agent_message_chunk`, `agent_thought_chunk`, `user_message_chunk` (replay), `tool_call`, `tool_call_update`, `plan`, `config_option_update`, `session_info_update`.

## 5. What still differs from Claude in the core (after the audit)

- Native "Continue In": Vibe cannot be a menu target (`getAgentCanContinueIn` in `agentSessions.ts`). The bridge provides the same function through a command, with the same transcript format, in both directions (see [appendix A](A-coverage-audit.md)).
- No sub-agents (`subAgentInvocationId`): Vibe does not expose them over ACP.
- Elicitation: carousel answer format follows `chatQuestionCarouselPart.ts`.
- Slash commands: built-in ones declared statically; skills typed by hand (no dynamic command API for third-party types).
