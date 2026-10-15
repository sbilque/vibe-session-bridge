# ADR 0002 — Integrate Vibe as a Session Target through the proposed chatSessionsProvider API

Languages: **English** | [Français](../../fr/adr/0002-session-target-chatsessionsprovider.md)

- Status: Accepted (not validated in real conditions)
- Date: 2026-10-13
- Version: 0.1.0 (development)

## Context

The official Mistral Vibe extension shows a separate webview panel. The VS Code Chat Session Target picker is fed by the `chatSessions` contribution and the proposed `chatSessionsProvider` API, the one used by Copilot CLI (`extensions/copilot/.../copilotCLIChatSessions.ts`).

## Decision

Contribute a `mistral-vibe` type (`contributes.chatSessions`) and implement `createChatSessionItemController`, `registerChatSessionContentProvider` and a chat participant. Enabled proposals: `chatSessionsProvider`, `chatParticipantAdditions`, `chatParticipantPrivate`, `chatReferenceBinaryData`. The `.d.ts` files are downloaded from `microsoft/vscode` by `npm run dts`.

## Consequences

- Requires VS Code Insiders and `enable-proposed-api` in `argv.json`.
- Cannot be published on the Marketplace; distributed as a `.vsix` (GitHub releases).
- The API changes often: rebuild against the `.d.ts` of your Insiders build.

## Sources

[microsoft/vscode](https://github.com/microsoft/vscode) `src/vscode-dts/vscode.proposed.chatSessionsProvider.d.ts`, `chatSessions.contribution.ts`; appendix [B](../appendices/B-claude-copilot-comparison.md)
