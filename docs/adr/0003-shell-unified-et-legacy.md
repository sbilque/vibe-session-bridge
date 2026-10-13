# ADR 0003 — Moteur shell : Unified Harness par défaut, terminal ACP en option

- Statut : Acceptée
- Date : 2026-10-13
- Version : 0.5.0

## Contexte

Vibe 2.26.1 a deux moteurs. Par défaut (Unified Harness), le shell s'exécute dans Vibe, sans `terminal/create`, et sans code de sortie (`rawOutput` = `stdout`, `stderr`, `output`, `truncated`). Avec `--legacy-harness`, le shell est délégué au terminal ACP du client et le mode `plan` apparaît.

## Décision

Implémenter complètement le terminal ACP côté VS Code (`terminal/create`, `output`, `wait_for_exit`, `kill`, `release`, miroir `Pseudoterminal`), annoncer la capacité `terminal`, mais laisser le moteur par défaut de Vibe. Le choix se fait par `vibeBridge.args: ["--legacy-harness"]`. Les deux moteurs sont testés.

## Conséquences

- Par défaut : pas de code de sortie dans le chat (limite documentée de Vibe).
- Legacy : commandes visibles dans le panneau Terminal, code de sortie, mais moteur appelé à disparaître côté Vibe.

## Sources

[mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/app_server/_tool_io.py::run_shell`, `_effect_models.py` ; annexe [D](../annexes/D-tests.md)
