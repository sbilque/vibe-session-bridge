# Annexe E — Prérequis — vibe-session-bridge 0.1.0 (développement, non testée)

Retour : [README](../../README.md) · [ADR](../adr/README.md)

## Pour utiliser l'extension (fichier .vsix fourni)

| Élément | Version | Vérification |
|---|---|---|
| VS Code Insiders | build récent (API proposée `chatSessionsProvider` ; développé contre `microsoft/vscode@10c7c9e`, 13 octobre 2026) ; `engines.vscode` ≥ 1.115 | `code-insiders --version` |
| GitHub Copilot Chat | installé et connecté (le Chat de VS Code et le sélecteur Session Target en dépendent) | vue Chat ouverte |
| Python | ≥ 3.12 | `python3 --version` |
| uv (recommandé) ou pipx | récent | `uv --version` |
| mistral-vibe | 2.26.1 (testé) ; fournit `vibe` et `vibe-acp` | `vibe --version`, `which vibe-acp` |
| Compte Mistral | abonnement Le Chat Pro / Team / Enterprise, ou clé API (Vibe Code ou La Plateforme) | `vibe` démarre sans demander de clé |

Installation de Vibe :

```bash
uv tool install mistral-vibe     # ou : pipx install mistral-vibe
vibe --setup                     # connexion au compte Mistral ou saisie d'une clé
```

Sous Windows, installez Vibe dans le même environnement que celui où VS Code lance ses processus (natif, ou dans WSL en Remote-WSL). Sur macOS, renseignez `vibeBridge.command` avec un chemin absolu (`~/.local/bin/vibe-acp`) : une application lancée depuis le Dock n'hérite pas du PATH de zsh.

Images en pièce jointe : le modèle actif doit avoir `supports_images = true` dans `~/.vibe/config.toml` (champ `ModelConfig.supports_images` de Vibe).

Cibles « Continuer dans… » : Copilot CLI et Copilot Cloud demandent l'extension Copilot Chat ; Claude, Codex et Copilot (Agent Host) n'apparaissent que si l'Agent Host est activé dans votre build.

## Pour compiler et tester

| Élément | Version |
|---|---|
| Node.js | ≥ 20 (testé avec 20.20.2) |
| npm | ≥ 10 |
| git | pour `npm run dts` (téléchargement des `.d.ts` proposés) |
| Accès réseau | `npm install`, `npm run dts` ; tests d'intégration : aucun (modèle simulé local) |

Le mode `npm run test:integration:mistral` exige une clé valide dans `MISTRAL_API_KEY` et consomme du quota.
