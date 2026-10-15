# Contribuer à vibe-session-bridge

Langues : [English](CONTRIBUTING.md) | **Français**

Merci de votre intérêt. Ce guide décrit comment préparer l'environnement, proposer une modification et la faire accepter.

## Règle de base

Aucune fonction inventée : tout appel ACP, toute commande VS Code et toute méthode Vibe doit exister dans le code source de référence ([mistral-vibe](https://github.com/mistralai/mistral-vibe), [microsoft/vscode](https://github.com/microsoft/vscode), [SDK ACP](https://www.npmjs.com/package/@agentclientprotocol/sdk)). Indiquez le fichier et la fonction source en commentaire.

## Environnement

Prérequis : [annexe E](docs/fr/appendices/E-prerequisites.md) (Node.js ≥ 20, Python ≥ 3.12, `mistral-vibe` 2.26.1).

```bash
git clone https://github.com/sbilque/vibe-session-bridge.git
cd vibe-session-bridge
npm install
npm run dts            # .d.ts des API proposées
npm run check          # tsc --strict
npm test               # tests unitaires
npm run test:integration   # vrai vibe-acp, modèle simulé, deux moteurs
npm run package        # .vsix
```

Pour déboguer dans VS Code Insiders : ouvrir le dossier, F5 (« Run Extension ») avec `--enable-proposed-api local.vibe-session-bridge`.

## Proposer une modification

1. Ouvrir une issue (bogue ou évolution) avant un changement important.
2. Créer une branche depuis `main` : `feat/…`, `fix/…`, `docs/…`.
3. Messages de commit au format [Conventional Commits](https://www.conventionalcommits.org/fr/) : `feat(sessions): …`, `fix(acp): …`.
4. Ajouter ou adapter les tests : unitaires pour la logique pure, intégration pour tout échange avec Vibe.
5. Mettre à jour `CHANGELOG.md` et `CHANGELOG-fr.md` (section « Unreleased » / « Non publié ») et la documentation concernée.
6. Ouvrir une pull request ; la liste de contrôle du modèle doit être cochée.

## Documentation multilingue

- L'anglais est la langue de référence ; le français est maintenu à l'identique.
- Racine : `NOM.md` (anglais) et `NOM-fr.md` (français). Dossier `docs/` : `docs/en/…` et `docs/fr/…`, mêmes chemins et noms de fichiers (en anglais).
- Chaque page commence par la ligne de sélection de langue (`Languages: **English** | [Français](…)` / `Langues : [English](…) | **Français**`).
- Toute modification d'une page est faite dans les deux langues dans la même pull request. À défaut, ajoutez en tête de la version non mise à jour : `> Traduction en retard sur la version anglaise.`
- Ne pas traduire : code, commandes, noms de fichiers, identifiants d'API, noms de commandes affichées par l'extension.
- Aide : l'agent Copilot `.github/agents/translation.agent.md` traduit une page en conservant le Markdown.
- Vérifier les liens : `python3 scripts/check-links.py`.

## Décisions d'architecture

Tout choix structurant (protocole, API, dépendance, comportement par défaut) fait l'objet d'une ADR dans `docs/en/adr/` et `docs/fr/adr/`, à partir de [template.md](docs/fr/adr/template.md), numérotée à la suite. Une ADR acceptée n'est pas modifiée : une nouvelle ADR la remplace.

## Style

- TypeScript strict, pas de `any` sans justification.
- Textes visibles par l'utilisateur en français.
- Commentaires : pourquoi, et source (fichier/fonction), plutôt que quoi.

## Versions

[SemVer](https://semver.org/lang/fr/). Publication : mise à jour de `package.json`, `CHANGELOG.md` et `CHANGELOG-fr.md`, tag `vX.Y.Z`, release GitHub avec le `.vsix`.
