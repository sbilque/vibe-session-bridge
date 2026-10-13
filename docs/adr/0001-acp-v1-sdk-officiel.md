# ADR 0001 — Utiliser ACP v1 et le SDK officiel, sans protocole maison

- Statut : Acceptée (non validée en conditions réelles)
- Date : 2026-10-13
- Version : 0.1.0 (développement)

## Contexte

Vibe expose un agent via `vibe-acp` (entrypoint `vibe.acp.entrypoint:main`, dépendance `agent-client-protocol`). Un pont pourrait aussi piloter le CLI `vibe` en analysant sa sortie, ou définir son propre protocole.

## Décision

Le pont parle uniquement l'Agent Client Protocol v1 (`PROTOCOL_VERSION = 1`) avec `ClientSideConnection` et `ndJsonStream` de `@agentclientprotocol/sdk` 1.8.0, version épinglée. Toute fonction utilisée doit exister dans `vibe/acp/agent.py` ; chaque appel est commenté avec son fichier source.

## Conséquences

- Aucune fonction inventée : ce que Vibe n'implémente pas (`session/resume` non annoncé, `logout`) n'est pas utilisé.
- Mise à jour du SDK = relecture de l'annexe A.
- Les extensions Vibe passent par `extMethod` (voir [ADR 0006](0006-methodes-extension-vibe.md)).

## Sources

[mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/acp/agent.py`, `pyproject.toml` ; [SDK ACP](https://www.npmjs.com/package/@agentclientprotocol/sdk)
