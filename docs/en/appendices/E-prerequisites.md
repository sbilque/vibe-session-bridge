# Appendix E — Prerequisites — vibe-session-bridge 0.1.0 (development, untested)

Languages: **English** | [Français](../../fr/appendices/E-prerequisites.md)

Back to: [README](../../../README.md) · [ADR](../adr/README.md)

## To use the extension (.vsix file)

| Item | Version | Check |
|---|---|---|
| VS Code Insiders | recent build (proposed `chatSessionsProvider` API; developed against `microsoft/vscode@10c7c9e`, October 13, 2026); `engines.vscode` ≥ 1.115 | `code-insiders --version` |
| GitHub Copilot Chat | installed and signed in (VS Code Chat and the Session Target picker depend on it) | Chat view opens |
| Python | ≥ 3.12 | `python3 --version` |
| uv (recommended) or pipx | recent | `uv --version` |
| mistral-vibe | 2.26.1 (version used by the automated tests); provides `vibe` and `vibe-acp` | `vibe --version`, `which vibe-acp` |
| Mistral account | Le Chat Pro / Team / Enterprise subscription, or an API key (Vibe Code or La Plateforme) | `vibe` starts without asking for a key |

Installing Vibe:

```bash
uv tool install mistral-vibe     # or: pipx install mistral-vibe
vibe --setup                     # sign in to your Mistral account or enter a key
```

On Windows, install Vibe in the same environment where VS Code starts its processes (native, or inside WSL with Remote-WSL). On macOS, set `vibeBridge.command` to an absolute path (`~/.local/bin/vibe-acp`): an app launched from the Dock does not inherit the zsh PATH.

Image attachments: the active model must have `supports_images = true` in `~/.vibe/config.toml` (Vibe's `ModelConfig.supports_images` field).

"Continue in…" targets: Copilot CLI and Copilot Cloud require the Copilot Chat extension; Claude, Codex and Copilot (Agent Host) only appear if the Agent Host is enabled in your build.

## To build and test

| Item | Version |
|---|---|
| Node.js | ≥ 20 (tested with 20.20.2) |
| npm | ≥ 10 |
| git | for `npm run dts` (downloads the proposed `.d.ts` files) |
| Network access | `npm install`, `npm run dts`; integration tests: none (local simulated model) |

`npm run test:integration:mistral` requires a valid key in `MISTRAL_API_KEY` and consumes quota.
