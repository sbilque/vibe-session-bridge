# Security policy

Languages: **English** | [Français](SECURITY-fr.md)

## Supported versions

The project is under development and has not been tested in real conditions: no security or functional guarantee.

| Version | Fixes |
|---|---|
| 0.1.x (development, untested) | Best effort |

## Reporting a vulnerability

Do not open a public issue. Use [GitHub private reporting](https://github.com/sbilque/vibe-session-bridge/security/advisories/new), describing the version, the impact and the steps to reproduce. Acknowledgement targeted within 7 days.

## Points of attention

- The extension starts `vibe-acp` and gives it read/write access to workspace files and a terminal: only use `auto-approve` mode on trusted projects.
- Credentials remain managed by Vibe (`~/.vibe/.env` or Mistral account sign-in); the extension neither reads nor stores them. Never commit `.vibe/.env`.
- Vulnerabilities in Vibe itself: report them to [Mistral AI](https://github.com/mistralai/mistral-vibe).
