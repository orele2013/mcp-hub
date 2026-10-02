---
name: MCP Hub
description: One local place to configure and run every coding agent, printed as a colour-coded paperback series.
colors:
  cover-white: "#FCFCFA"
  stock: "#F4F3EF"
  index-tab: "#EAE9E3"
  hairline: "#DCDAD3"
  rule: "#C4C1B8"
  stone: "#A29E94"
  pencil: "#6F6C64"
  muted-ink: "#57544D"
  graphite: "#3D3B36"
  band-raised: "#262522"
  ink: "#141413"
  series-claude: "#D9601A"
  series-codex: "#1E7A4F"
  series-gemini: "#2B5BA8"
  series-opencode: "#6B4C9A"
  series-cursor: "#4B5058"
  lamp: "#C98A00"
  lamp-wash: "#FBF0D2"
  lamp-line: "#E8CF8C"
  lamp-text: "#7A5400"
  advisory-wash: "#FBF1DA"
  advisory-line: "#E3C987"
  corrector: "#C42F2A"
  corrector-text: "#A3221D"
  corrector-wash: "#FBE6E3"
  corrector-line: "#EBB3AD"
  terminal-text: "#E9E7E0"
typography:
  display:
    fontFamily: "Cabin Variable, Cabin, Gill Sans, Gill Sans MT, system-ui, sans-serif"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "0.12em"
  band-numeral:
    fontFamily: "Cabin Variable, Cabin, Gill Sans, system-ui, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  headline:
    fontFamily: "Cabin Variable, Cabin, Gill Sans, system-ui, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    letterSpacing: "-0.02em"
    fontFeature: "\"tnum\""
  title:
    fontFamily: "Cabin Variable, Cabin, Gill Sans, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 700
  row-title:
    fontFamily: "Cabin Variable, Cabin, Gill Sans, system-ui, sans-serif"
    fontSize: "14.5px"
    fontWeight: 700
  body:
    fontFamily: "Cabin Variable, Cabin, Gill Sans, Gill Sans MT, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    letterSpacing: "0.005em"
    fontFeature: "\"kern\", \"liga\", \"tnum\""
  body-control:
    fontFamily: "Cabin Variable, Cabin, Gill Sans, system-ui, sans-serif"
    fontSize: "13.5px"
    fontWeight: 500
  label:
    fontFamily: "Cabin Variable, Cabin, Gill Sans, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 700
    letterSpacing: "0.16em"
  label-table:
    fontFamily: "Cabin Variable, Cabin, Gill Sans, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    letterSpacing: "0.12em"
  mono:
    fontFamily: "Geist Mono Variable, Geist Mono, ui-monospace, monospace"
    fontSize: "12.5px"
    fontWeight: 400
    fontFeature: "\"tnum\""
rounded:
  none: "0px"
  mark: "2px"
  control: "3px"
  panel: "4px"
spacing:
  xs: "6px"
  sm: "12px"
  md: "18px"
  band-y: "22px"
  section: "30px"
  gutter: "40px"
  gutter-compact: "24px"
  gutter-phone: "14px"
  foot: "44px"
