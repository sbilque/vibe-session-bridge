# ADR 0005 — "Continue In" through public commands, not the native menu

Languages: **English** | [Français](../../fr/adr/0005-continue-in-via-commands.md)

- Status: Accepted (not validated in real conditions)
- Date: 2026-10-13
- Version: 0.1.0 (development)

## Context

The "Continue Chat in…" menu (`chatContinueInAction.ts`) only offers `copilotcli`, `copilot-cloud-agent` and Agent Host types (`getAgentCanContinueIn`, `isAgentHostTarget`). A third-party type never appears there. VS Code does however expose the commands it uses: `workbench.action.chat.delegateToAgentHostSession` `{type, displayName, prompt}` and `workbench.action.chat.openNewSessionEditor.<type>` `{prompt}`, generated for every contributed type.

## Decision

Command "Mistral Vibe: Continue in…" (`chat/chatSessions` menu) targeting local Chat, Copilot CLI, Copilot Cloud and the Claude, Codex and Copilot Agent Hosts. The transcript follows `buildDelegationTranscript` (`User:` / `Assistant:`, last 20,000 characters) and the `chat.delegation.inlinePrompt` text. Reverse direction: `ChatContext.history` injected on the first turn; editor command "Continue in Mistral Vibe"; `/teleport` for Vibe Code Web.

## Consequences

- Same result as the native menu, reached from a different menu.
- Agent Host targets are missing if the Agent Host is not enabled: an error message is shown.
- Type identifiers are hard-coded from `chatSessionsService.ts`: re-check them with each VS Code version.

## Sources

[microsoft/vscode](https://github.com/microsoft/vscode) `chatContinueInAction.ts`, `agentSessions.ts`, `chatSessionsService.ts`; appendix [A](../appendices/A-coverage-audit.md)
