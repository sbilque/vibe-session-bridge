# vibe-session-bridge

Langues : [English](README.md) | **Français**

[![Licence MIT](https://img.shields.io/badge/licence-MIT-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.1.0--dev-orange.svg)](CHANGELOG-fr.md)
[![Statut](https://img.shields.io/badge/statut-non%20test%C3%A9-red.svg)](#état-du-projet)

Extension VS Code qui fait de **Mistral Vibe** (`vibe-acp`) un **Session Target** natif du Chat, au même titre que Copilot CLI ou Claude. Elle parle uniquement l'[Agent Client Protocol](https://agentclientprotocol.com) v1 côté agent et l'API proposée `chatSessionsProvider` côté VS Code : aucun protocole maison.

## État du projet

> **Statut : version de développement 0.1.0, non testée.**
> Ce code n'a été exécuté ni dans VS Code ni avec l'API Mistral réelle. Seuls des tests automatisés existent : ils simulent VS Code et le modèle (voir [annexe D](docs/fr/appendices/D-tests.md)). Le fonctionnement réel n'est pas garanti : à utiliser pour évaluation et contribution, pas en production.

| Vérification | Fait |
|---|---|
| Compilation `tsc --strict` | Oui |
| Tests unitaires (logique terminal et questions) | Oui |
| Tests d'intégration avec un vrai `vibe-acp`, VS Code et modèle **simulés** | Oui |
| Installation et usage dans VS Code Insiders | **Non** |
| Échanges avec l'API Mistral réelle (abonnement ou clé) | **Non** |
| Windows, WSL, macOS | **Non** (seulement Linux, environnement de construction) |

Les retours de test sont bienvenus : [ouvrir une issue](https://github.com/sbilque/vibe-session-bridge/issues).

## Sommaire

- [État du projet](#état-du-projet)
- [Fonctionnalités](#fonctionnalités)
- [Prérequis](#prérequis)
- [Installation](#installation)
- [Utilisation](#utilisation)
- [Configuration](#configuration)
- [Architecture](#architecture)
- [Limites connues](#limites-connues)
- [Documentation](#documentation)
- [Contribuer](#contribuer)
- [Licence](#licence)

## Fonctionnalités

Fonctionnalités implémentées, non validées en conditions réelles :

- Sessions Vibe dans le sélecteur Session Target : création, liste, reprise avec historique (réflexions et outils compris), fork, renommage, suppression.
- Sélecteurs sous la saisie : mode (`ask`, `accept-edits`, `auto-approve`, `plan` en legacy), modèle, réflexion.
- Permissions et questions de Vibe affichées dans l'interface native du Chat.
- Terminal ACP dans le terminal VS Code (moteur legacy de Vibe).
- Contexte : fichiers, sélections (extrait seul), texte collé, images ; commandes slash de Vibe.
- « Continuer dans… » vers le Chat local, Copilot CLI, Copilot Cloud, Claude, Codex, Copilot (Agent Host), et l'inverse vers Vibe.
- Liste des sessions : fichiers modifiés (+/−), occupation du contexte.
- Connexion avec l'abonnement Mistral ou une clé, état réel, déconnexion.

## Prérequis

VS Code Insiders récent, GitHub Copilot Chat, Python ≥ 3.12, `mistral-vibe` 2.26.1 (`uv tool install mistral-vibe`), un compte Mistral. Détail : [annexe E](docs/fr/appendices/E-prerequisites.md).

## Installation

1. Télécharger `vibe-session-bridge-0.1.0.vsix` depuis les [releases](https://github.com/sbilque/vibe-session-bridge/releases), ou le construire (voir [CONTRIBUTING](CONTRIBUTING-fr.md)).
2. Installer :
   ```bash
   code-insiders --install-extension vibe-session-bridge-0.1.0.vsix
   ```
3. Activer les API proposées : palette, « Preferences: Configure Runtime Arguments », puis dans `argv.json` :
   ```jsonc
   { "enable-proposed-api": ["local.vibe-session-bridge"] }
   ```
4. Redémarrer VS Code Insiders, puis « Mistral Vibe: Se connecter (abonnement) ».

L'interface de l'extension suit la langue d'affichage de VS Code (anglais ou français) : chaînes du manifeste via `package.nls*.json`, chaînes du code via `l10n/bundle.l10n.*.json`.

## Utilisation

1. Ouvrir le Chat, « New Chat (+) », Session Target « Mistral Vibe ».
2. Choisir mode, modèle et réflexion, joindre fichiers, sélections ou images, taper `/` pour les commandes Vibe.
3. Menu d'une session : « Continuer dans… », « Renommer », « Supprimer ».
4. Clic droit dans l'éditeur : « Continuer dans Mistral Vibe ».

Guide complet et dépannage : [annexe F](docs/fr/appendices/F-user-guide.md).

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

Les décisions d'architecture sont consignées dans des [ADR](docs/fr/adr/README.md). Annexes :

| Annexe | Contenu |
|---|---|
| [A](docs/fr/appendices/A-coverage-audit.md) | Audit de couverture (Continue In, API, ACP) |
| [B](docs/fr/appendices/B-claude-copilot-comparison.md) | Comparaison avec Claude et Copilot CLI |
| [C](docs/fr/appendices/C-acp-vscode-mapping.md) | Correspondance ACP ↔ VS Code, terminal, questions |
| [D](docs/fr/appendices/D-tests.md) | Stratégie et résultats de tests |
| [E](docs/fr/appendices/E-prerequisites.md) | Prérequis |
| [F](docs/fr/appendices/F-user-guide.md) | Mode d'emploi et dépannage |
| [G](docs/fr/appendices/G-audit-plan.md) | Plan de l'audit |

## Limites connues

- API proposée : Insiders uniquement, pas de Marketplace, recompilation possible à chaque version.
- Le menu natif « Continue Chat in… » n'accepte pas les types tiers ([ADR 0005](docs/fr/adr/0005-continue-in-via-commands.md)).
- Moteur par défaut de Vibe : pas de code de sortie des commandes ([ADR 0003](docs/fr/adr/0003-shell-unified-and-legacy.md)).
- Images seulement si le modèle a `supports_images = true` ; skills Vibe sans autocomplétion.
- Pas de sous-agents ni d'archivage : non exposés par Vibe.

## Documentation

La documentation existe en anglais (langue de référence) et en français, avec les mêmes noms de fichiers :

```
README.md, CONTRIBUTING.md, …       anglais (racine)
README-fr.md, CONTRIBUTING-fr.md, … français (racine)
docs/
  en/  adr/  appendices/            anglais
  fr/  adr/  appendices/            français (mêmes noms de fichiers)
```

Chaque page commence par un sélecteur de langue. Règles de traduction : [CONTRIBUTING-fr.md](CONTRIBUTING-fr.md#documentation-multilingue).

## Contribuer

Voir [CONTRIBUTING-fr.md](CONTRIBUTING-fr.md), le [code de conduite](CODE_OF_CONDUCT-fr.md) et la [politique de sécurité](SECURITY-fr.md). Historique : [CHANGELOG-fr.md](CHANGELOG-fr.md).

## Licence

[MIT](LICENSE). Projet indépendant, non affilié à Mistral AI, Microsoft ou GitHub.