components:
  band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cover-white}"
    typography: "{typography.display}"
    rounded: "{rounded.none}"
    padding: "22px 40px 20px"
  button-default:
    backgroundColor: "{colors.cover-white}"
    textColor: "{colors.ink}"
    typography: "{typography.body-control}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-default-hover:
    backgroundColor: "{colors.index-tab}"
    textColor: "{colors.ink}"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cover-white}"
    rounded: "{rounded.control}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.cover-white}"
  button-primary-in-band:
    backgroundColor: "{colors.cover-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    height: "36px"
  button-primary-in-band-hover:
    backgroundColor: "{colors.index-tab}"
  button-in-band:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cover-white}"
    rounded: "{rounded.control}"
    height: "36px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted-ink}"
    rounded: "{rounded.control}"
  button-danger:
    backgroundColor: "{colors.cover-white}"
    textColor: "{colors.corrector-text}"
    rounded: "{rounded.control}"
  button-danger-hover:
    backgroundColor: "{colors.corrector-wash}"
  button-disabled:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.stone}"
  input-field:
    backgroundColor: "{colors.cover-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "0 12px"
    height: "36px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.graphite}"
    typography: "{typography.body-control}"
    rounded: "{rounded.mark}"
    padding: "0 10px"
    height: "34px"
  nav-item-hover:
    backgroundColor: "{colors.hairline}"
    textColor: "{colors.ink}"
  nav-item-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cover-white}"
  pill:
    backgroundColor: "{colors.cover-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.mark}"
    padding: "3px 8px"
  pill-live:
    backgroundColor: "{colors.lamp-wash}"
    textColor: "{colors.lamp-text}"
    rounded: "{rounded.mark}"
  pill-alert:
    backgroundColor: "{colors.corrector-wash}"
    textColor: "{colors.corrector-text}"
    rounded: "{rounded.mark}"
  tag:
    backgroundColor: "{colors.index-tab}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.mark}"
    padding: "2px 6px"
  chip:
    backgroundColor: "{colors.cover-white}"
    textColor: "{colors.graphite}"
    rounded: "{rounded.mark}"
    padding: "0 14px"
    height: "32px"
  chip-on:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cover-white}"
  stat-ledger:
    backgroundColor: "{colors.cover-white}"
    textColor: "{colors.ink}"
    typography: "{typography.headline}"
    rounded: "{rounded.none}"
    padding: "14px 18px 15px"
  table-panel:
    backgroundColor: "{colors.cover-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "0 18px"
  card:
    backgroundColor: "{colors.cover-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "14px"
  modal-sheet:
    backgroundColor: "{colors.cover-white}"
    textColor: "{colors.ink}"
    rounded: "{rounded.none}"
    padding: "24px"
  toast:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.cover-white}"
    rounded: "{rounded.control}"
    padding: "11px 14px 11px 12px"
  toast-error:
    backgroundColor: "{colors.corrector}"
    textColor: "{colors.cover-white}"
  switch-off:
    backgroundColor: "{colors.cover-white}"
    rounded: "{rounded.mark}"
    size: "20px"
  switch-on:
    backgroundColor: "{colors.series-claude}"
    textColor: "{colors.cover-white}"
    rounded: "{rounded.mark}"
    size: "20px"
  terminal:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.terminal-text}"
    typography: "{typography.mono}"
    padding: "16px 14px 12px 20px"
---

# Design System: MCP Hub

## Overview

**Creative North Star: "The Colour-Coded Paperback Series"**

Every agent is a paperback series with one flat series colour, and every view is a cover in three bands: a black title band carrying the section name in tracked capitals, a light working panel holding the dense table, and a thin black foot band. The model is the mid-century colour-coded pocket series (tri-band cover, a strict grid of rules): authority comes from ink, rules and position, not from surfaces or gradients. Design projects are covers too, each topped by its agent's series stripe, and a folded chat panel becomes a spine with its title running vertically.

The page is off-white cover stock with ink; an eleven-step warm-neutral ramp supplies every grey. Colour is scarce and carries meaning. The five series colours mark which agent something belongs to. A lamp ochre marks what is running right now. A corrector red marks what needs the user. Nothing else tints. States are printed marks at one device pixel: a hairline box at rest, filled when on, struck through when disabled, and bracketed by an ink outline on focus. Terminals stay dark, like printouts pasted onto the page.

Density is high on purpose. Tables keep five agent columns, ledgers keep four figures, and the sidebar keeps every section with its count. The system refuses the dark-panel developer dashboard with a single purple accent. It also refuses the rounded-card SaaS look the codebase started from, whose 10 to 16 px radii the world layer flattens to 0 to 4 px.

**Key Characteristics:**
- Three-band covers: a black band (`#141413`), a light panel, and a 6 px black foot band on every scrolling view.
- One series colour per agent, applied through a single `--series` custom property keyed by `data-k`, `data-client` or `data-agent`.
- Three reserved signal colours in all: series hues for "whose", lamp ochre for "running now", corrector red for "needs you".
- Cabin in tracked uppercase on bands and labels, sentence case everywhere else, Geist Mono for commands and figures in code.
- Square corners on anything that carries a band, 3 px on controls, 2 px on printed marks.
- A flat page. Only floating sheets cast shadows.

## Colors

The palette is cover stock and ink with five flat series colours and two reserved signals. Each colour has exactly one job.

