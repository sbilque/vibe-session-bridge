# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Documentation
- README restructuré, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, modèles d'issue et de PR.
- Documentation réorganisée en ADR (`docs/adr/`) et annexes A à G (`docs/annexes/`).

## [1.0.0] — 2026-10-13

Audit complet face au « Continue In » de VS Code (`chatContinueInAction.ts`), au protocole ACP et à mistral-vibe 2.26.1 ; voir l'annexe A.

- Ajout : « Continuer dans… » (Chat local, Copilot CLI, Copilot Cloud, Agent Host Claude/Codex/Copilot), au format de transcription de VS Code.
- Ajout : délégation entrante (`ChatContext.history`) et « Continuer dans Mistral Vibe » depuis l'éditeur.
- Ajout : sélections et textes collés intégrés (`resource`), images (`image`), commandes slash.
- Ajout : renommer, supprimer, fichiers modifiés, badge de contexte, horodatage des requêtes.
- Ajout : `auth/status`, « Se déconnecter » (`auth/signOut`).
- Correctif : préfixe `_` des méthodes d'extension ACP.
- Tests : 17 tests d'intégration par moteur (34 au total), 12 tests unitaires.

## [0.5.0]
Tests d'intégration avec un vrai `vibe-acp` (unified et legacy), modèle simulé ; arrêt fiable du processus.

## [0.4.0]
Questions utilisateur : `elicitation/create` vers `questionCarousel`.

## [0.3.0]
Revue face à Claude/Copilot CLI : historique complet (réflexions, outils), options appliquées par requête.

## [0.2.0]
Terminal ACP (`terminal/*`) dans le terminal VS Code.

## [0.1.0]
Session Target Mistral Vibe : sessions, options, permissions, fichiers.

[Non publié]: https://github.com/sbilque/vibe-session-bridge/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/sbilque/vibe-session-bridge/releases/tag/v1.0.0
