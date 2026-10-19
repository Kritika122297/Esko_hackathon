---
name: BriefForge
description: Shelf Edge. Every brief value is a shelf-edge ticket with its proof printed on the code line and its state on a notched talker flag.
colors:
  rail: "#0F3D2E"
  rail-hover: "#174D3B"
  ground: "#F1F2EC"
  stock: "#FFFFFF"
  ink: "#121514"
  ink-2: "#2C322F"
  ink-muted: "#5A615C"
  ink-faint: "#757C77"
  line: "#D6D9CF"
  line-strong: "#AEB4A9"
  talker: "#FFD23F"
  talker-soft: "#FFF4CC"
  talker-deep: "#8A6A00"
  stop: "#D92B2B"
  stop-soft: "#FBE8E6"
  stop-deep: "#A11D1D"
  ok-soft: "#E3EDE8"
typography:
  figure:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 800
    lineHeight: 0.88
    letterSpacing: "-0.01em"
    fontFeature: "tnum"
    fontVariation: "'wdth' 62.5"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "28px"
    fontWeight: 800
    lineHeight: 1.25
    letterSpacing: "-0.01em"
    fontVariation: "'wdth' 87.5"
  ticket-value:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "19px"
    fontWeight: 600
    lineHeight: 1.375
    fontVariation: "'wdth' 87.5"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: "16px"
    letterSpacing: "0.06em"
  meta:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    letterSpacing: "0.06em"
    fontFeature: "tnum"
  flag:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.08em"
    fontVariation: "'wdth' 87.5"
  code:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "16px"
    letterSpacing: "0.05em"
rounded:
  sm: "2px"
  DEFAULT: "2px"
  md: "3px"
  lg: "4px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
  2xl: "24px"
  3xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.stock}"
    rounded: "{rounded.DEFAULT}"
    padding: "0 16px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.rail-hover}"
  button-outline:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.DEFAULT}"
    padding: "0 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.ground}"
  button-talker:
    backgroundColor: "{colors.talker}"
    textColor: "{colors.ink}"
    rounded: "{rounded.DEFAULT}"
    padding: "0 16px"
    height: "36px"
  button-destructive:
    backgroundColor: "{colors.stop}"
    textColor: "{colors.stock}"
    rounded: "{rounded.DEFAULT}"
    padding: "0 16px"
    height: "36px"
  button-destructive-hover:
    backgroundColor: "{colors.stop-deep}"
  ticket:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.DEFAULT}"
  flag-review:
    backgroundColor: "{colors.talker}"
    textColor: "{colors.ink}"
    typography: "{typography.flag}"
    padding: "4px 10px 4px 14px"
  flag-stop:
    backgroundColor: "{colors.stop}"
    textColor: "{colors.stock}"
    typography: "{typography.flag}"
    padding: "4px 10px 4px 14px"
  flag-ok:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.stock}"
    typography: "{typography.flag}"
    padding: "4px 10px 4px 14px"
  flag-missing:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    typography: "{typography.flag}"
    padding: "4px 10px 4px 14px"
  code-line:
    textColor: "{colors.ink-muted}"
    typography: "{typography.code}"
    padding: "6px 16px"
  input:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.DEFAULT}"
    padding: "0 8px"
    height: "36px"
  nav-rail:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.stock}"
    width: "240px"
  nav-item-active:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.DEFAULT}"
    height: "44px"
  readiness-panel:
    backgroundColor: "{colors.rail}"
    textColor: "{colors.stock}"
    rounded: "{rounded.DEFAULT}"
    padding: "16px"
---

# Design System: BriefForge

## Overview

**Creative North Star: "Shelf Edge"**

Every value in the brief is a shelf-edge ticket. The value prints large, in condensed heavy tabular figures when it is a number; its proof prints small along the ticket's dashed code line; its state hangs off the ticket's right edge as a notched talker flag. The shell around the tickets is the shelf strip itself: a deep green rail that owns navigation, the readiness panel and the primary action, set against a pale store-light ground.

The system is dense, flat and printed. Surfaces are white ticket stock with hairline edges and 2px corners, separated by a faint paper shadow rather than by elevation. Colour is reserved for meaning: green is the shell and "OK", yellow asks for a decision, red blocks. Everything else is ink on stock. The system rejects the category default of soft white cards, indigo buttons and pastel status pills.