### Primary
- **Press Ink** (ink, `--n10`): Title bands, foot bands, the active navigation slab, primary buttons on the page, filled chips and segments, selected palette rows, the user's own chat bubbles, toasts, logo plates, terminal ground, and focus outlines. Healthy status is also ink: the revision remaps `--ok` to ink, so "fine" reads as a printed tick, never as green.

### Secondary: Series Colours
- **Claude Orange** (series-claude): Claude's series.
- **Codex Green** (series-codex): Codex's series. This is the only green in the system.
- **Gemini Blue** (series-gemini): Gemini's series. It also colours diff hunk headers.
- **OpenCode Purple** (series-opencode): OpenCode's series.
- **Cursor Slate** (series-cursor): Cursor's series.

Series colours appear only as a filled printed-mark switch in that agent's column, the 3 px foot stripe inside a logo plate, the 6 px top rule of an agent card, the 8 px top stripe of a Design project cover, the 3 px inset stripe on list thumbnails, and the 8 px head of a folded Design spine. The shell has no series colour. Its plate is plain ink.

### Tertiary: Signals
- **Lamp Ochre** (lamp, with lamp-wash, lamp-line and lamp-text): Only what is running right now. Examples are live session dots in the sidebar, terminal tabs and the control room, the Terminales count badge, the "EN CURSO" board column, jobs and board cards that are working, the starred-project mark, and the ledger cell for "Por revisar" when it is non-zero, which gets a wash plus a 9 px lamp dot after the figure.
- **Corrector Red** (corrector, with corrector-text, corrector-wash and corrector-line): Only where something needs the user. Examples are 10 px error dots with a 2 px wash ring, pending approvals (3 px red top rule), the "REVISAR" board column, a monitor that is down, danger buttons, error toasts, and error pills.
- **Advisory Wash** (advisory-wash, advisory-line): Background and edge for configuration banners and warning callouts. It sits beside the lamp hue and must not be read as "running".

### Neutral
An eleven-step warm ramp (`--n0` to `--n10`). No grey outside it.
- **Cover White** (`--n0`): Working panels, tables, ledgers, cards, inputs, sheets, and the text on bands.
- **Stock** (`--n1`): The page ground of every view, row hover, and the disabled-button fill.
- **Index Tab** (`--n2`): Sidebar paper, board column bodies, terminal side rails, tags, soft buttons, and hover fills.
- **Hairline** (`--n3`): Row dividers, card edges, ledger cell dividers, and nav hover.
- **Rule** (`--n4`): Control borders at rest, sidebar edge, light text on bands (`--band-sub`), and scrollbar thumbs.
- **Stone** (`--n5`): Disabled text and the "IDEAS" column rule.
- **Pencil** (`--n6`): Placeholders, hints, nav icons, and command lines under server names.
- **Muted Ink** (`--n7`): Secondary text, table headers, and the borders of outline buttons on a band.
- **Graphite** (`--n8`): Body copy in cards and pills, and the primary-button hover.
- **Band Raised** (`--n9`): Search, segments, and code inside the black band, and hover on band buttons.
- **Terminal Text** (terminal-text): Type on dark terminal ground only.

### Named Rules
**The Series Rule.** Only an agent's own series colour may tint something that belongs to that agent. It travels through `--series`, never as a literal hex in a component. Borrowing a series hue for a meaning that is not "this agent" breaks the code.

**The Lamp Rule.** Ochre means "running right now", nothing else. A warning that is neither running nor needing the user is neutral and dashed (`1px dashed` stone or muted ink), not ochre.

**The Corrector Rule.** Red appears only where the user must act or something has failed. It is never decoration and never a brand accent.

**The Ink-Is-Healthy Rule.** Healthy, connected or installed is shown in ink: a ticked pill, a 6 px ink dot, or an ink-bordered card. Green belongs to Codex alone.

## Typography

**Display Font:** Cabin Variable (Johnston/Gill lineage; fallbacks Cabin, Gill Sans, Gill Sans MT, system-ui)
**Body Font:** Cabin Variable (same family)
**Label/Mono Font:** Geist Mono Variable (fallback ui-monospace)

**Character:** One humanist sans does every job, as on a series cover. Rank comes from weight 700, capitals and wide tracking rather than from size. Geist Mono is the typewriter beside it for commands, paths, addresses, counts in the index and keys. Kerning, ligatures and tabular figures are on globally, so every column of numbers aligns.

