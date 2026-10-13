# Changelog

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

## [0.1.0] — 2026-10-13 — pré-version, non testée

Première version publiée. **Non testée** dans VS Code ni avec l'API Mistral réelle : seuls des tests automatisés avec VS Code et modèle simulés ont été exécutés (annexe D).

### Ajouté
- Session Target Mistral Vibe : création, liste, reprise avec historique, fork, renommage, suppression.
- Sélecteurs mode / modèle / réflexion, appliqués à chaque requête.
- Permissions et questions de Vibe (`elicitation/create` → `questionCarousel`).
- Terminal ACP dans le terminal VS Code (moteur legacy de Vibe).
- Contenu du prompt : fichiers, sélections, texte collé, images, commandes slash.
- « Continuer dans… » vers Chat local, Copilot CLI, Copilot Cloud, Agent Host ; délégation entrante vers Vibe.
- Fichiers modifiés et occupation du contexte dans la liste des sessions.
- Connexion par abonnement ou clé, état (`_auth/status`), déconnexion (`_auth/signOut`).

### Documentation
- README, CONTRIBUTING, SECURITY, CODE_OF_CONDUCT, modèles d'issue et de PR.
- ADR 0001 à 0008 et annexes A à G.

### Tests
- 12 tests unitaires ; 17 tests d'intégration par moteur Vibe (unified, legacy) avec un vrai `vibe-acp` 2.26.1, VS Code et modèle simulés.

[Non publié]: https://github.com/sbilque/vibe-session-bridge/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/sbilque/vibe-session-bridge/releases/tag/v0.1.0
