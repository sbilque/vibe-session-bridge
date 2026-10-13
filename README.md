# vibe-session-bridge

Voir aussi [COMPARAISON.md](COMPARAISON.md) : revue face à Claude et Copilot CLI dans `microsoft/vscode@main`, et face au code de mistral-vibe 2.26.1.

Extension VS Code qui expose l'agent ACP de **Mistral Vibe** (`vibe-acp`) comme **Session Target** natif du Chat, sans protocole maison : uniquement l'**Agent Client Protocol v1** côté agent et l'API proposée **`chatSessionsProvider`** côté VS Code.

## Pourquoi

L'extension officielle Mistral Vibe affiche son propre panneau webview. Le sélecteur Session Target, lui, est alimenté par la contribution `chatSessions` et l'API proposée `chatSessionsProvider`, exactement comme Copilot Chat le fait pour Claude et Copilot CLI.

## Ce qui a été étudié

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

## Correspondance ACP ↔ VS Code

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

## Terminal ACP

Vibe annonce son usage dans `vibe/acp/agent.py` (capacité client `terminal` → outils `bash`, `git_bash`, `windows_shell` via le terminal client) et l'appelle dans `vibe/app_server/_tool_io.py::run_shell` : `create(command=<ligne shell>, args=None, cwd, output_byte_limit)` → `wait_for_exit` (timeout côté agent, `kill` si dépassé) → `output` → `release`.

Réglages : `vibeBridge.terminal.enabled` (défaut `true`) et `vibeBridge.terminal.reveal` (`onCreate` | `never`).

`npm test` : 7 tests (ligne shell + code de sortie, args directs, troncature UTF-8, kill avec enfants, release, isolation de session + ENOENT, annulation).

## Questions utilisateur (élicitation ACP)

Vibe n'active ses outils interactifs (`ask_user_question`) que si le client annonce `clientCapabilities.elicitation.form` (`vibe/acp/agent.py::_supports_user_input` ; sinon `NON_INTERACTIVE_DISABLED_TOOLS`). Le pont l'annonce (réglage `vibeBridge.elicitation.enabled`, défaut `true`) et affiche les questions dans un `questionCarousel`.

