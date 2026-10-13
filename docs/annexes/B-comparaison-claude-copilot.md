# Annexe B — Revue : vibe-session-bridge vs Claude / Copilot CLI dans VS Code, et vs le code de Mistral Vibe

Retour : [README](../../README.md) · [ADR](../adr/README.md)

Références lues (13 octobre 2026) :
- `microsoft/vscode@10c7c9e` (main) : Copilot Chat est désormais dans `extensions/copilot/` ; le dépôt `microsoft/vscode-copilot-chat` n'est plus mis à jour depuis mai 2026.
- `mistral-vibe` 2.26.1 (PyPI), dossier `vibe/acp/`, et `vibe/app_server/_tool_io.py`, `_effect_models.py`.

## 1. Où vit Claude aujourd'hui

| Version | Implémentation de Claude | Utilisable par une extension tierce |
|---|---|---|
| Copilot Chat ≤ mai 2026 | `src/extension/chatSessions/vscode-node/claudeChatSessionContentProvider.ts` (API `chatSessionsProvider`) | Oui (même API proposée) |
| `microsoft/vscode` main | Harness `IAgent` dans l'Agent Host : `src/vs/platform/agentHost/node/claude/` (`claudeAgent.ts`, `claudeCanUseTool.ts`, `claudeTerminalOutput.ts`…) | **Non** : agents intégrés au cœur (claude, codex, copilot), aucun point d'extension ni harness ACP |

Conséquence : copier Claude à l'identique est impossible pour une extension. La référence encore valable côté extension est **Copilot CLI** (`extensions/copilot/src/extension/chatSessions/vscode-node/copilotCLIChatSessions.ts`, contribution `chatSessions` de type `copilotcli`), qui utilise la même API que notre pont. Les fichiers `.d.ts` de `chatSessionsProvider`, `chatParticipantAdditions` et `chatParticipantPrivate` sont identiques entre `main` et le projet (diff vide).

## 2. Écarts trouvés avec Copilot CLI et corrections

| # | Copilot CLI (référence) | Version 0.2 | Correction 0.3 |
|---|---|---|---|
| 1 | `getChatSessionInputState` construit les groupes d'options **avant** que la session existe (ressource absente) | Groupes vides pour une nouvelle session | Session ACP pré-créée : ses `configOptions` alimentent le sélecteur ; consommée par `newChatSessionItemHandler`, puis remplacée |
| 2 | Options lues **au moment de la requête** (`getSelectedSessionOptions(chatSessionContext.inputState)`) | Envoi sur `onDidChange` | `applyOptions()` avant chaque `session/prompt` → `session/set_config_option` |
| 3 | `newChatSessionItemHandler` : libellé = `prompt` ou `command` | Prompt tronqué | Aligné |
| 4 | Historique : `new ChatRequestTurn2(prompt, undefined, [], '', [], [], …)` (`chatHistoryBuilder.ts`) | `participant = SCHEME`, `editedFileEvents = undefined` | Aligné ; ajout des parties réflexion et outils dans l'historique |
| 5 | Outils terminés : `isComplete`, `isError`, `isConfirmed` (`processToolExecutionComplete`) | `isConfirmed` absent | Ajouté (`false` si l'utilisateur a refusé) |
| 6 | Shell : `ChatTerminalToolInvocationData` avec `language: 'bash'` / `'powershell'`, sortie `\n → \r\n`, `state.exitCode` | `'sh'` / `'pwsh'`, sans conversion | Aligné |
| 7 | Permissions : `vscode.lm.invokeTool('vscode_get_confirmation' …, toolInvocationToken)` (`permissionHelpers.ts`) | `questionCarousel` seul | Outil interne `vscode_get_confirmation_with_options` (boutons = options ACP), repli sur `questionCarousel` s'il n'est pas exposé à l'extension |

## 3. Écarts trouvés avec le code réel de Vibe et corrections

| # | Constat dans Vibe 2.26.1 | Impact sur 0.2 | Correction 0.3 |
|---|---|---|---|
| A | Les outils shell **n'envoient pas** de `ToolCallContent` de type `terminal` (`TerminalToolCallContent` n'apparaît que dans la commande `teleport`) | Le rattachement terminal ↔ appel d'outil ne se déclenchait jamais | Commande lue dans `rawInput.command` (`ShellEffectInput`) ; sortie accumulée depuis les deltas `content` texte (`_effect_progress_updates`) |
| B | `ShellEffectOutput` = `stdout`, `stderr`, `output`, `truncated` : **pas de code de sortie** | Code de sortie absent | Repris du terminal ACP client ayant exécuté la même commande (`lastExitCode`) |
| C | `request_permission` n'envoie que `ToolCallUpdate(toolCallId)`, sans titre (`agent.py::_answer_callback`) | Titre toujours générique | Titre et commande retrouvés via le suivi des `tool_call` |
| D | `fork_session` exige une session **chargée dans le processus** (`self._get_session`) | Échec sur une session listée mais non ouverte | `ensureLive()` → `session/load` avant le fork |
| E | Fork d'une session sans message : `-32602 Session not found` (constaté par le test) | Erreur brute | Message explicite |
| F | `ForkSessionParams.message_id` existe | Non utilisé | Laissé tel quel : l'id de requête VS Code n'est pas un id de message Vibe, donc fork de la session entière |
| G | `close_session` annoncé (`sessionCapabilities.close`) ; méthode **stable** `closeSession` dans le SDK TS | Non utilisé | Fermeture de la session pré-créée à la désactivation |
| H | `load_session` rejoue l'historique (`replay_session_updates`) : messages, réflexions, `tool_call` | Seul le texte était reconstruit | Réflexions et outils inclus |

