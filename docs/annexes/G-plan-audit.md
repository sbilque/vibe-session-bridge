# Annexe G — Plan : audit complet de vibe-session-bridge et livraison 0.1.0 (non testée)

Retour : [README](../../README.md) · [ADR](../adr/README.md)

## Phase 1 — Référentiel (sources uniquement, rien d'inventé)
1. **VS Code / Copilot** (`microsoft/vscode@main`) :
   - mécanisme « Continue In » de Claude/Copilot : où il est déclaré, quelle API, ce qui est transféré (historique, fichiers, option de session) ;
   - API proposées `chatSessionsProvider`, `chatParticipantAdditions`, `chatParticipantPrivate` : liste exhaustive des membres ;
   - contribution `chatSessions` de Copilot CLI (`extensions/copilot/package.json`) : champs utilisés (commands, capabilities, when…).
2. **ACP** (`@agentclientprotocol/sdk` 1.8.0) : liste de toutes les méthodes agent/client et de toutes les variantes `SessionUpdate`.
3. **Vibe 2.26.1** (`vibe/acp/*.py`) : méthodes réellement implémentées, notifications émises, capacités annoncées, `_meta` lus.

## Phase 2 — Matrice de couverture
Pour chaque élément (méthode ACP, notification, capacité, membre d'API VS Code, fonction de Claude) : *utilisé par Vibe ?* / *disponible dans VS Code ?* / *implémenté dans le pont ?* / *testé ?* → liste des oublis classés :
- **A** utile et faisable avec des API réelles → à corriger ;
- **B** faisable partiellement → corriger avec limite documentée ;
- **C** impossible (API interne, non exposée par Vibe) → documenter.

## Phase 3 — « Continue In »
Comparer le flux Claude (handoff d'une session locale vers une autre cible, et l'inverse) avec ce que permettent l'API d'extension et ACP. Implémenter l'équivalent réaliste s'il existe (ex. contribution de handoff, reprise d'historique via `ChatContext.history`, `session/load`), sinon documenter.

## Phase 4 — Corrections
Implémentation des points A/B, chacun relié à sa source (fichier + fonction) en commentaire.

## Phase 5 — Contrôle
`tsc --strict`, tests unitaires, tests d'intégration sur les deux moteurs Vibe, nouveaux tests pour chaque correction, smoke test.

## Phase 6 — Livraison
`vibe-session-bridge-<version>.tar.gz` : sources, tests, scripts, `.vsix` construit, `README.md`, `MODE-EMPLOI.md`, `PREREQUIS.md`, `COMPARAISON.md`, `AUDIT.md` (matrice), `CHANGELOG.md`.
