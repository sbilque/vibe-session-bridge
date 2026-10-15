# ADR 0002 — Intégrer Vibe comme Session Target via l'API proposée chatSessionsProvider

Langues : [English](../../en/adr/0002-session-target-chatsessionsprovider.md) | **Français**

- Statut : Acceptée (non validée en conditions réelles)
- Date : 2026-10-13
- Version : 0.1.0 (développement)

## Contexte

L'extension officielle Mistral Vibe affiche un panneau webview séparé. Le sélecteur Session Target du Chat de VS Code est alimenté par la contribution `chatSessions` et l'API proposée `chatSessionsProvider`, celle qu'utilise Copilot CLI (`extensions/copilot/.../copilotCLIChatSessions.ts`).

## Décision

Contribuer un type `mistral-vibe` (`contributes.chatSessions`) et implémenter `createChatSessionItemController`, `registerChatSessionContentProvider` et un participant de chat. Propositions activées : `chatSessionsProvider`, `chatParticipantAdditions`, `chatParticipantPrivate`, `chatReferenceBinaryData`. Les `.d.ts` sont téléchargés par `npm run dts` depuis `microsoft/vscode`.

## Conséquences

- Exige VS Code Insiders et `enable-proposed-api` dans `argv.json`.
- Publication impossible sur le Marketplace ; distribution par `.vsix` (releases GitHub).
- L'API change souvent : recompiler contre le `.d.ts` de sa version d'Insiders.

## Sources

[microsoft/vscode](https://github.com/microsoft/vscode) `src/vscode-dts/vscode.proposed.chatSessionsProvider.d.ts`, `chatSessions.contribution.ts` ; annexe [B](../appendices/B-claude-copilot-comparison.md)
