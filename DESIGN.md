---
name: BriefForge
description: The packaging brief as a multi-part carbonless routing form, checked, stamped and source-linked.
colors:
  ink: "#15182B"
  ink-2: "#2E3247"
  ink-muted: "#555A6E"
  ink-faint: "#6B7083"
  ink-soft: "#8C91A3"
  paper: "#FFFFFF"
  desk: "#ECEEF2"
  desk-2: "#E2E5EB"
  desk-3: "#D6DAE2"
  line: "#DADDE4"
  line-strong: "#B4B9C6"
  canary-soft: "#FFF5C2"
  canary: "#FFE066"
  canary-deep: "#735600"
  mint-soft: "#DDF3E4"
  mint: "#8FDBA9"
  mint-deep: "#17663A"
  sky-soft: "#E0ECFF"
  sky: "#A6C8FF"
  sky-deep: "#1D4FA0"
  gold-soft: "#FFEDCC"
  gold: "#FFC85C"
  gold-deep: "#7A4E00"
  pink-soft: "#FFE3EA"
  pink: "#FFB3C7"
  pink-deep: "#9E2049"
  stop-soft: "#FFE4E7"
  stop: "#D3283C"
  stop-deep: "#A01A2B"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "clamp(52px, 8.6vw, 128px)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.025em"
    fontVariation: "'opsz' 96, 'wdth' 82"
  headline:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "56px"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.025em"
    fontVariation: "'opsz' 96, 'wdth' 82"
  title:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.15
    letterSpacing: "-0.012em"
    fontVariation: "'opsz' 32, 'wdth' 88"
  figure:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "34px"
    fontWeight: 700
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontFeature: "'tnum', 'lnum'"
    fontVariation: "'opsz' 96, 'wdth' 75"
  body:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'ss01'"
  interface:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.4
  label:
    fontFamily: "Hanken Grotesk, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    fontFeature: "'tnum'"
  stamp:
    fontFamily: "Bricolage Grotesque, Hanken Grotesk, system-ui, sans-serif"
    fontSize: "11.5px"
    fontWeight: 800
    lineHeight: 1
    letterSpacing: "0.06em"
    fontVariation: "'opsz' 14, 'wdth' 75"
rounded:
  sm: "4px"
  DEFAULT: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
spacing:
  page-x-sm: "16px"
  page-x-md: "24px"
  page-x-xl: "32px"
  sheet-pad: "20px"
  page-max: "1560px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    typography: "{typography.interface}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.ink-2}"
  button-outline:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-soft:
    backgroundColor: "{colors.desk}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 14px"
    height: "36px"
  button-soft-hover:
    backgroundColor: "{colors.desk-2}"
  button-canary:
    backgroundColor: "{colors.canary}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 20px"
    height: "44px"
  sheet:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.lg}"
    padding: "{spacing.sheet-pad}"
  form-box:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.md}"
  input:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "40px"
  stamp-confirmed:
    backgroundColor: "{colors.mint-soft}"
    textColor: "{colors.mint-deep}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
    padding: "4px 7px 3.5px"
  stamp-review:
    backgroundColor: "{colors.canary-soft}"
    textColor: "{colors.canary-deep}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
  stamp-blocking:
    backgroundColor: "{colors.stop-soft}"
    textColor: "{colors.stop-deep}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
  stamp-warning:
    backgroundColor: "{colors.gold-soft}"
    textColor: "{colors.gold-deep}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
  stamp-handoff:
    backgroundColor: "{colors.sky-soft}"
    textColor: "{colors.sky-deep}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
  stamp-remove:
    backgroundColor: "{colors.desk-2}"
    textColor: "{colors.ink-2}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
  stamp-muted:
    backgroundColor: "{colors.desk}"
    textColor: "{colors.ink-muted}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
  stamp-missing:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    typography: "{typography.stamp}"
    rounded: "{rounded.sm}"
  market-chip:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "24px"
  owner-tag:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    padding: "0 6px"
    height: "24px"
  segmented:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.md}"
    padding: "3px"
  segmented-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper}"
---

# Design System: BriefForge

## Overview

**Creative North Star: "The Carbon Set"**

BriefForge treats the packaging brief as a multi-part carbonless routing form laid on a cool desk. One carbon ink carries all structure, text and primary action. White bond sheets hold every working area. Tinted copies peek out beneath a sheet as offset stacked paper edges, and the tint of each copy says what that copy carries. Every decided state is a stamped word, every open value is an outlined gap, and every value keeps a proof stub that tears off along a perforation.

