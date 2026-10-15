# Appendix C — ACP ↔ VS Code mapping

Languages: **English** | [Français](../../fr/appendices/C-acp-vscode-mapping.md)

Back to: [README](../../../README.md) · [ADR](../adr/README.md)

### What was studied

| Source | Elements used |
|---|---|
| [mistralai/mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/acp/agent.py` | `initialize`: capabilities `loadSession`, `sessionCapabilities.{list,fork,close}`, `promptCapabilities.{image,embeddedContext}`; `set_config_option` for `mode`, `model`, `thinking`; `request_permission`; reading/writing through `fs/*` if the client advertises it |
| `vibe/acp/auth.py` | `browser-auth` (sign-in to the Mistral account, hence the subscription) and `browser-auth-delegated` methods |
| `agent.py::initialize` | `vibe-setup` (TerminalAuthMethod) is only advertised if `clientCapabilities._meta["terminal-auth"] === true`; command provided in `_meta["terminal-auth"]` |
| `pyproject.toml` | Entry point `vibe-acp = vibe.acp.entrypoint:main`, dependency `agent-client-protocol==0.11.0` |
| [microsoft/vscode](https://github.com/microsoft/vscode) `src/vscode-dts/vscode.proposed.chatSessionsProvider.d.ts` | `createChatSessionItemController`, `newChatSessionItemHandler`, `forkHandler`, `getChatSessionInputState`, `registerChatSessionContentProvider` |
| `chatSessions.contribution.ts` | `chatSessions` extension point (required fields `type`, `name`, `displayName`, `description`), rejected if `chatSessionsProvider` is not enabled |
| [microsoft/vscode-copilot-chat](https://github.com/microsoft/vscode-copilot-chat) `src/extension/chatSessions/vscode-node/chatSessions.ts`, `claudeChatSessionContentProvider.ts`, `chatHistoryBuilder.ts` | Participant + content provider + controller pattern; history through `ChatRequestTurn2`/`ChatResponseTurn2`; tools through `ChatToolInvocationPart`; `enabledApiProposals: chatSessionsProvider@3, chatParticipantAdditions, chatParticipantPrivate` |
| [@agentclientprotocol/sdk 1.8.0](https://www.npmjs.com/package/@agentclientprotocol/sdk) | `ClientSideConnection`, `ndJsonStream`, `PROTOCOL_VERSION = 1`, code `auth_required = -32000` |


### ACP ↔ VS Code mapping

| ACP (Vibe) | VS Code |
|---|---|
| `initialize` + `_meta.terminal-auth` | Startup, "Sign in" command |
| `authenticate("browser-auth")` | Mistral subscription sign-in (browser opened by Vibe) |
| `vibe-setup` method | VS Code terminal running `vibe-acp --setup` |
| `session/new` | `newChatSessionItemHandler` (Session Target picker) |
| `session/list` | `refreshHandler` (session list) |
| `session/load` + `session/update` replay | `provideChatSessionContent` → history |
| `session/fork` (unstable in the TS SDK) | `forkHandler` |
| `configOptions` (`mode`, `model`, `thinking`) / `session/set_config_option` | `ChatSessionInputState.groups` (pickers below the input) |
| `session/prompt` (text + `resource_link`) | `ChatRequest.prompt` + `#file` references |
| `agent_message_chunk` / `agent_thought_chunk` | `stream.markdown` / `ChatResponseThinkingProgressPart` |
| `tool_call` / `tool_call_update` | `ChatToolInvocationPart` |
| `plan` | Markdown checklist |
| `session/request_permission` | internal tool `vscode_get_confirmation_with_options` (as in Copilot CLI), `stream.questionCarousel` fallback |
| `elicitation/create` (`form` mode) | `stream.questionCarousel`: `string`+`oneOf` → single choice, `array`+`items.anyOf` → multiple choice, free text allowed; `boolean`, `number`, `integer`, text |
| `session/cancel` | Chat `CancellationToken` |
| `fs/read_text_file` / `fs/write_text_file` | open buffer (including unsaved changes) / `WorkspaceEdit` |
| `terminal/create` | Node process (default shell `vscode.env.shell` if no `args`) + `Pseudoterminal` mirror in the Terminal panel |
| `terminal/output` | stdout+stderr output, `outputByteLimit` truncated from the start on a UTF-8 boundary, `exitStatus` |
| `terminal/wait_for_exit` / `terminal/kill` | wait for completion / stop the process group (SIGTERM then SIGKILL, `taskkill /T` on Windows) |
| `terminal/release` | id invalidated for the agent, output kept for display |
| `tool_call` kind `execute` + `rawInput.command` | `ChatTerminalToolInvocationData` (command, output from deltas, exit code from the client terminal) |

The 0.1.0 additions (embedded content, images, slash commands, changed files, usage badge, extension methods) are listed in [appendix A](A-coverage-audit.md).


### ACP terminal

Vibe advertises its use in `vibe/acp/agent.py` (client `terminal` capability → `bash`, `git_bash`, `windows_shell` tools through the client terminal) and calls it in `vibe/app_server/_tool_io.py::run_shell`: `create(command=<shell line>, args=None, cwd, output_byte_limit)` → `wait_for_exit` (agent-side timeout, `kill` if exceeded) → `output` → `release`.

Settings: `vibeBridge.terminal.enabled` (default `true`) and `vibeBridge.terminal.reveal` (`onCreate` | `never`).

`npm test`: 7 tests (shell line + exit code, direct args, UTF-8 truncation, kill with children, release, session isolation + ENOENT, cancellation).


### User questions (ACP elicitation)

Vibe only enables its interactive tools (`ask_user_question`) if the client advertises `clientCapabilities.elicitation.form` (`vibe/acp/agent.py::_supports_user_input`; otherwise `NON_INTERACTIVE_DISABLED_TOOLS`). The bridge advertises it (setting `vibeBridge.elicitation.enabled`, default `true`) and shows the questions in a `questionCarousel`.

| VS Code answer | ACP answer | Effect in Vibe |
|---|---|---|
| Complete answers | `accept` + `content` | `UserQuestionResult` (`is_other` for free text) |
| "Skip" | `cancel` | `deny_callback` |
| Empty required question | `decline` | `deny_callback` (avoids the "empty string/array" error) |
| `url` mode | `decline` | not advertised by the bridge |

`test/elicitation.test.ts` uses the schema produced by Vibe's `_build_elicitation_schema` and has the answers validated by Vibe's `_elicit_user_answers`.