| Réponse VS Code | Réponse ACP | Effet côté Vibe |
|---|---|---|
| Réponses complètes | `accept` + `content` | `UserQuestionResult` (`is_other` si texte libre) |
| « Passer » | `cancel` | `deny_callback` |
| Question requise vide | `decline` | `deny_callback` (évite l'erreur « empty string/array ») |
| Mode `url` | `decline` | non annoncé par le pont |

`test/elicitation.test.ts` utilise le schéma produit par `_build_elicitation_schema` de Vibe et fait valider les réponses par `_elicit_user_answers` de Vibe.

## Tests d'intégration (vraie session Vibe)

`test/integration/` lance un vrai `vibe-acp` (boucle d'agent, outils, persistance) piloté par le vrai code du pont (`src/`). Seuls VS Code (`vscode-host.ts`, API stable et proposée) et, par défaut, le modèle (`mock-llm.ts`, serveur `/v1/chat/completions` SSE, déclaré comme provider `backend = "generic"` comme dans `tests/e2e` de mistral-vibe) sont simulés.

```bash
npm run test:integration           # modèle simulé, harness unified puis --legacy-harness
npm run test:integration:mistral   # API Mistral réelle (config ~/.vibe, clé ou abonnement)
IT_VERBOSE=1 npm run test:integration   # journaux du pont
```

| Test | Vérifie |
|---|---|
| initialize | `loadSession`, `list/fork/close`, méthode d'auth `vibe-setup` |
| options nouvelle session | groupes `mode`/`model`/`thinking` via la session pré-créée |
| tour texte | `session/prompt` → `stream.markdown`, `stopReason = end_turn` |
| bash + permission acceptée | carousel avec les options Vibe, commande affichée, sortie, terminal VS Code (legacy) |
| bash + permission refusée | fichier non créé, `isConfirmed = false` |
| mode auto-approve | option appliquée à la requête, aucune permission |
| question utilisateur | `ask_user_question` → `elicitation/create` → carousel → réponses reçues par le modèle |
| annulation | `session/cancel` sur `sleep 30`, `stopReason = cancelled` |
| fork | `session/fork` après échanges |
| liste + rechargement | `session/list`, nouveau processus, `session/load` → historique (outils compris), nouveau tour |

Constats faits par ces tests (Vibe 2.26.1) :
- Moteur par défaut « Unified Harness » : le shell s'exécute dans Vibe, **sans** `terminal/create` ; la sortie arrive dans `tool_call_update`, mais **aucun code de sortie** (`rawOutput` = `stdout`, `stderr`, `output`, `truncated`), et `exit 3` est signalé `completed`.
- `--legacy-harness` (réglage `vibeBridge.args`) : shell délégué au terminal ACP de VS Code, code de sortie disponible ; mode `plan` en plus.
- Options de permission : `Allow once`, `Allow for remainder of this session`, `Always allow`, `Deny`.
- `browser-auth` n'est pas annoncée lorsqu'une clé est configurée.
- Schéma de `ask_user_question` en camelCase (`multiSelect`, `footerNote`, `hideOther`).
- Correctif issu des tests : `vibe-acp` survivait au SIGTERM ; l'arrêt ferme désormais stdin, puis SIGTERM, puis SIGKILL après 2 s.

## Validation effectuée

- Typecheck `tsc --strict` avec `@types/vscode@1.115.0` + `.d.ts` proposés de `microsoft/vscode@main` (`@vscode/dts dev`) : 0 erreur.
- Bundle esbuild : OK.
- `test/smoke.mjs` contre **mistral-vibe 2.26.1** réel :
  - `initialize` : protocole 1, `loadSession`, `list/fork/close`, auth `browser-auth` + `vibe-setup` ;
  - sans clé : `session/new` → `-32000 Missing API key for mistral provider` (chemin d'auth du pont) ;
  - avec clé : `session/new` OK, `configOptions` = `mode=accept-edits`, `model=mistral-medium-3.5`, `thinking=high` ; `session/list` OK.
- Non testé ici : exécution dans VS Code (pas d'interface graphique dans le bac à sable) et `session/prompt` avec une vraie clé.

## Nouveautés 1.0 (audit « Continue In »)

Détail et sources : [AUDIT.md](AUDIT.md). Résumé :

- « Mistral Vibe : Continuer dans… » (menu de la session, palette) : transcription au format de VS Code (`buildDelegationTranscript`, 20 000 caractères) envoyée au Chat local, à Copilot CLI, Copilot Cloud ou aux agents Agent Host (Claude, Codex, Copilot) par les commandes publiques `workbench.action.chat.delegateToAgentHostSession` et `workbench.action.chat.openNewSessionEditor.<type>`.
- Délégation entrante : `ChatContext.history` injecté au premier tour ; « Continuer dans Mistral Vibe » depuis l'éditeur (sélection ou fichier).
- Prompt : sélections et textes collés intégrés (`resource`), images (`image`, API `chatReferenceBinaryData`), commandes slash (`request.command` → `/cmd`) avec la liste des commandes intégrées de Vibe.
- Liste des sessions : renommer / supprimer (méthodes d'extension Vibe `session/set_title`, `session/delete`), fichiers modifiés (`changes`), badge d'occupation du contexte (`usage_update`), horodatage des requêtes.
- Authentification : état réel (`auth/status`) et commande « Se déconnecter » (`auth/signOut`).

Correctif découvert par les tests : les méthodes d'extension ACP doivent être préfixées par `_` sur le fil (`acp/router.py` côté Python retire ce préfixe) ; sans lui, Vibe répond `-32601 Method not found`.

## Installation

Voir [PREREQUIS.md](PREREQUIS.md) puis [MODE-EMPLOI.md](MODE-EMPLOI.md). En bref :

```bash
code-insiders --install-extension vibe-session-bridge-1.0.0.vsix
# argv.json : { "enable-proposed-api": ["local.vibe-session-bridge"] }, puis redémarrer
```

## Limites connues

- `chatSessionsProvider` est une API proposée : fixez votre version d'Insiders et recompilez (`npm run dts`) si elle change. Pas de publication possible sur le Marketplace.
- Le menu natif « Continue Chat in… » n'accepte que les cibles internes (`getAgentCanContinueIn`) : Vibe n'y figurera pas ; la commande « Continuer dans… » du pont le remplace.
- Les cibles Agent Host n'existent que si l'Agent Host est activé dans votre build de VS Code ; sinon un message d'erreur s'affiche.
- Les skills Vibe (commandes dynamiques) ne s'affichent pas dans l'autocomplétion : tapez `/nom-du-skill`.
- Images : transmises seulement si le modèle Vibe actif a `supports_images = true`.
- Terminal : miroir lecture seule ; pas de `stdin` (ACP ne le prévoit pas).
- `session/resume` non utilisé (non annoncé par Vibe) ; pas d'archivage de session.
