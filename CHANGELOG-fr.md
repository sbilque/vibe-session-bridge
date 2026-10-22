# Changelog

Langues : [English](CHANGELOG.md) | **Français**

Format : [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Localisation
- Interface localisée en anglais et en français : chaînes du manifeste via `package.nls.json` / `package.nls.fr.json`, code de l'extension via `vscode.l10n.t()` avec `l10n/bundle.l10n.json` / `l10n/bundle.l10n.fr.json` (38 chaînes).
- Nouveau test unitaire `l10n` : parité des clés et paramètres `{0}` EN/FR, clés du manifeste, extraction à jour.
- Chaînes sources passées en anglais (langue de référence) ; messages d'interface et journaux traduits dans le bundle.

### Documentation
- Documentation bilingue : anglais (référence) et français ; `docs/en/` et `docs/fr/` avec les mêmes noms de fichiers, sélecteur de langue sur chaque page.
- Agent Copilot de traduction : `.github/agents/translation.agent.md`.

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