Motion behaves like a label printer. When a decision lands, the ticket re-prints in place: the value wipes in from the left and the flag slides back onto the edge. Nothing else animates beyond short rises and height-based disclosures, and all of it collapses under reduced motion.

**Key Characteristics:**
- Green rail shell, store-light ground, white ticket stock with 1px edges and 2px corners.
- Condensed heavy tabular figures for every count, score and numeric value.
- States as notched talker flags carrying a word, never colour alone.
- Proof printed on a dashed mono code line at the foot of each ticket.
- Re-print animation as the signature interaction when a value or state changes.

## Colors

A shelf-strip palette: one deep green that owns the shell, white stock and ink for content, and two signal colours (talker yellow, stop red) that only ever mean "decide" and "blocked".

### Primary
- **Shelf-Strip Green** (rail): The navigation rail, the readiness panel, primary buttons, the OK flag, finalized chips, section rules and the selected-source text colour. Used at region scale, never as a tint wash. Hover deepens to **Rail Hover** (rail-hover).

### Secondary
- **Talker Yellow** (talker): Review flags, open-count badges on the rail, the readiness progress fill, the busy-toast scan bar, text selection, the skip link and the artwork highlight wash. On the green rail it is also the focus ring and the finalize button. **Talker Soft** (talker-soft) backs alternative-value rows; **Talker Deep** (talker-deep) is their dashed edge and the uncertain-source flag icon.

### Tertiary
- **Stop Red** (stop): Blocking flags, destructive buttons and the "Problem" flag. **Stop Soft** (stop-soft) backs the error banner; **Stop Deep** (stop-deep) is the destructive hover.

### Neutral
- **Store-Light Ground** (ground): Page background, inset rows (open questions, agency notes, table heads), outline-button hover.
- **Ticket Stock** (stock): Every ticket, input, chip and the active navigation item.
- **Ink** (ink): Body text, headings, the selected-ticket frame, the busy toast, the artwork highlight frame and the default focus ring.
- **Ink 2 / Ink Muted / Ink Faint** (ink-2, ink-muted, ink-faint): Secondary copy, captions and code lines, and placeholders and disabled hints, in that order.
- **Hairline / Strong Line** (line, line-strong): Ticket edges and dashed code-line rules; input borders, scrollbars and hover edges.
- **OK Soft** (ok-soft): Rare green-tinted backing for confirmed context.

### Named Rules
**The No Evidence Blue Rule.** The palette is rail green, ground, white ticket stock, ink, talker yellow and stop red. No blue or indigo appears anywhere, including links, sources and evidence; located sources use ink-muted with a dotted underline that turns rail green on hover.

**The Signal Scarcity Rule.** Yellow means a person must decide and red means something blocks. Neither appears as decoration, and neither appears without a word beside it.

## Typography

**Display Font:** Archivo across its width axis (with system-ui, sans-serif)
**Body Font:** Archivo at normal width (with system-ui, sans-serif)
**Label/Mono Font:** JetBrains Mono, for source code lines only (with ui-monospace, monospace)

**Character:** One family carries the whole system by changing width: condensed heavy for shelf-price figures, semi-condensed for headings, values and flags, normal width for interface text. The mono face is the printed code under the price and appears nowhere else.

### Hierarchy
- **Figure** (800, 26 / 40 / 56 / 76px, 0.88, width 62.5%, tabular): Counts in the context bar (26px), numeric ticket values (40px, 56px for nutrition and quantity), and the readiness score (76px). Units drop to width 75% at roughly 40% of the figure size.
- **Headline** (800, 28px, width 87.5%, -0.01em): One page title per screen, with an optional 15px ink-muted lead capped at 70ch.
- **Ticket Value** (600, 19px, width 87.5%): Text values on tickets. Values over 140 characters drop to 16px medium.
- **Title** (700, 16px): Section headings sitting on a section rule.
- **Body** (400, 14px, 1.45): Interface text. Secondary copy at 13px and 12px.
- **Label** (700, 12px, 0.06em, uppercase): Panel and ticket labels such as "Brief fields", "Artwork" and field names.
- **Meta** (600, 11px, 0.06em, uppercase, tabular): All other small uppercase metadata: rail footer context, readiness breakdown, designer-task and agency chips, artwork footer.
- **Flag** (800, 11px, 0.08em, uppercase, width 87.5%): Talker flag words.
- **Code** (JetBrains Mono 400, 11px, 0.05em, uppercase): Source lines on tickets and evidence lists.

