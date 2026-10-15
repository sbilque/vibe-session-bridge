# Annexe D — Stratégie et résultats de tests

Langues : [English](../../en/appendices/D-tests.md) | **Français**

Retour : [README](../../../README-fr.md) · ADR liée : [0007](../adr/0007-integration-tests-real-vibe.md)

### Tests d'intégration (vraie session Vibe)

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


### Tests ajoutés lors de l'audit

| Test | Vérifie |
|---|---|
| commande slash | `request.command` → `/help` exécuté par Vibe sans appel au modèle |
| références | texte collé et sélection (`Location`) transmis en contenu intégré, plage seule |
| image | `ChatReferenceBinaryData` → `ContentBlock` `image` reçu par le modèle (`supports_images = true`) |
| délégation entrante | `ChatContext.history` injecté au premier tour uniquement |
| Continuer dans… | commande `workbench.action.chat.delegateToAgentHostSession`, type `agent-host-claude`, transcription au format VS Code |
| fichiers modifiés et usage | `ChatSessionItem.changes` (+3 −0), badge de contexte, `timing.lastRequestEnded` |
| renommer / supprimer | méthodes d'extension `_session/set_title`, `_session/delete` |

Résultat 0.1.0 : 17/17 par moteur (unified et legacy), soit 34/34 ; tests unitaires 12/12.

### Ce qui n'a pas été testé

Ces résultats ne valent pas validation : VS Code et le modèle sont simulés.

- Aucune exécution dans VS Code Insiders : rendu du Chat, menus, sélecteur Session Target, API proposées réelles.
- Aucun échange avec l'API Mistral (`npm run test:integration:mistral` jamais exécuté, faute de clé).
- Commandes VS Code de « Continuer dans… » : seul l'appel est vérifié, pas leur effet.
- Seulement sous Linux ; ni Windows, ni WSL, ni macOS.
