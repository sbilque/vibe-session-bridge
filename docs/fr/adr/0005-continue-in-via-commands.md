# ADR 0005 — « Continue In » par commandes publiques, pas par le menu natif

Langues : [English](../../en/adr/0005-continue-in-via-commands.md) | **Français**

- Statut : Acceptée (non validée en conditions réelles)
- Date : 2026-10-13
- Version : 0.1.0 (développement)

## Contexte

Le menu « Continue Chat in… » (`chatContinueInAction.ts`) ne propose que `copilotcli`, `copilot-cloud-agent` et les types Agent Host (`getAgentCanContinueIn`, `isAgentHostTarget`). Un type tiers n'y figure jamais. VS Code expose toutefois les commandes qu'il utilise : `workbench.action.chat.delegateToAgentHostSession` `{type, displayName, prompt}` et `workbench.action.chat.openNewSessionEditor.<type>` `{prompt}`, générées pour chaque type contribué.

## Décision

Commande « Mistral Vibe : Continuer dans… » (menu `chat/chatSessions`) vers le Chat local, Copilot CLI, Copilot Cloud et les Agent Host Claude, Codex, Copilot. La transcription reprend `buildDelegationTranscript` (`User:` / `Assistant:`, 20 000 derniers caractères) et le texte `chat.delegation.inlinePrompt`. Sens inverse : `ChatContext.history` injecté au premier tour ; commande d'éditeur « Continuer dans Mistral Vibe » ; `/teleport` pour Vibe Code Web.

## Conséquences

- Même résultat que le menu natif, mais accessible par un autre menu.
- Cibles Agent Host absentes si l'Agent Host n'est pas activé : message d'erreur.
- Identifiants de types codés en dur, d'après `chatSessionsService.ts` : à revérifier à chaque version.

## Sources

[microsoft/vscode](https://github.com/microsoft/vscode) `chatContinueInAction.ts`, `agentSessions.ts`, `chatSessionsService.ts` ; annexe [A](../appendices/A-coverage-audit.md)