### Named Rules
**The Mono Is Proof Rule.** JetBrains Mono appears only on source code lines (ticket code lines, source chips, the artwork highlight source). Every other small uppercase text uses the Archivo meta style.

**The Price Figure Rule.** Any number a person reads at a glance (counts, scores, numeric values) sets as a condensed heavy tabular figure, never as body text.

**The No Kicker Rule.** No eyebrow or kicker label sits above a heading. Headings stand on their own; context belongs in the lead line beneath or in the section rule's right-hand caption.

## Layout

A fixed 240px green rail on the left from 1024px up; below that it collapses into a 56px sticky green bar whose step list opens as a height disclosure. A sticky context bar on ground (95% opacity) carries the product name, market and status chips, field-count figures and the blocking flag on every screen after upload.

Content sits in a centred main column capped at 1600px, padded 16px on mobile and 24px from 768px, with 24px to 32px vertical padding. Each screen has one dominant work area. The workbench is a three-column grid from 1280px (artwork, brief tickets as the widest column, readiness and findings), two columns from 1024px with the artwork behind a tab, and one column below. Findings and upload use a two-column split from 1024px.

Rhythm runs on a 4px base: 8px between tickets, 20px to 24px between grid columns, 24px between sections, 16px ticket side padding and 12px vertical padding.

### Named Rules
**The Section Rule Rule.** Sections open on a 3px rail-green strip under the section title, with an optional right-aligned ink-muted caption ("2 to resolve", counts) on the same baseline.

## Elevation & Depth

The system is flat and printed. Depth comes from hairline edges and tone (stock on ground), with one faint paper shadow under ticket stock and one lifted shadow reserved for floating toasts. The only structural depth effect is the artwork highlight's white halo.

### Shadow Vocabulary
- **Ticket** (`box-shadow: 0 1px 0 rgba(18,21,20,0.04), 0 2px 6px -2px rgba(18,21,20,0.08)`): Under every ticket and the readiness panel. Barely visible; it reads as paper thickness.
- **Lift** (`box-shadow: 0 2px 4px rgba(18,21,20,0.06), 0 12px 28px -12px rgba(18,21,20,0.22)`): The bottom-right busy and confirmation toasts only.
- **Selected Frame** (`box-shadow: inset 0 0 0 1px #121514` with an ink border): A selected ticket or chosen answer option. Selection doubles the edge in ink rather than raising the surface.
- **Artwork Highlight** (`box-shadow: 0 0 0 3px #FFFFFF, 0 6px 18px rgba(18,21,20,0.35)`): The located-source frame on the artwork.

### Named Rules
**The Paper Not Glass Rule.** Surfaces never float, blur or glow. State changes the edge (ink frame) or re-prints the ticket; it never raises it.

## Shapes

Nearly square: 2px radius on tickets, buttons, inputs, chips and navigation items, 3px to 4px only where the scale allows. Edges are 1px hairlines; code lines and artwork panel outlines are dashed. The one distinctive silhouette is the talker flag: a rectangle with a 7px V-notch cut into its leading edge by clip-path, hanging off the right edge of tickets and findings.

## Components

### Buttons
Short, square and decisive.
- **Shape:** Near-square corners (2px), 36px tall at default, 28px small, 44px large; 13px semibold label with an optional 14px to 16px icon.
- **Primary:** Rail green on white text with a 1px inner bottom shade (`inset 0 -1px 0 rgba(0,0,0,0.25)`). Used for Confirm, Save, Apply answer and Start a brief.
- **Hover / Focus / Active:** Hover deepens to rail hover; active presses down 1px; focus is a 2px ink outline offset 2px (talker yellow on the rail). Transitions run 150ms ease-out. Disabled drops to 55% opacity.
- **Outline:** Stock with a strong-line border; hover turns the border ink and the fill ground.
- **Talker:** Talker yellow with ink text, for Finalize and Open designer brief on the green readiness panel.
- **On Rail:** White at 10% with a 30% white border, for secondary actions on green.
- **Destructive / Ghost / Link:** Stop red deepening on hover; transparent with a 5% ink hover; rail-green underlined text thickening on hover.

