# ADR 0006 — Méthodes d'extension Vibe préfixées par « _ »

- Statut : Acceptée (non validée en conditions réelles)
- Date : 2026-10-13
- Version : 0.1.0 (développement)

## Contexte

Vibe implémente hors spécification `auth/status`, `auth/signOut`, `session/set_title`, `session/delete` (`agent.py::ext_method`). Le SDK TypeScript envoie le nom tel quel ; le routeur Python (`acp/router.py`) ne traite comme extension qu'un nom commençant par `_`, qu'il retire. Sans préfixe, Vibe répond `-32601 Method not found` (constaté par les tests).

## Décision

Appeler `extMethod('_auth/status')`, `'_auth/signOut'`, `'_session/set_title'`, `'_session/delete'`. Ces appels servent à l'état de connexion, à la déconnexion, au renommage et à la suppression de sessions (menu `chat/chatSessions`, comme Copilot CLI).

## Conséquences

- Dépendance à des méthodes non normalisées : couvertes par les tests d'intégration.
- Erreur `-32601` = Vibe trop ancien (dépannage, annexe F).

## Sources

[mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/acp/agent.py` ; paquet Python `acp/router.py`
