---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: ["public/style.css"]
---

# MCP Hub app (all views)

Scope: the whole local app UI (public/index.html and every view module), desktop and 390 px phone. Visitor mode: Operate.
Audience and job: developers running several coding agents; configure MCPs and accounts, launch and supervise agents and jobs, approve, design, often from the phone. Opened full screen for a while, then closed (desk, daylight).
Constraints from the user: navigation and section order stay exactly as they are; information density must not drop; it must not look like a generic SaaS dashboard. In Diseño the canvas takes almost the whole screen.

## Direction contract

THESIS: Agents are paperback series. Every agent owns one flat series colour, every view is a three-band cover (black title band, light panel holding the dense working table, thin foot band), Design projects stand as covers and spines. Refuses the dark-panel developer dashboard with one purple accent.

OWN-WORLD: Off-white cover stock ground, ink black bands, an eleven-step warm-neutral ramp and nothing grey outside it. Series colours: Claude orange, Codex green, Gemini blue, OpenCode purple, Cursor slate; they are the only hues that tint, plus one lamp ochre reserved for what is running right now and a corrector red only where something needs the user. Cabin (Johnston/Gill lineage) everywhere, tracked caps on bands; thick horizontal rules, square corners on bands, 3 px corners on controls. States are printed marks at one device pixel: hairline box at rest, filled when on, struck through when disabled, bracketed on focus. Status severity by fixed dot size before colour. Terminals stay dark, like printouts pasted onto the page.

STORY: Glance: which agents are live (lamp), what needs me (red), what changed (evidence beside each state: diff, output). Then act from the same table.

FIRST VIEWPORT: Servidores MCP. Left: same nav, paper column, active item a black slab. Main: black band with "SERVIDORES MCP" in tracked caps and counts at right; under it the stats row as a ruled ledger, then the server table with five agent columns headed by series-colour swatches and printed-mark switches; primary action (Añadir servidor) is the black slab button in the band.

FORM: Penguin colour-coded paperback series (tri-band cover, Marber grid); position 7 of 7 on the grounded list (assigned); seed key af4cbbb3, re-roll 1. Raises kept: 11-step tonal ramp; state paired with its evidence; full-bleed canvas in Diseño; one reserved colour for live. Signature interaction: on navigation the view band wipes in from the left in 200 ms; live rows carry the lamp.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