### Hierarchy
- **Display** (700, 21 px, line-height 1.15, tracking 0.12em, uppercase): The section name in the title band ("SERVIDORES MCP", "TABLERO"). The chat list head uses the same style. On phones the band title is hidden because the mobile top bar shows it at 14 px, 700, 0.12em, uppercase.
- **Band Numeral** (700, 40 px, line-height 1, tracking −0.02em, tabular): The section count in the band's right corner, behind a 1 px graphite divider, like a series number. `syncBand()` copies it from the sidebar count into `data-count`. It is hidden at 900 px and below.
- **Headline** (700, 30 px, tracking −0.02em, tabular): Ledger figures. They drop to 24 px on phones.
- **Design Prompt** (700, 26 px, tracking 0.06em, uppercase): The single question above the Design composer ("¿QUÉ CREAMOS?").
- **Title** (700, 17 px): Window and sheet titles. The small explanatory line sits below the title at 12.5 px regular in pencil, never above it.
- **Row Title** (700, 14.5 px): Server names and card heads.
- **Body** (400, 14 px root, tracking 0.005em): Running text. Band subtitles are 13.5 px in rule grey with a maximum of 72ch.
- **Control** (500, 13.5 px; 600 on primary): Buttons, nav items and inputs. Small buttons use 12.5 px.
- **Label** (700, 11.5 px, tracking 0.16em, uppercase): Section titles over a 2 px ink rule, board column heads, and sidebar group titles (10.5 px). The brand wordmark uses 15 px, 700, 0.14em, uppercase.
- **Table Label** (700, 11 px, tracking 0.12 to 0.14em, uppercase): Table headers and ledger captions ("SERVIDORES", "POR REVISAR").
- **Mono** (Geist Mono, 12.5 px, tabular): Commands, paths, addresses, nav counts and kbd hints.

### Named Rules
**The Tracked Band Rule.** Capitals with 0.12 to 0.16em tracking are reserved for bands, section rules, table and ledger captions, board column heads and the brand. Body text, buttons and names stay in sentence case.

**The Tabular Rule.** Every figure is tabular: ledger cells, band numerals, nav counts and table counts. Numbers must line up down a column.

## Layout

The app is a fixed 248 px sidebar (index-tab paper with a 1 px rule edge) beside a scrolling main column. Each main view is a cover:

1. **Title band.** Black, full bleed to the view edges through negative margins. Padding is 22 px on top and 20 px below, with the horizontal gutter on the sides. The section name and subtitle sit on the left, the actions on the right, and the count numeral in the far corner. The band carries a 6 px stock gap and then a 1 px ink line, which reads as a printed double rule. On navigation it wipes in from the left (`clip-path` inset, 220 ms, `cubic-bezier(.2,.8,.2,1)`). With reduced motion it does not animate.
2. **Working panel.** Stock ground, with content 22 px below the band. Ledgers and tables are cover-white sheets hung from a 2 px ink top rule and closed by a 1 px rule. Section titles open 30 px above with a 2 px ink underline.
3. **Foot band.** A 6 px ink bar, full bleed, pinned to the bottom of the view. The view is a flex column and the foot takes `margin-top: auto`, so the foot sits at the bottom even when there is little content. The last block keeps 44 px of clearance above it. Terminals, Chat and an open Design project have no foot band because they are full-height instruments.

**Gutters:** 40 px with a 30 px top inset at desktop. 24 px at 1280 px and below. 14 px with a 16 px top inset at 900 px and below, plus the bottom safe-area inset.

**Rhythm:** Blocks sit 20 px apart. Gaps are 12 px in grids and board columns, and 18 px horizontally and 22 px vertically in the Design gallery. Ledger cells are padded 14 px by 18 px. Rows are at least 64 px tall, and header rows 52 px.

**Breakpoints:** 1500 px (Design top bar loses button labels), 1280 px (compact gutters), 1100 px (Design side panel narrows to 320 px, map and control room stack), 900 px (phone layout).

**Phone (900 px and below):** A black mobile bar replaces the sidebar, which becomes an overlay drawer. Band actions wrap into full-width rows with the primary action last at full width. The ledger becomes two columns divided by hairlines. Tables keep a 760 px minimum and scroll inside their own panel, so the page never scrolls sideways. Tags beside server names are hidden.

