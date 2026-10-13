# ADR 0008 — Contenu du prompt selon les capacités annoncées par l'agent

- Statut : Acceptée
- Date : 2026-10-13
- Version : 1.0.0

## Contexte

Vibe annonce `promptCapabilities.image` et `embeddedContext`. Jusqu'en 0.5, seules les références fichier étaient envoyées (`resource_link`) : sélections, texte collé, images et commandes slash étaient perdus.

## Décision

`src/prompt.ts` : `Uri` → `resource_link` ; `Location` avec plage → `resource` intégré (extrait seul) ; texte → `resource` texte ; image (`ChatReferenceBinaryData`) → `image` base64 ; `request.command` → `/cmd` en tête du texte, exécuté par Vibe (`commands/controller.py`). Repli en texte si une capacité n'est pas annoncée. Commandes intégrées de Vibe déclarées dans `contributes.chatSessions[].commands`.

## Conséquences

- Images utiles seulement si le modèle Vibe a `supports_images = true`.
- Skills Vibe : pas d'autocomplétion (pas d'API de commandes dynamiques), à taper en entier.

## Sources

[SDK ACP](https://www.npmjs.com/package/@agentclientprotocol/sdk) `ContentBlock` ; [mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/acp/image_blocks.py`, `commands/registry.py`