### Talker Flags
- **Style:** Notched rectangle, flag type, always a word: OK (rail green, white), Review (talker, ink), Missing (stock with a 1px ink inset), Blocking (stop, white), Warning (talker), Info (ground with a strong-line inset), Fix and Suggested (rail green).
- **Placement:** Status flags hang from a ticket's top-right edge; severity and action flags use the right-pointing variant. Designer actions (Change, Add, Remove, Unknown, Keep) use the same tones.
- **Motion:** On re-print the flag slides in from 10px right over 360ms.

### Tickets
- **Corner Style:** 2px.
- **Background:** Ticket stock on the ground.
- **Shadow Strategy:** Ticket shadow (see Elevation & Depth).
- **Border:** 1px hairline; strong line on hover when the ticket can locate a source; ink frame when selected.
- **Internal Padding:** 16px sides, 12px top, label row then value then actions, closed by the code line.
- **Re-print:** When a value or state changes, the value wipes in from the left (`clip-path` inset, 420ms) and the flag slides back in. First render never animates.

### Code Line
A dashed hairline rule across the foot of a ticket, 6px by 16px padding, holding source chips in JetBrains Mono 11px uppercase, separated by strong-line middle dots. Located sources carry a crosshair icon and a dotted underline that turns solid and rail green on hover; clicking highlights the spot on the artwork.

### Inputs / Fields
- **Style:** Stock fill, strong-line 1px border, 2px corners, 32px to 40px tall, 12px to 13px text, rail-green caret, ink-faint placeholder.
- **Focus:** Border turns ink plus the global 2px ink focus outline.
- **Choice rows:** Radio options sit in bordered rows; the chosen row gets an ink frame on ground. Native radios take the rail-green accent.

### Navigation
- **Style:** Green rail with a condensed 22px extra-bold wordmark, then five numbered steps, each 44px tall with a 24px numbered square, label and one-line hint.
- **States:** Active is a stock item with ink text and an ink-bordered number; idle is white at 85% with a 10% white hover; disabled is white at 40%. Open counts sit as talker-yellow figure badges.
- **Mobile:** A 56px sticky green bar with the wordmark and a menu button; the same list opens as a grid-row disclosure.

### Readiness Panel
The shelf price of the whole brief: a rail-green panel with the state headline, a 76px white figure score with a 30px percent sign, a 6px progress strip (talker for confirmed, 35% white for to-review), the meta breakdown, the owners being waited on, and the finalize gate as a talker or locked on-rail button.

### Artwork Highlight
- **Frame:** A 3px ink border with a 50% talker-yellow wash, a 3px white halo and a soft drop shadow, so the spot reads on any artwork colour.
- **Minimum size:** Targets grow to at least 2.5% of the page width (70% of that in height), centred on the spot; very small targets also zoom the pane to at least 200%.
- **No dimming:** The rest of the artwork and the page stay at full strength. The pane scrolls itself to centre the spot and never scrolls the page.

### Disclosure
Height animates through grid rows from 0fr to 1fr over 240ms on the out curve. Used for finding bodies, ticket notes and history, the question rationale and the mobile step list.

### Toasts
Bottom-right, 288px. Busy is ink with elapsed time in tabular figures and a talker scan bar; confirmation is rail green with a talker check, dismissed after 2.4 seconds.

## Do's and Don'ts

### Do:
- **Do** keep the palette to rail green, ground, white ticket stock, ink, talker yellow and stop red.
- **Do** carry every state as a notched talker flag with a word: OK, Review, Missing, Blocking, Warning, Info.
- **Do** set every glanceable number as a condensed heavy tabular figure (800 weight, width 62.5%).
- **Do** print sources on the ticket's dashed code line in JetBrains Mono 11px uppercase.
- **Do** use the Archivo meta style (11px, 600, uppercase, 0.06em) for all other small uppercase text.
- **Do** open sections on a 3px rail-green section rule.
- **Do** re-print a ticket in place when its value or state changes, and collapse all motion under reduced motion.
- **Do** mark the located spot on the artwork with an ink frame, yellow wash, white halo and minimum size.

### Don't:
- **Don't** use blue or indigo for evidence, links, sources or anything else.
- **Don't** use JetBrains Mono for anything except source code lines.
- **Don't** signal a state with colour alone, a dot, or a pastel pill.
- **Don't** place eyebrow or kicker labels above headings.
- **Don't** dim or veil the page or the artwork when highlighting a source.
- **Don't** raise, blur or glow surfaces to show state; change the edge or re-print instead.
- **Don't** round corners beyond 4px or use soft white cards with large radii.
