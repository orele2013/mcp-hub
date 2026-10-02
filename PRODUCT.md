# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Developers who work with several AI coding agents at once (Claude Code, Codex, OpenCode, Gemini CLI, Cursor Agent) on their own Linux/desktop machine. The author is the first user; the product is meant to be published for other developers (the repository github.com/orele2013/mcp-hub is public).

They use it in four jobs, all confirmed as daily use:
- launching and supervising agents (terminals, delegated jobs, approvals, control room);
- managing MCP servers, accounts, API providers, secrets (Vault) and skills in one place;
- designing (prototypes, decks, documents) with any agent;
- doing all of the above from a phone when away from the computer (approve, check jobs, message agents).

## Product Purpose
One local place to configure and run every coding agent: a single MCP registry synced into each agent's own config, agents opened in embedded terminals, agents delegating work to each other with permissions, isolation and review, and a design studio that works with any agent. Success: the user stops editing five config files by hand and can trust what the agents are doing, from the desk or the phone.

## Positioning
Agent-agnostic and local-first. It is not tied to one vendor: the same MCPs, roles, approvals and design tools work across Claude Code, Codex, OpenCode, Gemini CLI and Cursor. Everything runs on the user's machine; the phone is a remote window into it, not a cloud service.

## Operating Context
- Runs as a local Node server at http://127.0.0.1:7777, opened as an app window (Chromium `--app`) via the `mcp-hub` command.
- Phone/tablet access over home Wi‑Fi (HTTPS :7778) or Tailscale, installed as a PWA, paired by QR.
- Long-running sessions: terminals stay open for hours; the user glances at status, approves actions, reads diffs.
- Notifications leave the app through Telegram, email, Discord, Slack and Home Assistant.

## Capabilities and Constraints
- Sections: Servidores MCP, Catálogo, Agentes (sessions, profiles, jobs, roles, templates, schedules, usage), Chat, Tablero, Proveedores, Skills, Bóveda, Diseño, Mapa del proyecto, Mensajería, Monitores, Integraciones, Móvil, Terminales, plus Sala de control and a Ctrl+K palette.
- Frontend is plain HTML/CSS/JS in `public/` with no build step; terminals are xterm.js. Design canvases are sandboxed iframes.
- Must work at desktop widths and at 390 px on a phone without horizontal scroll.
- Interface language today is Spanish only. Whether to add other languages for publication is undecided.

## Brand Commitments
- The name "MCP Hub" stays. Logo, colors and typography are not binding.

## Evidence on Hand
- README.md and ROADMAP.md (feature status and how each was verified).
- No users, testimonials, metrics or press exist; never fabricate them.

## Product Principles
1. One place, every agent: no feature should only make sense for a single vendor.
2. Trust through visibility: show what agents are doing, what they changed and what needs approval, before anything else.
3. Local and private by default: secrets stay on the machine and are never shown in full.
4. The phone is a first-class remote, not a shrunken desktop.
5. Plain language: explain actions and risks in everyday words, not jargon.
