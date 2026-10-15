# ADR 0008 — Prompt content based on the capabilities advertised by the agent

Languages: **English** | [Français](../../fr/adr/0008-prompt-content.md)

- Status: Accepted (not validated in real conditions)
- Date: 2026-10-13
- Version: 0.1.0 (development)

## Context

Vibe advertises `promptCapabilities.image` and `embeddedContext`. In the first iterations, only file references were sent (`resource_link`): selections, pasted text, images and slash commands were lost.

## Decision

`src/prompt.ts`: `Uri` → `resource_link`; `Location` with a range → embedded `resource` (excerpt only); text → text `resource`; image (`ChatReferenceBinaryData`) → base64 `image`; `request.command` → `/cmd` at the start of the text, executed by Vibe (`commands/controller.py`). Falls back to text if a capability is not advertised. Vibe built-in commands are declared in `contributes.chatSessions[].commands`.

## Consequences

- Images are only useful if the Vibe model has `supports_images = true`.
- Vibe skills: no autocompletion (no dynamic command API), type them in full.

## Sources

[ACP SDK](https://www.npmjs.com/package/@agentclientprotocol/sdk) `ContentBlock`; [mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/acp/image_blocks.py`, `commands/registry.py`
