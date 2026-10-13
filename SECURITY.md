# Politique de sécurité

## Versions prises en charge

Le projet est en développement et n'a pas été testé en conditions réelles : aucune garantie de sécurité ni de fonctionnement.

| Version | Correctifs |
|---|---|
| 0.1.x (développement, non testée) | Au mieux |

## Signaler une vulnérabilité

Ne pas ouvrir d'issue publique. Utilisez le [signalement privé de GitHub](https://github.com/sbilque/vibe-session-bridge/security/advisories/new) en décrivant la version, l'impact et les étapes de reproduction. Accusé de réception visé sous 7 jours.

## Points d'attention

- L'extension lance `vibe-acp` et lui donne accès en lecture/écriture aux fichiers de l'espace de travail et à un terminal : n'utilisez le mode `auto-approve` que sur des projets de confiance.
- Les identifiants restent gérés par Vibe (`~/.vibe/.env` ou connexion au compte Mistral) ; l'extension ne les lit ni ne les stocke. Ne committez jamais `.vibe/.env`.
- Vulnérabilités de Vibe lui-même : à signaler à [Mistral AI](https://github.com/mistralai/mistral-vibe).
