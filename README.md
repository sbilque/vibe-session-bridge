# vibe-session-bridge

Languages: **English** | [Français](README-fr.md)

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0--dev-orange.svg)](CHANGELOG.md)
[![Status](https://img.shields.io/badge/status-untested-red.svg)](#project-status)

VS Code extension that makes **Mistral Vibe** (`vibe-acp`) a native Chat **Session Target**, just like Copilot CLI or Claude. It speaks only the [Agent Client Protocol](https://agentclientprotocol.com) v1 on the agent side and the proposed `chatSessionsProvider` API on the VS Code side: no custom protocol.

## Project status

> **Status: development version 0.1.0, untested.**
> This code has not been run in VS Code nor against the real Mistral API. Only automated tests exist, and they simulate VS Code and the model (see [appendix D](docs/en/appendices/D-tests.md)). Real-world behavior is not guaranteed: use it for evaluation and contribution, not in production.

| Check | Done |
|---|---|
| `tsc --strict` build | Yes |
| Unit tests (terminal and question logic) | Yes |
| Integration tests with a real `vibe-acp`, **simulated** VS Code and model | Yes |
| Installation and use in VS Code Insiders | **No** |
| Exchanges with the real Mistral API (subscription or key) | **No** |
| Windows, WSL, macOS | **No** (Linux build environment only) |

Test feedback is welcome: [open an issue](https://github.com/sbilque/vibe-session-bridge/issues).

## Table of contents

- [Project status](#project-status)
- [Features](#features)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Usage](#usage)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Known limitations](#known-limitations)
- [Documentation](#documentation)
- [Contributing](#contributing)
- [License](#license)

## Features

Implemented features, not validated in real conditions:

- Vibe sessions in the Session Target picker: create, list, resume with history (thinking and tools included), fork, rename, delete.
- Pickers below the input: mode (`ask`, `accept-edits`, `auto-approve`, `plan` in legacy), model, thinking.
- Vibe permissions and questions shown in the native Chat UI.
- ACP terminal in the VS Code terminal (Vibe legacy engine).
- Context: files, selections (excerpt only), pasted text, images; Vibe slash commands.
- "Continue in…" to local Chat, Copilot CLI, Copilot Cloud, Claude, Codex, Copilot (Agent Host), and back to Vibe.
- Session list: changed files (+/−), context usage.
- Sign-in with a Mistral subscription or a key, actual status, sign-out.

## Prerequisites

Recent VS Code Insiders, GitHub Copilot Chat, Python ≥ 3.12, `mistral-vibe` 2.26.1 (`uv tool install mistral-vibe`), a Mistral account. Details: [appendix E](docs/en/appendices/E-prerequisites.md).

## Installation

1. Download `vibe-session-bridge-0.1.0.vsix` from the [releases](https://github.com/sbilque/vibe-session-bridge/releases), or build it (see [CONTRIBUTING](CONTRIBUTING.md)).
2. Install:
   ```bash
   code-insiders --install-extension vibe-session-bridge-0.1.0.vsix
   ```
3. Enable the proposed APIs: Command Palette, "Preferences: Configure Runtime Arguments", then in `argv.json`:
   ```jsonc
   { "enable-proposed-api": ["local.vibe-session-bridge"] }
   ```
4. Restart VS Code Insiders, then run "Mistral Vibe: Se connecter (abonnement)" (sign in).

The extension UI is currently in French only.

## Usage

1. Open the Chat, "New Chat (+)", Session Target "Mistral Vibe".
2. Choose mode, model and thinking, attach files, selections or images, type `/` for Vibe commands.
3. Session menu: "Continuer dans…" (continue in), "Renommer" (rename), "Supprimer" (delete).
4. Right-click in the editor: "Continuer dans Mistral Vibe".

Full guide and troubleshooting: [appendix F](docs/en/appendices/F-user-guide.md).

## Configuration

| Setting | Default | Purpose |
|---|---|---|
| `vibeBridge.enabled` | `true` | Shows "Mistral Vibe" in the picker |
| `vibeBridge.command` | `vibe-acp` | Executable (absolute path recommended on macOS) |
| `vibeBridge.args` | `[]` | `["--legacy-harness"]`: shell in the VS Code terminal, exit code, `plan` mode |
| `vibeBridge.env` | `{}` | Extra variables (empty = `~/.vibe/.env`) |
| `vibeBridge.terminal.enabled` | `true` | ACP `terminal` capability |
| `vibeBridge.terminal.reveal` | `onCreate` | Command mirror (`never` to hide) |
| `vibeBridge.elicitation.enabled` | `true` | Vibe questions in the chat |

## Architecture

```
VS Code Chat ── chatSessionsProvider ──> extension (src/) ── ACP v1 / stdio ──> vibe-acp (Mistral Vibe)
```

| Module | Role |
|---|---|
| `src/extension.ts` | Activation, commands |
| `src/acpAgent.ts` | `vibe-acp` process, ACP connection, authentication, `fs/*` client methods |
| `src/sessions.ts` | Session Target: items, history, `session/update` rendering, permissions |
| `src/prompt.ts` | `ChatRequest` → `ContentBlock[]`, delegation transcript |
| `src/continueIn.ts` | "Continue in…" in both directions |
| `src/terminals.ts` | ACP terminal (`terminal/*`) |
| `src/elicitation.ts` | `elicitation/create` → `questionCarousel` |

Architecture decisions are recorded as [ADRs](docs/en/adr/README.md). Appendices:

| Appendix | Content |
|---|---|
| [A](docs/en/appendices/A-coverage-audit.md) | Coverage audit (Continue In, API, ACP) |
| [B](docs/en/appendices/B-claude-copilot-comparison.md) | Comparison with Claude and Copilot CLI |
| [C](docs/en/appendices/C-acp-vscode-mapping.md) | ACP ↔ VS Code mapping, terminal, questions |
| [D](docs/en/appendices/D-tests.md) | Test strategy and results |
| [E](docs/en/appendices/E-prerequisites.md) | Prerequisites |
| [F](docs/en/appendices/F-user-guide.md) | User guide and troubleshooting |
| [G](docs/en/appendices/G-audit-plan.md) | Audit plan |

## Known limitations

- Proposed API: Insiders only, no Marketplace, may need rebuilding with each version.
- The native "Continue Chat in…" menu does not accept third-party types ([ADR 0005](docs/en/adr/0005-continue-in-via-commands.md)).
- Vibe default engine: no command exit code ([ADR 0003](docs/en/adr/0003-shell-unified-and-legacy.md)).
- Images only if the model has `supports_images = true`; Vibe skills without autocompletion.
- No sub-agents or archiving: not exposed by Vibe.

## Documentation

Documentation is available in English (reference language) and French, with the same file names:

```
README.md, CONTRIBUTING.md, …       English (root)
README-fr.md, CONTRIBUTING-fr.md, … French (root)
docs/
  en/  adr/  appendices/            English
  fr/  adr/  appendices/            French (same file names)
```

Every page starts with a language selector. Translation rules: [CONTRIBUTING.md](CONTRIBUTING.md#multilingual-documentation).

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md), the [code of conduct](CODE_OF_CONDUCT.md) and the [security policy](SECURITY.md). History: [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](LICENSE). Independent project, not affiliated with Mistral AI, Microsoft or GitHub.
