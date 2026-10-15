# Annexe A — Audit de couverture (0.1.0) : couverture fonctionnelle

Langues : [English](../../en/appendices/A-coverage-audit.md) | **Français**

Retour : [README](../../../README-fr.md) · [ADR](../adr/README.md)

Références : `microsoft/vscode@10c7c9e` (13 octobre 2026), `@agentclientprotocol/sdk` 1.8.0, `mistral-vibe` 2.26.1.
Classement : **A** implémenté (non testé en conditions réelles) · **B** corrigé avec limite · **C** impossible (API interne ou non exposée par Vibe), documenté · ✓ déjà couvert.

## 1. « Continue In » de Claude / Copilot

Source : `src/vs/workbench/contrib/chat/browser/actions/chatContinueInAction.ts`, `agentSessions/agentSessions.ts`, `chatSessions/chatSessions.contribution.ts`.

| Élément VS Code | Constat | Pont |
|---|---|---|
| Menu « Continue Chat in… » : cibles | Uniquement `copilotcli` (Background), `copilot-cloud-agent` (Cloud) et les types Agent Host (`agent-host-*`) ayant `canDelegate` (`getAgentCanContinueIn`, `isAgentHostTarget`) | **C** : un type tiers (`mistral-vibe`) ne peut pas être cible du menu |
| Transcription transmise | `buildDelegationTranscript` : `User: …` / `Assistant: …`, 20 000 derniers caractères ; pour les cibles hors Agent Host, inlinée dans le prompt : « The following is the conversation history from a previous {0} session. Continue working on it. … User: {prompt} » ; pour l'Agent Host, pièce jointe *paste* « Previous conversation » | **A** : même format, réutilisé dans les deux sens |
| Sortie Vibe → autre agent | Commandes publiques `workbench.action.chat.delegateToAgentHostSession` `{type, displayName, prompt}` et `workbench.action.chat.openNewSessionEditor.<type>` `{prompt}` | **A** : commande « Mistral Vibe : Continuer dans… » (Chat local, Copilot CLI, Cloud, Claude, Codex, Copilot Agent Host) |
| Sortie Vibe → Vibe Code Web | Commande Vibe `/teleport` (`vibe/acp/commands/registry.py`) | **A** : commande slash `/teleport` déclarée dans la session |
| Entrée autre agent → Vibe | `openNewSessionEditor.mistral-vibe` / `openSessionWithPrompt.mistral-vibe` générées par VS Code pour tout type contribué, avec `prompt` + `attachedContext` (paste) | **A** : les références texte (paste) sont transmises à Vibe ; commande « Continuer la conversation dans Mistral Vibe » depuis un fichier ou la sélection |
| Historique reçu par le participant (`ChatContext.history`) | Copilot CLI le résume quand on lui délègue (`copilotCLIChatSessions.ts`) | **A** : nouvelle session Vibe avec historique non vide → transcription préfixée au premier prompt |
| Options transmises (`initialSessionOptions`) | Spécifique aux cibles internes | **C** |
| Sous-agents, handoff Agent Host natif, worktrees | Internes à l'Agent Host | **C** |

## 2. Contribution `chatSessions` (schéma `chatSessions.contribution.ts`)

| Champ | Pont |
|---|---|
| `type`, `name`, `displayName`, `description`, `when`, `welcome*`, `inputPlaceholder` | ✓ |
| `icon` | **A** |
| `commands` (commandes slash statiques) | **A** : commandes intégrées de Vibe (`registry.py`) ; `request.command` renvoyé à Vibe sous la forme `/cmd …` (`commands/controller.py::execute`) |
| `capabilities.supportsFileAttachments` | ✓ |
| `capabilities.supportsImageAttachments` | **A** : Vibe annonce `promptCapabilities.image` ; images converties en `ContentBlock` `image` (API proposée `chatReferenceBinaryData`) |
| `canDelegate` | **C** : sans effet pour un type tiers (voir 1) |
| `supportsHandOffs`, `customAgentTarget`, `requiresCustomModels` | **C** : propres aux agents Copilot |

## 3. API `chatSessionsProvider`

| Membre | Pont |
|---|---|
| `createChatSessionItemController`, `refreshHandler`, `newChatSessionItemHandler`, `forkHandler`, `getChatSessionInputState` | ✓ |
| `registerChatSessionContentProvider` (`history`, `supportsInterruptions`) | ✓ |
| `ChatSessionItem.changes` (`ChatSessionChangedFile`) | **A** : fichiers modifiés issus des `ToolCallContent` `diff` (insertions / suppressions) |
| `ChatSessionItem.badge`, `timing.lastRequestStarted/Ended` | **A** |
| Menu `chat/chatSessions` (supprimer, renommer — modèle Copilot CLI) | **A** : `session/delete` et `session/set_title` (méthodes d'extension Vibe, `agent.py::ext_method`) |
| `archived`, `onDidChangeChatSessionItemState` | **C** : pas d'archivage côté Vibe |

## 4. ACP — méthodes agent

| Méthode | Vibe | Pont |
|---|---|---|
| `initialize`, `authenticate`, `session/new`, `session/load`, `session/list`, `session/prompt`, `session/cancel`, `session/set_config_option`, `session/fork`, `session/close` | Oui | ✓ |
| `session/resume` | Implémentée, **non annoncée** (`sessionCapabilities` sans `resume`) | **C** (on utilise `load`) |
| `session/set_mode` | Implémentée | ✓ via `configOptions` (catégorie `mode`, recommandé par ACP) |
| `session/delete` (stable SDK) | Non ; extension `session/delete` | **A** via `extMethod` |
| `logout` | Non ; extension `auth/signOut` | **A** commande « Se déconnecter » |
| Extension `auth/status` | Oui | **A** : état réel avant connexion |
| `unstable_*Nes`, `*Provider`, `didOpen/Change…Document` | Non | **C** |

## 5. ACP — méthodes client

| Méthode | Pont |
|---|---|
| `session/request_permission`, `fs/read_text_file`, `fs/write_text_file`, `terminal/*`, `elicitation/create` (form) | ✓ |
| `elicitation/complete`, mode `url` | **C** : non annoncé, Vibe ne l'utilise qu'en mode form |

## 6. ACP — notifications `session/update`

| Variante | Émise par Vibe | Pont |
|---|---|---|
| `agent_message_chunk`, `agent_thought_chunk`, `user_message_chunk`, `tool_call`, `tool_call_update`, `plan`, `config_option_update`, `session_info_update` | Oui | ✓ |
| `usage_update` | Oui | **A** : badge de la session (tokens / contexte) |
| `available_commands_update` | Oui (commandes + skills) | **B** : journalisé ; les skills restent utilisables en tapant `/nom` (pas d'API de commandes dynamiques) |
| `current_mode_update`, `compaction_*`, `notice`, `plan_update/removed`, `session_message*`, `subagent_update` | Non | **C** |

## 7. Contenu du prompt (`ContentBlock`)

| Référence VS Code | Avant | 0.1.0 |
|---|---|---|
| Fichier (`Uri`) | `resource_link` | ✓ |
| Sélection (`Location` avec plage) | `resource_link` du fichier entier | **A** : `resource` intégré avec le texte de la plage (`embeddedContext` annoncé) |
| Texte collé / transcription (`string`) | ignoré | **A** : `resource` texte intégré |
| Image (`ChatReferenceBinaryData`) | ignorée | **A** : `image` base64 |
| Commande slash | ignorée | **A** : `/cmd` en tête du texte |