**Design, opened:** The canvas takes the screen. The sidebar collapses to a 64 px icon rail. The chat panel can fold into a 44 px spine (`#dz-fold`, remembered in `localStorage`). The canvas sits on hairline grey with the stage lifted by its own shadow.

### Named Rules
**The Three-Band Cover Rule.** Every scrolling view has a black title band, a light working panel, and a 6 px black foot band. A new view that drops a band no longer belongs to the series.

**The Density Rule.** Keep the table. Information is shown as ruled rows and ledgers, not as a grid of floating cards, and the phone layout reflows the same content without removing it.

## Elevation & Depth

The page is flat. Depth comes from ink rules and tonal steps on the warm ramp: stock ground, cover-white sheets, index-tab rails, and black bands. Hover changes the border or fill, never lifts. Shadows exist only for things that genuinely float above the page.

### Shadow Vocabulary
- **Float** (`--shadow`: `0 1px 2px rgba(20,20,19,.06), 0 8px 24px rgba(20,20,19,.10)`): Toasts, popovers and menus, the Design composer box, floating Design toolbars, and the hover state of a project cover (paired with a 1 px ink ring).
- **Sheet** (`--shadow-lg`: `0 2px 6px rgba(20,20,19,.08), 0 24px 60px rgba(20,20,19,.18)`): Modals, the Ctrl+K palette, and the phone sidebar drawer.
- **Stage** (`0 1px 3px rgba(20,20,19,.12), 0 18px 50px rgba(20,20,19,.18)`): The Design canvas stage only.
- **Scrim** (`rgba(20,20,19,.42)`, no blur): Behind modals and the palette.

### Named Rules
**The Flat Page Rule.** Nothing that sits on the page casts a shadow. Bands, tables, ledgers, cards and board columns are separated by rules and tone. A shadow means "this floats and will go away".

**The Printed Rule Weights Rule.** Rules come in fixed weights: 6 px for cover bands and sheet heads (title-band gap, foot band, agent cards, modals, palette, lockbox, integrations, board columns, Design composer); 3 px for the brand underline, approvals, monitors and the chat list head; 2 px for the tops of tables, ledgers, logs, section titles and callouts; and 1 px hairlines for everything else.

## Shapes

The shapes are rectangles with live corners. Anything that carries a band or a heavy top rule is square (0): bands, agent cards, modals and sheets, the palette, approvals, monitors, board columns, the lockbox, integrations, the Design composer, callouts, tables, ledgers and project covers. Controls such as buttons, inputs, search, segments, toasts and logo plates have 3 px corners. Cards, banners, code blocks, bubbles and popovers have 4 px corners. Printed marks such as pills, tags, chips, nav items, tab tops, switches, sessions and kbd have 2 px corners. Dots are the only circles.

The app icon follows the same rules. It is a black plate with an off-white panel holding the hub glyph (square-capped strokes) and a foot strip divided into the five series colours, in order: Claude, Codex, Gemini, OpenCode, Cursor.

### Named Rules
**The Live Corner Rule.** If it has a band or a top rule of 2 px or more, its corners are square. The world layer enforces this with `border-radius: 0 !important`.

## Components

### Buttons
Printed slabs: flat, hairline-bordered, and heavier when they matter.
- **Shape:** Slightly eased corners (3 px). Heights are 36 px by default, 32 px small, 28 px extra small, and 32 px square for icon buttons.
- **Default:** Cover white with a rule border and ink text, 500 weight. On hover the fill becomes index tab and the border graphite. When pressed the fill becomes hairline. Transitions are 150 ms on background, border and colour.
- **Primary on the page:** An ink slab with cover-white text at 600 weight that turns graphite on hover.
- **Inside a black band:** The relationship inverts. The primary is a cover-white slab with ink text (for example "Añadir servidor" or "Nueva tarjeta"). Secondary buttons are transparent with a muted-ink outline and turn band-raised on hover.
- **Ghost:** Transparent and borderless in muted ink. On hover it gets an index-tab fill and ink text.
- **Danger:** Cover white with a corrector-line border and corrector text. On hover it gets the corrector wash and a corrector border.
- **Warning-ghost (neutral advisory):** Cover white with a `1px dashed` muted-ink border and ink text.
- **Disabled:** The stock fill, a hairline border and stone text, with the label struck through (1 px). Icon and busy buttons are not struck through.
- **Focus:** A 2 px ink outline at a 2 px offset, the "bracket".