The world lends type, palette, density and its signature devices to standard web structure; navigation, controls and layout remain conventional so the brand manager can operate at speed. Density is that of a working form: 13px interface text, 12px tabular meta, condensed display figures for anything read at a glance. Ornament is limited to what a real carbon set carries: perforations, proof stubs, stamps and copy edges.

The system refuses the green-rail internal tool and the indigo-button SaaS card kit. Colour is never decoration: each lit tint is a real state or a real copy.

**Key Characteristics:**
- One carbon ink (#15182B) for text, rules and primary actions on a cool desk ground (#ECEEF2).
- White bond sheets with 12px corners and ink-tinted soft shadows.
- Copies drawn as offset stacked edges beneath a sheet, tinted by what they carry.
- Stamps as the only state grammar: a bordered, condensed, uppercase word with ink grain.
- Perforated tear lines and dashed proof stubs as the only ornaments.
- Bricolage Grotesque condensed for display, figures and stamps; Hanken Grotesk for interface text.
- Motion that marks events (a stamp lands, a value is re-written, readiness rolls), never decoration on first paint.

## Colors

One ink, one desk, white paper, and a set of copy tints that each carry exactly one meaning.

### Primary
- **Carbon Ink** (ink): text, hairline rules, primary buttons, the selected segment, the active nav item, market chips, focus outlines. Its secondary tones step down for hierarchy: **Ink Two** (ink-2) for secondary text and slate stamps, **Ink Muted** (ink-muted) for captions and meta, **Ink Faint** (ink-faint) for placeholders and supporting icons, **Ink Soft** (ink-soft) for input hover borders.

### Secondary (state tints)
Each family has a soft fill, a mid value and a deep text value. Stamps use soft fill with deep text and border.
- **Canary** (canary family): needs review, unknown, a decision to make. The mid value fills the Finalize button, the to-review share of the readiness bar, text selection and the skip link. Count figures in the selected segment are canary on ink.
- **Mint** (mint family): confirmed, and the Add action. Mint deep fills the confirmed share of the readiness bar.
- **Stop Red** (stop family): blocking findings, and conditions that stop the work (failed operations, rejected files, delete affordances on hover). It never marks a warning, a preference or decoration.
- **Gold** (gold family): warning severity and non-blocking checks.
- **Sky** (sky family): passed to the agency, handoff, the open brief. The agency tear-off copy on the designer brief is a sky sheet.
- **Slate** (desk-2 fill with ink-2 text): the Remove action.
- **Muted** (desk fill with ink-muted text): Keep and Info.

### Tertiary (copy material)
- **Pink** (pink family): a copy-sheet material only, used for the findings copy on the landing desk and the brief sheet's first copy edge there, and for the PDF file tile. It carries no state and is not a stamp tone.

### Neutral
- **Bond Paper** (paper): every sheet, form box, input and popover.
- **Desk** (desk): the page ground, perforation punch holes, soft buttons, muted stamps.
- **Desk Two** (desk-2): recessed bands (the landing example band), readiness bar track, skeleton base, slate stamps.
- **Desk Three** (desk-3): deepest desk tone for pressed or nested recesses.
- **Rule** (line): sheet borders, section hairlines, segmented frame.
- **Strong Rule** (line-strong): input and outline-button borders, the proof stub's dashed line, owner tags, scrollbar thumb.

### Named Rules
**The One Ink Rule.** Structure and primary action use Carbon Ink only. No second brand colour exists; emphasis comes from weight, size and the ink fill.

**The Every Tint Is a State Rule.** A tint appears only when it means its state or its copy. If removing the tint loses no information, the tint does not belong.

**The Stop Means Stop Rule.** Stop red marks only what halts the work: blocking findings, failures and destructive actions. A warning is gold, a question is canary.

**The Neutral AI Rule.** AI suggestions are set in neutral ink with a sparkle icon and a plain-language qualifier. They never take a state tint and never block.

## Typography

**Display Font:** Bricolage Grotesque, variable opsz and wdth axes (with Hanken Grotesk, system-ui)
**Body Font:** Hanken Grotesk (with system-ui), stylistic set ss01 enabled globally
**Label Font:** Hanken Grotesk at 12px with tabular figures; stamps use Bricolage at the narrowest width

**Character:** Bricolage set condensed is the lettering of a printed form header: compact, heavy and confident. Hanken Grotesk is a quiet, legible interface face that holds dense rows without noise.

### Hierarchy
- **Display** (700, clamp(52px, 8.6vw, 128px), 0.98, opsz 96, wdth 82, -0.025em): the landing headline only, revealed line by line.
- **Headline** (700, 40px to 76px stepped at md, same settings as Display): landing section heads and large app page heads.
- **Title** (700, 17px to 24px, typically 18px, 1.15, opsz 32, wdth 88, -0.012em): sheet titles, section heads on a hairline, the wordmark.
- **Figure** (700, 15px to 68px, 0.9, opsz 96, wdth 75, tabular lining figures): every count, score and number read at a glance, including the rolling readiness figure.
- **Body** (400, 14px, 1.5): running text; the landing lead is 17px relaxed at a 44ch measure.
- **Interface** (600, 13px to 13.5px): buttons, nav, segments, list rows.
- **Label** (500, 12px, 16px line, tabular, ink-muted): meta captions placed beside or after a title, never above it.
- **Stamp** (800, 11.5px, uppercase, 0.06em, opsz 14, wdth 75; large stamps 14px): state words only.

### Named Rules
**The No Eyebrow Rule.** No small label sits above a heading. Captions and counts sit on the heading's baseline to the right, or below it.

**The Figures Are Matter Rule.** Any number a user reads at a glance is set in the condensed figure style with tabular digits, so counts align and roll in place.

## Layout

Pages are centred in a 1560px container with horizontal padding of 16px, 24px from md and 32px from xl. The app shell stacks a 60px sticky white top bar, the brief bar (product, market chips, status stamp, four-stage stepper, readiness) and the page. The brief bar publishes the CSS variable --stick-top (top bar height plus its own height plus 16px; default 76px); every sticky work area (artwork viewer, findings sheet, readiness column) starts at that offset and sizes its height from it. Working screens use a 12-column grid: artwork left at about 40 percent, field sheets centre, readiness and findings right, collapsing to a single column below lg. Sheets use 20px internal padding; section heads sit on a hairline with an 8px gap beneath. Scroll padding at the top is 140px so anchored targets clear the sticky bars.

## Elevation & Depth

Depth is paper on a desk: soft, ink-tinted shadows that read as sheets resting, never glows. Copies beneath a sheet are drawn as hard, offset paper edges in the copy tint with a fine ink edge, followed by one soft cast shadow; this is the world's own material, not a decorative hard shadow.

### Shadow Vocabulary
- **Sheet** (`box-shadow: 0 1px 0 rgba(21,24,43,0.03), 0 1px 3px rgba(21,24,43,0.06), 0 12px 28px -18px rgba(21,24,43,0.22)`): the resting bond sheet.
- **Raised** (`box-shadow: 0 1px 2px rgba(21,24,43,0.06), 0 18px 40px -20px rgba(21,24,43,0.32)`): landing copies, hover lift target.
- **Lift** (`box-shadow: 0 2px 6px rgba(21,24,43,0.08), 0 28px 56px -24px rgba(21,24,43,0.42)`): the chat drawer and dialogs.
- **Sheet Set** (two copy edges at 5px and 10px offset, each a copy-tint edge plus a 0.12 or 0.10 ink hairline, then `10px 22px 30px -18px rgba(21,24,43,0.28)`): readiness, pack inspector, designer brief, empty states. Copy tints are set per use through --copy-1 and --copy-2.
- **Selected** (`box-shadow: inset 0 0 0 1.5px #15182B`): a selected sheet or option.

### Named Rules
**The Copies Carry Meaning Rule.** A sheet set shows copies only where the copies say something (ready is mint over sky; not ready is canary over stop soft; agency handoff is sky). The tints follow the state, never taste.

## Shapes

Corners are gently rounded and scale with the object: stamps, chips and tags 4px, segments 5px, buttons, inputs and form boxes 8px, sheets 12px, large bands 16px. Borders are 1px hairlines in Rule; stamps carry a 1.5px border in their own colour (2px on large stamps). Two dashed lines carry meaning: the **perforation** (1.5px dashed with half punch holes in desk colour at each end) separates a value from its proof, and the **proof stub** (1px dashed strong rule at the foot of a sheet, 12px muted text) carries sources. A dashed outline elsewhere means a missing value.

## Components

### Buttons
Ink, decisive and compact.
- **Shape:** gently rounded (8px); xl size uses 12px.
- **Primary:** Carbon Ink fill, white 13.5px semibold text, 36px high, 14px horizontal padding, a faint inner top highlight.
- **Hover / Focus:** hover steps to Ink Two; focus is a 2px ink outline offset 2px (canary on ink surfaces); press scales to 0.97 over 140ms to 150ms, removed under reduced motion.
- **Outline:** paper fill, strong rule border, border turns ink on hover.
- **Soft:** desk fill, desk-2 on hover. **Ghost:** ink-2 text, 6 percent ink wash on hover.
- **Canary:** reserved for the single finishing action on a brief (Finalize on the readiness sheet); canary fill with ink text and a faint canary-deep inner base line.
- **Destructive:** stop fill, used only for deletion.

### Stamps (signature)
The state grammar. A stamp is a bordered, condensed, uppercase word with a fractal ink-grain mask, so it reads as a rubber impression on bond paper. State is always the word plus its tint, never colour alone.
- **Tones:** Confirmed (mint, with a check), Review and Unknown (canary), Blocking (stop), Warning (gold), Passed to agency and Open now (sky), Remove (slate), Keep and Info (muted), Change (ink on paper), Missing (gap: paper fill with a dashed ink-2 border).
- **Landing:** when its value changes after first render, the stamp comes down at 1.6x scale, overshoots to 0.94 and settles over 360ms. It never animates on first paint. Large stamps may carry a slight tilt.

### Chips
- **Market chip:** a small ink plate, 24px high, white condensed uppercase code; adapted briefs read "EU → US".
- **Owner tag:** paper with a strong rule border and a route icon, naming who the item is routed to.
- **Category chip:** desk fill, ink-2 semibold text.

### Cards / Containers
- **Corner Style:** 12px.
- **Background:** Bond Paper on the desk.
- **Shadow Strategy:** Sheet at rest; Sheet Set where copies carry meaning; see Elevation & Depth.
- **Border:** 1px Rule.
- **Internal Padding:** 20px; proof stubs run full width at the foot with 20px by 10px padding.

### Inputs / Fields
- **Style:** paper fill, 1px strong rule border, 8px corners, 36px to 44px high, ink caret, ink-faint placeholder.
- **Focus:** border turns Carbon Ink; global focus outline applies.
- **Form box:** a ruled box (8px, Rule border) where the label sits inside the rule and the value is what was written.

### Navigation
- **Top bar:** white at 80 to 90 percent with a backdrop blur, Rule hairline beneath, 60px high; wordmark, then Projects and New brief as 36px items. Active is an ink fill with white text; idle is ink-2 with an ink wash on hover.
- **Brief bar stepper:** four stages; a single ink rule slides under the active stage by translateX and scaleX over 220ms. Stage counts sit in small tinted tiles (stop for Findings, canary for Questions).
- **Segmented control:** paper frame with a 3px inset; one ink indicator moves by translate and scaleX only over 220ms and is placed without motion on first paint.

### Readiness
The readiness figure is a RollingNumber: each digit rolls to its new value over 520ms; first paint shows the value in place. The readiness bar is a 6px to 8px desk-2 track with mint-deep confirmed and canary to-review segments that move by scaleX and translateX only, so a change never re-lays out the page.

### Motion grammar
- Route enter: 260ms rise of 8px with a 3px blur clearing.
- Value re-write: clip-path wipe left to right over 460ms, like carbon transferring.
- Disclosures: grid rows from 0fr to 1fr over 260ms.
- Dialogs: rise 12px from 0.97 scale over 260ms on a blurred ink backdrop.
- Chat drawer: slides in over 380ms on the drawer curve (cubic-bezier(0.32, 0.72, 0, 1)).
- Hover lift: 2px rise to the Raised shadow, only under hover-capable fine pointers.
- Landing focal sequence: headline lines wipe up (820ms, staggered), sheets are laid on the desk (760ms), the proof leader draws (700ms), stamps land.
- Reduced motion keeps fades and colour changes and removes travel, scale, wipes, draws and loops.

## Do's and Don'ts

### Do:
- **Do** set every state as a stamp word with its tint and border; pair Missing with the dashed gap outline.
- **Do** use Carbon Ink (#15182B) for primary actions, active navigation and the selected segment.
- **Do** place sheets on the desk with the Sheet shadow and 12px corners; use a Sheet Set only when the copy tints mean something.
- **Do** separate a value from its sources with a perforation, and carry sources in a dashed proof stub.
- **Do** start sticky work areas at var(--stick-top) and size them from it.
- **Do** animate stamps, re-writes and readiness only when a value changes, never on first paint.
- **Do** move indicators and bars by transform only (translate, scaleX).

### Don't:
- **Don't** convey a state by colour alone or by a coloured dot without its word.
- **Don't** use stop red for warnings, questions or emphasis.
- **Don't** use pink as a state or stamp tone; it is copy material.
- **Don't** give AI suggestions a state tint; keep them neutral ink with the sparkle icon.
- **Don't** place eyebrow labels or kickers above headings.
- **Don't** introduce a second brand accent or an indigo primary.
- **Don't** add ornament beyond perforations, proof stubs, stamps and copy edges.
