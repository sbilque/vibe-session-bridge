# Annexe C — Correspondance ACP ↔ VS Code

Langues : [English](../../en/appendices/C-acp-vscode-mapping.md) | **Français**

Retour : [README](../../../README-fr.md) · [ADR](../adr/README.md)

### Ce qui a été étudié

| Source | Éléments retenus |
|---|---|
| [mistralai/mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/acp/agent.py` | `initialize` : capacités `loadSession`, `sessionCapabilities.{list,fork,close}`, `promptCapabilities.{image,embeddedContext}` ; `set_config_option` pour `mode`, `model`, `thinking` ; `request_permission` ; lecture/écriture via `fs/*` si le client l'annonce |
| `vibe/acp/auth.py` | Méthodes `browser-auth` (connexion au compte Mistral, donc abonnement) et `browser-auth-delegated` |
| `agent.py::initialize` | `vibe-setup` (TerminalAuthMethod) n'est annoncée que si `clientCapabilities._meta["terminal-auth"] === true` ; commande fournie dans `_meta["terminal-auth"]` |
| `pyproject.toml` | Entrypoint `vibe-acp = vibe.acp.entrypoint:main`, dépendance `agent-client-protocol==0.11.0` |
| [microsoft/vscode](https://github.com/microsoft/vscode) `src/vscode-dts/vscode.proposed.chatSessionsProvider.d.ts` | `createChatSessionItemController`, `newChatSessionItemHandler`, `forkHandler`, `getChatSessionInputState`, `registerChatSessionContentProvider` |
| `chatSessions.contribution.ts` | Point d'extension `chatSessions` (champs requis `type`, `name`, `displayName`, `description`), refusé si `chatSessionsProvider` n'est pas activé |
| [microsoft/vscode-copilot-chat](https://github.com/microsoft/vscode-copilot-chat) `src/extension/chatSessions/vscode-node/chatSessions.ts`, `claudeChatSessionContentProvider.ts`, `chatHistoryBuilder.ts` | Schéma participant + content provider + controller ; historique via `ChatRequestTurn2`/`ChatResponseTurn2` ; outils via `ChatToolInvocationPart` ; `enabledApiProposals: chatSessionsProvider@3, chatParticipantAdditions, chatParticipantPrivate` |
| [@agentclientprotocol/sdk 1.8.0](https://www.npmjs.com/package/@agentclientprotocol/sdk) | `ClientSideConnection`, `ndJsonStream`, `PROTOCOL_VERSION = 1`, code `auth_required = -32000` |


### Correspondance ACP ↔ VS Code

| ACP (Vibe) | VS Code |
|---|---|
| `initialize` + `_meta.terminal-auth` | Démarrage, commande « Se connecter » |
| `authenticate("browser-auth")` | Connexion abonnement Mistral (navigateur ouvert par Vibe) |
| méthode `vibe-setup` | Terminal VS Code lançant `vibe-acp --setup` |
| `session/new` | `newChatSessionItemHandler` (sélecteur Session Target) |
| `session/list` | `refreshHandler` (liste des sessions) |
| `session/load` + replay `session/update` | `provideChatSessionContent` → historique |
| `session/fork` (unstable dans le SDK TS) | `forkHandler` |
| `configOptions` (`mode`, `model`, `thinking`) / `session/set_config_option` | `ChatSessionInputState.groups` (sélecteurs sous la saisie) |
| `session/prompt` (texte + `resource_link`) | `ChatRequest.prompt` + références `#fichier` |
| `agent_message_chunk` / `agent_thought_chunk` | `stream.markdown` / `ChatResponseThinkingProgressPart` |
| `tool_call` / `tool_call_update` | `ChatToolInvocationPart` |
| `plan` | liste de cases à cocher Markdown |
| `session/request_permission` | outil interne `vscode_get_confirmation_with_options` (comme Copilot CLI), repli `stream.questionCarousel` |
| `elicitation/create` (mode `form`) | `stream.questionCarousel` : `string`+`oneOf` → choix unique, `array`+`items.anyOf` → choix multiple, texte libre autorisé ; `boolean`, `number`, `integer`, texte |
| `session/cancel` | `CancellationToken` du Chat |
| `fs/read_text_file` / `fs/write_text_file` | buffer ouvert (non sauvegardé inclus) / `WorkspaceEdit` |
| `terminal/create` | processus Node (shell par défaut `vscode.env.shell` si pas d'`args`) + miroir `Pseudoterminal` dans le panneau Terminal |
| `terminal/output` | sortie stdout+stderr, `outputByteLimit` tronqué par le début sur frontière UTF-8, `exitStatus` |
| `terminal/wait_for_exit` / `terminal/kill` | attente de fin / arrêt du groupe de processus (SIGTERM puis SIGKILL, `taskkill /T` sous Windows) |
| `terminal/release` | id invalidé pour l'agent, sortie gardée pour l'affichage |
| `tool_call` kind `execute` + `rawInput.command` | `ChatTerminalToolInvocationData` (commande, sortie des deltas, code de sortie du terminal client) |

Les ajouts de la 0.1.0 (contenu intégré, images, commandes slash, fichiers modifiés, badge d'usage, méthodes d'extension) sont listés dans l'[annexe A](A-coverage-audit.md).


### Terminal ACP

Vibe annonce son usage dans `vibe/acp/agent.py` (capacité client `terminal` → outils `bash`, `git_bash`, `windows_shell` via le terminal client) et l'appelle dans `vibe/app_server/_tool_io.py::run_shell` : `create(command=<ligne shell>, args=None, cwd, output_byte_limit)` → `wait_for_exit` (timeout côté agent, `kill` si dépassé) → `output` → `release`.

Réglages : `vibeBridge.terminal.enabled` (défaut `true`) et `vibeBridge.terminal.reveal` (`onCreate` | `never`).

`npm test` : 7 tests (ligne shell + code de sortie, args directs, troncature UTF-8, kill avec enfants, release, isolation de session + ENOENT, annulation).


### Questions utilisateur (élicitation ACP)

Vibe n'active ses outils interactifs (`ask_user_question`) que si le client annonce `clientCapabilities.elicitation.form` (`vibe/acp/agent.py::_supports_user_input` ; sinon `NON_INTERACTIVE_DISABLED_TOOLS`). Le pont l'annonce (réglage `vibeBridge.elicitation.enabled`, défaut `true`) et affiche les questions dans un `questionCarousel`.

| Réponse VS Code | Réponse ACP | Effet côté Vibe |
|---|---|---|
| Réponses complètes | `accept` + `content` | `UserQuestionResult` (`is_other` si texte libre) |
| « Passer » | `cancel` | `deny_callback` |
| Question requise vide | `decline` | `deny_callback` (évite l'erreur « empty string/array ») |
| Mode `url` | `decline` | non annoncé par le pont |

`test/elicitation.test.ts` utilise le schéma produit par `_build_elicitation_schema` de Vibe et fait valider les réponses par `_elicit_user_answers` de Vibe.

