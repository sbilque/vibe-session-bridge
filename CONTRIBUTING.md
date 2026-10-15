# Contributing to vibe-session-bridge

Languages: **English** | [Français](CONTRIBUTING-fr.md)

Thank you for your interest. This guide explains how to set up the environment, propose a change and get it accepted.

## Ground rule

No invented functions: every ACP call, VS Code command and Vibe method must exist in the reference source code ([mistral-vibe](https://github.com/mistralai/mistral-vibe), [microsoft/vscode](https://github.com/microsoft/vscode), [ACP SDK](https://www.npmjs.com/package/@agentclientprotocol/sdk)). Give the source file and function in a comment.

## Environment

Prerequisites: [appendix E](docs/en/appendices/E-prerequisites.md) (Node.js ≥ 20, Python ≥ 3.12, `mistral-vibe` 2.26.1).

```bash
git clone https://github.com/sbilque/vibe-session-bridge.git
cd vibe-session-bridge
npm install
npm run dts            # proposed API .d.ts files
npm run check          # tsc --strict
npm test               # unit tests
npm run test:integration   # real vibe-acp, simulated model, two engines
npm run package        # .vsix
```

To debug in VS Code Insiders: open the folder, press F5 ("Run Extension"), which passes `--enable-proposed-api local.vibe-session-bridge`.

## Proposing a change

1. Open an issue (bug or enhancement) before a significant change.
2. Create a branch from `main`: `feat/…`, `fix/…`, `docs/…`.
3. Commit messages follow [Conventional Commits](https://www.conventionalcommits.org/): `feat(sessions): …`, `fix(acp): …`.
4. Add or update tests: unit tests for pure logic, integration tests for any exchange with Vibe.
5. Update `CHANGELOG.md` and `CHANGELOG-fr.md` ("Unreleased" section) and the related documentation.
6. Open a pull request; the template checklist must be completed.

## Multilingual documentation

- English is the reference language; French is kept in sync.
- Root: `NAME.md` (English) and `NAME-fr.md` (French). `docs/` folder: `docs/en/…` and `docs/fr/…`, same paths and file names (in English).
- Every page starts with the language selector line (`Languages: **English** | [Français](…)` / `Langues : [English](…) | **Français**`).
- Any change to a page is made in both languages in the same pull request. Otherwise, add at the top of the outdated version: `> Translation behind the English version.` (French: `> Traduction en retard sur la version anglaise.`)
- Do not translate: code, commands, file names, API identifiers, command names shown by the extension.
- Help: the Copilot agent `.github/agents/translation.agent.md` translates a page while preserving the Markdown.
- Check links: `python3 scripts/check-links.py`.

## Architecture decisions

Any structural choice (protocol, API, dependency, default behavior) gets an ADR in `docs/en/adr/` and `docs/fr/adr/`, based on [template.md](docs/en/adr/template.md), numbered sequentially. An accepted ADR is never modified: a new ADR supersedes it.

## Style

- Strict TypeScript, no `any` without justification.
- User-facing strings in French (UI localization not yet in place).
- Comments: why, and source (file/function), rather than what.

## Versions

[SemVer](https://semver.org/). Release: update `package.json`, `CHANGELOG.md` and `CHANGELOG-fr.md`, tag `vX.Y.Z`, GitHub release with the `.vsix`.