### Printed-Mark Switch (signature)
The on/off for "this server in this agent" is a printed checkbox, not a slide toggle.
- **At rest:** A 20 px square with 2 px corners, cover-white fill and an inset 1.5 px muted-ink box, inside a 40 px hit area. On hover the box turns ink.
- **On:** The fill and edge take the agent's `--series` colour (ink if none) with a cover-white tick that scales in over 180 ms.
- **Mismatch** (the config on disk disagrees with the registry): a 3 px lamp halo outside the box.
- **Focus:** An ink box, a 2 px stock gap and a 2 px ink ring.
- **Busy:** 45% opacity.

### Status Dots
Severity is shown by size first and colour second. "Ok" is a 6 px ink dot. "Warning" is an 8 px dot. "Error" is a 10 px corrector dot with a 2 px corrector-wash ring. Live sessions and terminal tabs use an 8 px lamp dot. Dots keep a fixed slot before names so names do not jump.

### Chips, Pills and Tags
Rubber stamps.
- **Pill:** 2 px corners, 11.5 px text, padding 3 px by 8 px, cover white with a rule border. The ok pill is ink with a drawn tick (an L-shaped border rotated −45°) in place of an icon. The running pill uses the lamp wash, lamp line and lamp text. The error pill uses the corrector wash, line and text at 600 weight.
- **Tag:** 10 px uppercase, 0.1em tracking, index-tab fill, graphite text, 2 px corners. It is used for transport labels such as "STDIO" and "HTTP".
- **Chip / filter:** 32 px tall, 2 px corners, a rule border, and ink text on hover. When on, it is an ink slab.

### Cards / Containers
- **Corner Style:** Panels 4 px. Anything with a top rule is square.
- **Background:** Cover white on stock ground.
- **Shadow Strategy:** None. See Elevation & Depth.
- **Border:** A 1 px hairline that turns stone on hover. An installed card gets a graphite border, not green.
- **Agent card:** Square, with a 6 px top rule in the agent's series colour. A ghost (absent) agent is stock-filled with a dashed rule border.
- **Internal Padding:** 14 px for cards and 16 px for agent cards.

### Ledger (stats row)
A ruled ledger, not tiles. It is one cover-white strip under a 2 px ink top rule with cells divided by hairlines. Each cell holds a tracked-caps caption over a 30 px figure. A cell that needs attention takes the lamp wash and a trailing 9 px lamp dot.

### Tables
These are the working panel of the cover. A 2 px ink top rule and a 1 px rule bottom frame the table, which has no side borders and no radius. The header row is 52 px with tracked caps and an ink underline. Agent columns are headed by 26 px logo plates whose bottom stripe is the series colour. Rows are at least 64 px with hairline dividers and turn stock on hover. Each row has a logo plate, a 700-weight name with a status dot and transport tag, a pencil-grey mono command line, five printed-mark switches, and row actions.

### Inputs / Fields
- **Style:** Cover white with a rule border, 3 px corners and 36 px height. Placeholder text is pencil grey and the caret is ink.
- **Focus:** The border turns ink and a 1 px ink ring is added, so the field is double-struck. Search shows the same ink border through `:focus-within`.
- **Inside a band:** The field is band-raised with a muted-ink border, cover-white text and stone placeholders.

### Navigation
- **Sidebar:** The index tabs of the series. Paper is index tab. The brand sits over a 3 px ink underline. Items are 34 px tall with 2 px corners and 13.5 px graphite text, and each has a pencil icon and a mono count at the right. On hover an item gets a hairline fill. The active item is an ink slab with cover-white text at 600 weight. The Terminales running badge is a lamp block with mono figures. Group titles are 10.5 px tracked caps. The "Abrir rápido" block holds black logo plates on cover-white tiles, each with its series foot stripe.
- **Mobile:** A black top bar with the section name in tracked caps and an outline menu button. The sidebar opens as a drawer with the sheet shadow.
- **Palette (Ctrl+K):** A square cover-white sheet with a 6 px ink head. The selected row becomes an ink slab.

