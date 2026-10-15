# Changelog

Languages: **English** | [Français](CHANGELOG-fr.md)

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Documentation
- Bilingual documentation: English (reference) and French; `docs/en/` and `docs/fr/` with the same file names, language selector on every page.
- Copilot translation agent: `.github/agents/translation.agent.md`.

## [0.1.0] — 2026-10-13 — pre-release, untested

First published version. **Untested** in VS Code and against the real Mistral API: only automated tests with simulated VS Code and model were run (appendix D).

### Added
- Mistral Vibe Session Target: create, list, resume with history, fork, rename, delete.
- Mode / model / thinking pickers, applied on each request.
- Vibe permissions and questions (`elicitation/create` → `questionCarousel`).
- ACP terminal in the VS Code terminal (Vibe legacy engine).
- Prompt content: files, selections, pasted text, images, slash commands.
- "Continue in…" to local Chat, Copilot CLI, Copilot Cloud, Agent Host; incoming delegation to Vibe.
- Changed files and context usage in the session list.
- Sign-in with subscription or key, status (`_auth/status`), sign-out (`_auth/signOut`).

### Documentation
- README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, issue and PR templates.
- ADR 0001 to 0008 and appendices A to G.

### Tests
- 12 unit tests; 17 integration tests per Vibe engine (unified, legacy) with a real `vibe-acp` 2.26.1, simulated VS Code and model.

[Unreleased]: https://github.com/sbilque/vibe-session-bridge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sbilque/vibe-session-bridge/releases/tag/v0.1.0