## 4. Appels ACP vérifiés dans `vibe/acp/agent.py`

| Appel du pont | Méthode Vibe | Vérifié par test réel |
|---|---|---|
| `initialize` + `_meta.terminal-auth` | `initialize` | Oui |
| `authenticate` | `authenticate` (`browser-auth`, `browser-auth-delegated`, `vibe-setup`) | Chemin `-32000` oui |
| `newSession` | `new_session` | Oui |
| `loadSession` | `load_session` | Non (nécessite une session avec messages) |
| `listSessions` | `list_sessions` | Oui |
| `unstable_forkSession` | `fork_session` | Oui (erreur attendue sur session vide) |
| `closeSession` | `close_session` | Oui |
| `setSessionConfigOption` | `set_config_option` | Oui (`mode` accept-edits → ask, `thinking` high → off) |
| `prompt` / `cancel` | `prompt` / `cancel` | Non (nécessite une clé valide) |
| Client : `fs/*`, `request_permission`, `terminal/*` | `vibe/acp/tool_io.py`, `vibe/app_server/_tool_io.py::run_shell` | `terminal/*` par tests unitaires |

Notifications utilisées, toutes émises par `vibe/acp/session_updates.py` ou `agent.py` : `agent_message_chunk`, `agent_thought_chunk`, `user_message_chunk` (rejeu), `tool_call`, `tool_call_update`, `plan`, `config_option_update`, `session_info_update`.

## 5. Ce qui reste différent de Claude dans le cœur (après l'audit 1.0)

- « Continue In » natif : Vibe ne peut pas être une cible du menu (`getAgentCanContinueIn` dans `agentSessions.ts`). Le pont fournit la même fonction par commande, avec le même format de transcription, dans les deux sens (voir [annexe A](A-audit-couverture.md)).
- Pas de sous-agents (`subAgentInvocationId`) : Vibe ne les expose pas en ACP.
- Élicitation : format de réponse du carousel conforme à `chatQuestionCarouselPart.ts`.
- Commandes slash : intégrées déclarées statiquement ; skills tapées à la main (pas d'API de commandes dynamiques pour les types tiers).
