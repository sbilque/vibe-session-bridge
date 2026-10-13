# ADR 0007 — Tests d'intégration avec un vrai vibe-acp et un modèle simulé

- Statut : Acceptée (non validée en conditions réelles)
- Date : 2026-10-13
- Version : 0.1.0 (développement)

## Contexte

Le pont dépend du comportement réel de Vibe, qui diffère parfois de la spécification ACP (absence de code de sortie, schéma camelCase, préfixe `_`). Des tests contre un faux agent ne l'auraient pas révélé. VS Code ne peut pas tourner sans interface dans l'environnement de CI.

## Décision

Lancer le vrai `vibe-acp` piloté par le vrai code `src/`. Seuls VS Code (`test/integration/vscode-host.ts`) et le modèle (`mock-llm.ts`, serveur `/v1/chat/completions` SSE déclaré `backend = "generic"`, comme les tests e2e de Vibe) sont simulés. Chaque scénario tourne sur les deux moteurs. Mode optionnel avec l'API Mistral réelle (`test:integration:mistral`).

## Conséquences

- Déterministe, sans clé ni réseau.
- Le rendu dans VS Code reste à valider manuellement.
- Le simulateur doit suivre les schémas d'outils de Vibe (ex. `path` en unified, `file_path` en legacy pour `write_file`).

## Sources

[mistral-vibe](https://github.com/mistralai/mistral-vibe) `tests/e2e` ; annexe [D](../annexes/D-tests.md)
