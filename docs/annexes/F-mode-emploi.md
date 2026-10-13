# Annexe F — Mode d'emploi — vibe-session-bridge 0.1.0 (développement, non testée)

Retour : [README](../../README.md) · [ADR](../adr/README.md)

> Version de développement non testée dans VS Code : ces étapes décrivent le fonctionnement prévu, pas un fonctionnement vérifié.

## 1. Installer

```bash
git clone https://github.com/sbilque/vibe-session-bridge.git && cd vibe-session-bridge
npm install && npm run package
code-insiders --install-extension vibe-session-bridge-0.1.0.vsix
```

Activer les API proposées : palette, « Preferences: Configure Runtime Arguments », puis dans `argv.json` :

```jsonc
{ "enable-proposed-api": ["local.vibe-session-bridge"] }
```

Redémarrer complètement VS Code Insiders.

## 2. Régler (`settings.json`)

| Réglage | Défaut | Rôle |
|---|---|---|
| `vibeBridge.enabled` | `true` | Affiche « Mistral Vibe » dans le sélecteur Session Target |
| `vibeBridge.command` | `vibe-acp` | Exécutable (chemin absolu conseillé sur macOS) |
| `vibeBridge.args` | `[]` | `["--legacy-harness"]` : le shell passe par le terminal VS Code, code de sortie visible, mode `plan` |
| `vibeBridge.env` | `{}` | Variables supplémentaires ; vide = `~/.vibe/.env` |
| `vibeBridge.terminal.enabled` | `true` | Capacité ACP `terminal` |
| `vibeBridge.terminal.reveal` | `onCreate` | Miroir des commandes dans le panneau Terminal (`never` pour masquer) |
| `vibeBridge.elicitation.enabled` | `true` | Questions de Vibe (`ask_user_question`) dans le chat |

## 3. Se connecter

Palette, « Mistral Vibe: Se connecter (abonnement) ». Le pont lit d'abord l'état réel (`auth/status`) : si vous êtes déjà connecté, il propose seulement de changer de compte. Sinon il propose la connexion par navigateur au compte Mistral, ou un terminal `vibe-acp --setup`. « Mistral Vibe: Se déconnecter » révoque la connexion par compte ; avec une clé dans `~/.vibe/.env`, retirez-la à la main.

## 4. Travailler avec Vibe

1. Chat (`Ctrl+Alt+I` / `⌃⌘I`), « New Chat (+) », Session Target « Mistral Vibe ».
2. Sous la saisie : mode (`ask`, `accept-edits`, `auto-approve`, plus `plan` en legacy), modèle, réflexion.
3. Contexte : glissez des fichiers, une sélection (seul l'extrait est envoyé), du texte collé ou une image.
4. Commandes : tapez `/` pour `help`, `compact`, `reload`, `log`, `mcp`, `teleport`, `retry`, `data-retention`. Les skills se tapent en entier (`/mon-skill`).
5. Répondez aux permissions et aux questions affichées dans le chat.

Dans la liste des sessions (menu de l'élément) : « Continuer dans… », « Renommer », « Supprimer ». L'élément affiche les fichiers modifiés (+/−) et l'occupation du contexte.

## 5. Continuer ailleurs

Depuis une session Vibe : menu de la session, ou palette « Mistral Vibe: Continuer dans… ». Choisissez la cible (Chat local, Copilot CLI, Copilot Cloud, Claude, Codex, Copilot Agent Host), puis l'instruction (par défaut « implement this. », comme VS Code). La cible reçoit la transcription `User:` / `Assistant:` (20 000 derniers caractères).

Vers Vibe :
- depuis l'éditeur : clic droit, « Mistral Vibe: Continuer dans Mistral Vibe » (sélection ou fichier) ;
- vers Vibe Code Web : commande `/teleport` dans la session ;
- si une conversation est transmise à Vibe avec son historique, il est injecté au premier message.

## 6. Compiler et tester

```bash
npm install
npm run dts                  # .d.ts proposés de microsoft/vscode
npm run check                # tsc --strict
npm test                     # 12 tests unitaires
npm run test:integration     # 17 tests x 2 moteurs (unified, legacy), vrai vibe-acp + modèle simulé
npm run test:integration:mistral   # optionnel : API Mistral réelle (MISTRAL_API_KEY)
npm run package              # produit vibe-session-bridge-0.1.0.vsix
```

## 7. Dépannage

| Symptôme | Correctif |
|---|---|
| `spawn vibe-acp ENOENT` | Chemin absolu dans `vibeBridge.command` |
| « Mistral Vibe » absent du sélecteur | `argv.json` puis redémarrage d'Insiders |
| `-32000 Missing API key` | « Se connecter » ou `vibe --setup` |
| Cible Claude/Codex « indisponible » | Agent Host non activé dans votre build |
| Image ignorée | `supports_images = true` sur le modèle actif |
| Renommer/Supprimer : `-32601` | Vibe antérieur à 2.26 : mettre à jour |
| Fork refusé (`-32602`) | Envoyer au moins un message avant |
| Journaux | « Mistral Vibe: Afficher les journaux ACP » |
