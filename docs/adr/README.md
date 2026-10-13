# Architecture Decision Records

Projet en version de développement 0.1.0, non testé en conditions réelles : les conséquences décrites sont attendues, pas constatées dans VS Code.

Format : [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (Contexte, Décision, Conséquences), en français. Une ADR acceptée n'est pas réécrite : une nouvelle ADR la remplace (statut « Remplacée par NNNN »). Modèle : [template.md](template.md).

| N° | Décision | Statut | Depuis |
|---|---|---|---|
| [0001](0001-acp-v1-sdk-officiel.md) | Utiliser ACP v1 et le SDK officiel, sans protocole maison | Acceptée | 0.1.0 |
| [0002](0002-session-target-chatsessionsprovider.md) | Intégrer Vibe comme Session Target via l'API proposée chatSessionsProvider | Acceptée | 0.1.0 |
| [0003](0003-shell-unified-et-legacy.md) | Moteur shell : Unified Harness par défaut, terminal ACP en option | Acceptée | 0.1.0 |
| [0004](0004-permissions-et-elicitation.md) | Permissions et questions de Vibe dans l'interface native du Chat | Acceptée | 0.1.0 |
| [0005](0005-continue-in-par-commandes.md) | « Continue In » par commandes publiques, pas par le menu natif | Acceptée | 0.1.0 |
| [0006](0006-methodes-extension-vibe.md) | Méthodes d'extension Vibe préfixées par « _ » | Acceptée | 0.1.0 |
| [0007](0007-tests-integration-vrai-vibe.md) | Tests d'intégration avec un vrai vibe-acp et un modèle simulé | Acceptée | 0.1.0 |
| [0008](0008-contenu-du-prompt.md) | Contenu du prompt selon les capacités annoncées par l'agent | Acceptée | 0.1.0 |

Annexes : [A audit](../annexes/A-audit-couverture.md) · [B comparaison Claude/Copilot](../annexes/B-comparaison-claude-copilot.md) · [C correspondance ACP](../annexes/C-correspondance-acp-vscode.md) · [D tests](../annexes/D-tests.md) · [E prérequis](../annexes/E-prerequis.md) · [F mode d'emploi](../annexes/F-mode-emploi.md) · [G plan d'audit](../annexes/G-plan-audit.md)