### Sheets (Modals)
Square cover-white sheets with a 6 px ink head rule, the sheet shadow and a scrim without blur. The title is 17 px at 700 weight with its explanatory line beneath. The footer is separated by a hairline. On phones the sheet rises from the bottom with the same 6 px head.

### Toasts
Printed strips: an ink fill, 3 px corners, the float shadow and cover-white text. Error toasts are corrector red.

### Board (Tablero)
There are four columns on index-tab paper, each with a 6 px top rule that encodes its stage: stone for "IDEAS", lamp for "EN CURSO", corrector for "REVISAR" and ink for "HECHO". Column heads are 11.5 px tracked caps. Cards are 4 px cover-white panels. A working card takes the lamp wash and line.

### Terminals and Control Room
Terminals are dark printouts on the page. The ground is ink and the type is terminal text. Padding is 16 px top, 14 px right, 12 px bottom and 20 px left, so the print has a margin. The active terminal tab is an ink tab with 2 px top corners, and inactive tabs sit on index tab. Control-room tiles are ink with an ink title bar. Their side rail is index tab with ink section rules.

### Design Studio: Covers and Spines (signature)
- **Composer:** A square cover-white box with a 6 px ink head and the float shadow. Its focus adds a 1 px ink ring. It sits under the tracked "¿QUÉ CREAMOS?" prompt. Template tiles become selected with an ink border.
- **Project covers:** Square, with a 1 px hairline ring and an 8 px series-colour stripe across the top (from `data-agent`). The thumbnail is separated from the meta by a 1 px ink rule. On hover the ring turns ink and the float shadow is added, with no lift.
- **Open project:** The top bar is the ink band, holding band-style buttons, the project name and the agent and model picker. The canvas is a hairline-grey field with the shadowed stage.
- **Folded spine:** Folding the chat leaves a 44 px spine. It has an 8 px series-colour head and the project name plus "chat" set vertically in 11.5 px tracked caps, read bottom to top. Clicking the spine reopens the chat.

### Chat
The chat list head and the conversation head form one continuous 76 px ink band across the full width. The selected conversation is an ink slab. The user's bubbles are ink with cover-white text, and agent bubbles are cover white with hairline edges and 4 px corners. The judge in a debate is labelled in tracked caps with an ink-edged bubble.

## Do's and Don'ts

### Do:
- **Do** open every scrolling view with the black title band (section name at 21 px, 700, 0.12em, uppercase) and close it with the 6 px ink foot band.
- **Do** route agent colour through `--series` by tagging the element with `data-k`, `data-client` or `data-agent`. Never hard-code a series hex in a component.
- **Do** keep every grey on the `--n0` to `--n10` ramp.
- **Do** mark state as print: hairline box at rest, filled when on, struck through when disabled, ink bracket (2 px outline, 2 px offset) on focus.
- **Do** rank status by dot size before colour (6 / 8 / 10 px).
- **Do** pair every state with its evidence in the same row, such as a diff, an output, a command or a count.
- **Do** invert buttons inside bands: the primary becomes a cover-white slab, and secondaries become muted-ink outlines.
- **Do** use tabular figures for every number, and Geist Mono for commands, paths and keys.
- **Do** give anything with a band or a top rule of 2 px or more square corners. Use 3 px for controls and 2 px for marks.
- **Do** keep terminals dark (ink ground, terminal-text type) on the light page.

### Don't:
- **Don't** use green for health, success or "installed". Green is Codex's series colour, and healthy is ink.
- **Don't** use lamp ochre for anything that is not running right now. Neutral advisories are dashed and stay in ink and stone.
- **Don't** use corrector red decoratively or as an accent. It means "this needs you".
- **Don't** put shadows on on-page elements such as bands, tables, ledgers, cards or board columns. Shadows are only for toasts, popovers, sheets, the palette and the Design stage.
- **Don't** reintroduce the large radii the world layer replaced (10 to 16 px cards, 20 px pill capsules, rounded slide toggles).
- **Don't** set tracked uppercase on body text, buttons or names. It belongs to bands, section rules, captions and column heads.
- **Don't** put the small explanatory line of a sheet title above the title. It goes beneath.
- **Don't** drop columns or ledger cells to make a phone layout fit. Reflow them, and let tables scroll inside their own panel.
- **Don't** blur the scrim behind sheets.
