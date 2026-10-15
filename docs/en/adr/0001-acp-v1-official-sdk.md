# ADR 0001 — Use ACP v1 and the official SDK, with no custom protocol

Languages: **English** | [Français](../../fr/adr/0001-acp-v1-official-sdk.md)

- Status: Accepted (not validated in real conditions)
- Date: 2026-10-13
- Version: 0.1.0 (development)

## Context

Vibe exposes an agent through `vibe-acp` (entry point `vibe.acp.entrypoint:main`, dependency `agent-client-protocol`). A bridge could also drive the `vibe` CLI by parsing its output, or define its own protocol.

## Decision

The bridge speaks only Agent Client Protocol v1 (`PROTOCOL_VERSION = 1`) using `ClientSideConnection` and `ndJsonStream` from `@agentclientprotocol/sdk` 1.8.0, pinned. Every function used must exist in `vibe/acp/agent.py`; each call is commented with its source file.

## Consequences

- No invented functions: what Vibe does not implement (`session/resume` not advertised, `logout`) is not used.
- Updating the SDK means reviewing appendix A.
- Vibe extensions go through `extMethod` (see [ADR 0006](0006-vibe-extension-methods.md)).

## Sources

[mistral-vibe](https://github.com/mistralai/mistral-vibe) `vibe/acp/agent.py`, `pyproject.toml`; [ACP SDK](https://www.npmjs.com/package/@agentclientprotocol/sdk)
