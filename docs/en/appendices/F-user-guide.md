# Appendix F — User guide — vibe-session-bridge 0.1.0 (development, untested)

Languages: **English** | [Français](../../fr/appendices/F-user-guide.md)

Back to: [README](../../../README.md) · [ADR](../adr/README.md)

> Development version, not tested in VS Code: these steps describe the intended behavior, not a verified one.

## 1. Install

```bash
git clone https://github.com/sbilque/vibe-session-bridge.git && cd vibe-session-bridge
npm install && npm run package
code-insiders --install-extension vibe-session-bridge-0.1.0.vsix
```

Enable the proposed APIs: Command Palette, "Preferences: Configure Runtime Arguments", then in `argv.json`:

```jsonc
{ "enable-proposed-api": ["local.vibe-session-bridge"] }
```

Fully restart VS Code Insiders.

## 2. Configure (`settings.json`)

| Setting | Default | Purpose |
|---|---|---|
| `vibeBridge.enabled` | `true` | Shows "Mistral Vibe" in the Session Target picker |
| `vibeBridge.command` | `vibe-acp` | Executable (absolute path recommended on macOS) |
| `vibeBridge.args` | `[]` | `["--legacy-harness"]`: shell goes through the VS Code terminal, exit code visible, `plan` mode |
| `vibeBridge.env` | `{}` | Extra variables; empty = `~/.vibe/.env` |
| `vibeBridge.terminal.enabled` | `true` | ACP `terminal` capability |
| `vibeBridge.terminal.reveal` | `onCreate` | Mirrors commands in the Terminal panel (`never` to hide) |
| `vibeBridge.elicitation.enabled` | `true` | Vibe questions (`ask_user_question`) in the chat |

## 3. Sign in

Command Palette, "Mistral Vibe: Se connecter (abonnement)" (sign in with your subscription). The bridge first reads the actual status (`auth/status`): if you are already signed in, it only offers to switch accounts. Otherwise it offers browser sign-in to your Mistral account, or a terminal running `vibe-acp --setup`. "Mistral Vibe: Se déconnecter" (sign out) revokes the account sign-in; with a key in `~/.vibe/.env`, remove it by hand.

The extension UI is currently in French only; command names are given as they appear.

## 4. Work with Vibe

1. Chat (`Ctrl+Alt+I` / `⌃⌘I`), "New Chat (+)", Session Target "Mistral Vibe".
2. Below the input: mode (`ask`, `accept-edits`, `auto-approve`, plus `plan` in legacy), model, thinking.
3. Context: drop files, a selection (only the excerpt is sent), pasted text or an image.
4. Commands: type `/` for `help`, `compact`, `reload`, `log`, `mcp`, `teleport`, `retry`, `data-retention`. Type skills in full (`/my-skill`).
5. Answer the permissions and questions shown in the chat.

In the session list (item menu): "Continuer dans…" (continue in), "Renommer" (rename), "Supprimer" (delete). The item shows changed files (+/−) and context usage.

## 5. Continue elsewhere

From a Vibe session: session menu, or Command Palette "Mistral Vibe: Continuer dans…". Choose the target (local Chat, Copilot CLI, Copilot Cloud, Claude, Codex, Copilot Agent Host), then the instruction (default "implement this.", as in VS Code). The target receives the `User:` / `Assistant:` transcript (last 20,000 characters).

To Vibe:
- from the editor: right-click, "Mistral Vibe: Continuer dans Mistral Vibe" (selection or file);
- to Vibe Code Web: `/teleport` command in the session;
- if a conversation is handed to Vibe with its history, the history is injected into the first message.

## 6. Build and test

```bash
npm install
npm run dts                  # proposed .d.ts files from microsoft/vscode
npm run check                # tsc --strict
npm test                     # 12 unit tests
npm run test:integration     # 17 tests x 2 engines (unified, legacy), real vibe-acp + simulated model
npm run test:integration:mistral   # optional: real Mistral API (MISTRAL_API_KEY)
npm run package              # builds vibe-session-bridge-0.1.0.vsix
```

## 7. Troubleshooting

| Symptom | Fix |
|---|---|
| `spawn vibe-acp ENOENT` | Absolute path in `vibeBridge.command` |
| "Mistral Vibe" missing from the picker | `argv.json`, then restart Insiders |
| `-32000 Missing API key` | "Se connecter" or `vibe --setup` |
| Claude/Codex target "unavailable" | Agent Host not enabled in your build |
| Image ignored | `supports_images = true` on the active model |
| Rename/Delete: `-32601` | Vibe older than 2.26: update it |
| Fork refused (`-32602`) | Send at least one message first |
| Logs | "Mistral Vibe: Afficher les journaux ACP" (show ACP logs) |
