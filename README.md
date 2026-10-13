# vibe-session-bridge

[![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/sbilque/vibe-session-bridge)](https://github.com/sbilque/vibe-session-bridge/releases)

Extension VS Code qui fait de **Mistral Vibe** (`vibe-acp`) un **Session Target** natif du Chat, au même titre que Copilot CLI ou Claude. Elle parle uniquement l'[Agent Client Protocol](https://agentclientprotocol.com) v1 côté agent et l'API proposée `chatSessionsProvider` côté VS Code : aucun protocole maison.

## Sommaire

- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Limites connues](#limites-connues)
- [Contribuer](#contribuer)
- [Licence](#licence)

## Fonctionnalités

- Sessions Vibe dans le sélecteur Session Target : création, liste, reprise avec historique (réflexions et outils compris), fork, renommage, suppression.
- Sélecteurs sous la saisie : mode (`ask`, `accept-edits`, `auto-approve`, `plan` en legacy), modèle, réflexion.
- Permissions et questions de Vibe affichées dans l'interface native du Chat.
- Terminal ACP dans le terminal VS Code (moteur legacy de Vibe).
- Contexte : fichiers, sélections (extrait seul), texte collé, images ; commandes slash de Vibe.
- « Continuer dans… » vers le Chat local, Copilot CLI, Copilot Cloud, Claude, Codex, Copilot (Agent Host), et l'inverse vers Vibe.
- Liste des sessions : fichiers modifiés (+/−), occupation du contexte.
- Connexion avec l'abonnement Mistral ou une clé, état réel, déconnexion.

## Prérequis

VS Code Insiders récent, GitHub Copilot Chat, Python ≥ 3.12, `mistral-vibe` 2.26.1 (`uv tool install mistral-vibe`), un compte Mistral. Détail : [annexe E](docs/annexes/E-prerequis.md).

## Installation

1. Télécharger `vibe-session-bridge-1.0.0.vsix` depuis les [releases](https://github.com/sbilque/vibe-session-bridge/releases), ou le construire (voir [CONTRIBUTING](CONTRIBUTING.md)).
2. Installer :
   ```bash
   code-insiders --install-extension vibe-session-bridge-1.0.0.vsix
   ```
3. Activer les API proposées : palette, « Preferences: Configure Runtime Arguments », puis dans `argv.json` :
   ```jsonc
   { "enable-proposed-api": ["local.vibe-session-bridge"] }
   ```
4. Redémarrer VS Code Insiders, puis « Mistral Vibe: Se connecter (abonnement) ».

## Utilisation

1. Ouvrir le Chat, « New Chat (+) », Session Target « Mistral Vibe ».
2. Choisir mode, modèle et réflexion, joindre fichiers, sélections ou images, taper `/` pour les commandes Vibe.
3. Menu d'une session : « Continuer dans… », « Renommer », « Supprimer ».
4. Clic droit dans l'éditeur : « Continuer dans Mistral Vibe ».

Guide complet et dépannage : [annexe F](docs/annexes/F-mode-emploi.md).

## Configuration

| Réglage | Défaut | Rôle |
|---|---|---|
| `vibeBridge.enabled` | `true` | Affiche « Mistral Vibe » dans le sélecteur |
| `vibeBridge.command` | `vibe-acp` | Exécutable (chemin absolu conseillé sur macOS) |
| `vibeBridge.args` | `[]` | `["--legacy-harness"]` : shell dans le terminal VS Code, code de sortie, mode `plan` |
| `vibeBridge.env` | `{}` | Variables supplémentaires (vide = `~/.vibe/.env`) |
| `vibeBridge.terminal.enabled` | `true` | Capacité ACP `terminal` |
| `vibeBridge.terminal.reveal` | `onCreate` | Miroir des commandes (`never` pour masquer) |
| `vibeBridge.elicitation.enabled` | `true` | Questions de Vibe dans le chat |

## Architecture

```
VS Code Chat ── chatSessionsProvider ──> extension (src/) ── ACP v1 / stdio ──> vibe-acp (Mistral Vibe)
```

| Module | Rôle |
|---|---|
| `src/extension.ts` | Activation, commandes |
| `src/acpAgent.ts` | Processus `vibe-acp`, connexion ACP, authentification, méthodes client `fs/*` |
| `src/sessions.ts` | Session Target : items, historique, rendu des `session/update`, permissions |
| `src/prompt.ts` | `ChatRequest` → `ContentBlock[]`, transcription de délégation |
| `src/continueIn.ts` | « Continuer dans… » dans les deux sens |
| `src/terminals.ts` | Terminal ACP (`terminal/*`) |
| `src/elicitation.ts` | `elicitation/create` → `questionCarousel` |

Les décisions d'architecture sont consignées dans des [ADR](docs/adr/README.md). Annexes :

| Annexe | Contenu |
|---|---|
| [A](docs/annexes/A-audit-couverture.md) | Audit de couverture 1.0 (Continue In, API, ACP) |
| [B](docs/annexes/B-comparaison-claude-copilot.md) | Comparaison avec Claude et Copilot CLI |
| [C](docs/annexes/C-correspondance-acp-vscode.md) | Correspondance ACP ↔ VS Code, terminal, questions |
| [D](docs/annexes/D-tests.md) | Stratégie et résultats de tests |
| [E](docs/annexes/E-prerequis.md) | Prérequis |
| [F](docs/annexes/F-mode-emploi.md) | Mode d'emploi et dépannage |
| [G](docs/annexes/G-plan-audit-1.0.md) | Plan de l'audit 1.0 |

## Limites connues

- API proposée : Insiders uniquement, pas de Marketplace, recompilation possible à chaque version.
- Le menu natif « Continue Chat in… » n'accepte pas les types tiers ([ADR 0005](docs/adr/0005-continue-in-par-commandes.md)).
- Moteur par défaut de Vibe : pas de code de sortie des commandes ([ADR 0003](docs/adr/0003-shell-unified-et-legacy.md)).
- Images seulement si le modèle a `supports_images = true` ; skills Vibe sans autocomplétion.
- Pas de sous-agents ni d'archivage : non exposés par Vibe.

## Contribuer

Voir [CONTRIBUTING.md](CONTRIBUTING.md), le [code de conduite](CODE_OF_CONDUCT.md) et la [politique de sécurité](SECURITY.md). Historique : [CHANGELOG.md](CHANGELOG.md).

## Licence

[MIT](LICENSE). Projet indépendant, non affilié à Mistral AI, Microsoft ou GitHub.
