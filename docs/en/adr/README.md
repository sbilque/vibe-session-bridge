# Architecture Decision Records

Languages: **English** | [Français](../../fr/adr/README.md)

Development version 0.1.0, not tested in real conditions: the consequences described are expected, not observed in VS Code.

Format: [Michael Nygard](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) (Context, Decision, Consequences). An accepted ADR is never rewritten: a new ADR supersedes it (status "Superseded by NNNN"). Template: [template.md](template.md).

| No. | Decision | Status | Since |
|---|---|---|---|
| [0001](0001-acp-v1-official-sdk.md) | Use ACP v1 and the official SDK, with no custom protocol | Accepted | 0.1.0 |
| [0002](0002-session-target-chatsessionsprovider.md) | Integrate Vibe as a Session Target through the proposed chatSessionsProvider API | Accepted | 0.1.0 |
| [0003](0003-shell-unified-and-legacy.md) | Shell engine: Unified Harness by default, ACP terminal as an option | Accepted | 0.1.0 |
| [0004](0004-permissions-and-elicitation.md) | Vibe permissions and questions in the native Chat UI | Accepted | 0.1.0 |
| [0005](0005-continue-in-via-commands.md) | "Continue In" through public commands, not the native menu | Accepted | 0.1.0 |
| [0006](0006-vibe-extension-methods.md) | Vibe extension methods prefixed with "_" | Accepted | 0.1.0 |
| [0007](0007-integration-tests-real-vibe.md) | Integration tests with a real vibe-acp and a simulated model | Accepted | 0.1.0 |
| [0008](0008-prompt-content.md) | Prompt content based on the capabilities advertised by the agent | Accepted | 0.1.0 |

Appendices: [A audit](../appendices/A-coverage-audit.md) · [B Claude/Copilot comparison](../appendices/B-claude-copilot-comparison.md) · [C ACP mapping](../appendices/C-acp-vscode-mapping.md) · [D tests](../appendices/D-tests.md) · [E prerequisites](../appendices/E-prerequisites.md) · [F user guide](../appendices/F-user-guide.md) · [G audit plan](../appendices/G-audit-plan.md)
