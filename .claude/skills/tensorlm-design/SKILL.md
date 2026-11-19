---
name: "tensorlm-design"
description: "Design system and UI/UX rules for TensorLM (AI document-learning app): colours, fonts, gradients, motion, micro-interactions, AI chat and diagram patterns. Use for any TensorLM screen, component or landing page."
---
 
# TensorLM Design Skill
 
This skill is the one place TensorLM's look and feel is defined. Use it every time you build,
restyle, review or polish a TensorLM screen, component, email or marketing page. It merges three
sources (the original *frontend-design* skill, the newer *frontend-design* skill and *tasteskill*)
and settles the places where they disagreed. When this file and a general design habit conflict,
this file wins. When the user's own brief conflicts with this file, the brief wins.
 
---
 
## 0. The product, in one paragraph
 
TensorLM (tensorlm.io) is an AI learning app. People upload documents, research papers, images and
data, then ask questions. TensorLM answers with plain explanations, **diagrams, worked examples and
graphs**, every claim tied back to the source it came from. The audience is students, developers,
researchers and self-learners (many in India, on mid-range laptops and phones, often on patchy
networks). The primary job of the interface is **understanding**: turning a dense paper on
Transformer architecture into something a person gets.
 
Everything below follows from that. TensorLM is a study desk, not a chatbot toy and not a
SaaS dashboard.
 
### The design idea: "Graph paper and ink"
 
The world of learning is notebooks, graph paper, highlighters, margin notes and diagrams drawn
step by step on a whiteboard. TensorLM borrows that vocabulary and keeps it precise and calm:
 
- **Paper** — a cool, slightly green-grey surface (never warm cream).
- **Ink** — a deep blue-slate for text (never a tinted #111 pretending to be black).
- **Cobalt** — the one action colour: buttons, links, focus, the active step.
- **Marker** — highlighter yellow, used only for *source evidence*: the highlighted span in a
  document that backs up an answer. It is the product's signature.
- **The memorable moment** — diagrams that **draw themselves** stroke by stroke as the AI explains.
  This is where all the boldness goes. Everything around it stays quiet.
---
 
## 1. How to work (every task)
 
1. **Name the job.** Write one line: which screen or component, who uses it, what they're trying
   to do, the one main action. If the brief doesn't say, propose it and confirm.
2. **Plan before code.** Write a compact plan:
   - Colour: which tokens from section 2 this screen uses (usually 4–6).
   - Type: which roles from section 3.
   - Layout: one sentence plus an ASCII wireframe. State alignment (TensorLM is left-aligned by
     default; centre only empty states and single-action dialogs).
   - Motion: which single moment moves, and every micro-interaction the screen needs.
   - Copy: every label, button, empty state and error, written first (section 9).
3. **Review the plan against the brief.** Ask: "Would I have produced this for any other AI app?"
   If yes for any part, revise it and say what you changed and why. Check against the anti-slop
   list (section 11).
4. **Build** with the tokens only. No raw hex values, no one-off shadows, no new radii.
5. **Critique.** Screenshot at 1440, 1024, 768 and 390 wide, in light and dark. Read every
   screenshot against the checklist (section 13). Then follow Chanel's rule: remove one accessory.
---
 
## 2. Colour
 
### 2.1 Core palette (light)
 
| Token | Hex | Role |
|---|---|---|
| `paper` | `#F6F7F4` | App background |
| `sheet` | `#FFFFFF` | Raised surfaces: message bubbles for the user, cards, popovers, inputs |
| `ink` | `#14212B` | Primary text, icons |
| `graphite` | `#5B6873` | Secondary text, captions, timestamps (5.3:1 on paper) |
| `rule` | `#DCE1DE` | Borders, dividers, graph-paper lines |
| `cobalt` | `#2449D8` | Primary actions, links, focus, active state (6.4:1 on paper) |
| `cobalt-soft` | `#E7ECFC` | Selected rows, active nav item, hover fill on ghost buttons |
| `marker` | `#FFE066` | Source highlights only (used at 45–60% opacity behind ink) |
 
### 2.2 Core palette (dark)
 
Dark mode is a night study desk, blue-slate rather than pure black.
 
| Token | Hex | Role |
|---|---|---|
| `paper` | `#0F1820` | App background |
| `sheet` | `#17232D` | Raised surfaces |
| `sheet-2` | `#1F2D39` | Popovers, menus (one step above sheet) |
| `ink` | `#E6ECEF` | Primary text |
| `graphite` | `#93A1AC` | Secondary text |
| `rule` | `#2A3946` | Borders |
| `cobalt` | `#7B9BFF` | Actions, links, focus (6.8:1 on paper) |
| `cobalt-soft` | `#1C2A55` | Selected and hover fills |
| `marker` | `#E9C84A` | Source highlights at 22–30% opacity; text stays `ink` |
 
### 2.3 Status colours
 
| Token | Light | Dark | Use |
|---|---|---|---|
| `success` | `#16855B` | `#4CC38A` | Indexed, saved, correct answer |
| `warning` | `#A86A00` | `#F0B44C` | Partial index, low-confidence answer |
| `danger` | `#C42B3A` | `#FF7A85` | Failed upload, destructive actions |
| `info` | = `cobalt` | = `cobalt` | Neutral notices |
 
Status colour always comes with an icon and a word. Never colour alone.
 
### 2.4 Diagram and chart palette
 
Diagrams and graphs are the product, so they get their own ordered palette. Use colours in this
order; never more than five series in one chart.
 
1. `#2449D8` cobalt
2. `#0E9F8E` teal
3. `#D99A1E` amber
4. `#D1497A` rose
5. `#5B6873` graphite
Dark mode lightens each by one step: `#7B9BFF`, `#3CCBB8`, `#F0B44C`, `#F07AA3`, `#93A1AC`.
Diagram node fills use the series colour at 10–14% opacity with a 1.5px stroke at full colour.
Arrows and connectors are `ink` at 70%. Labels inside diagrams are `ink`, never coloured.
 
### 2.5 Colour rules
 
- **One action colour.** Cobalt means "you can press this" or "you are here". Don't use it as
  decoration.
- **Marker means evidence.** If something is yellow, it came from the user's document. Never use
  marker for warnings, badges or promotions.
- **No violet, lavender or purple gradients**, anywhere in TensorLM's own UI. (It is the commonest
  AI-product tell.) Third-party logos keep their own colours.
- **No pure black or pure white text on backgrounds.** Use `ink` and `paper`.
- Contrast floor: body text 4.5:1, large text and UI glyphs 3:1, focus ring 3:1 against both the
  control and the background.
### 2.6 Tokens as code (Tailwind v4 + shadcn names)
 
```css
@import "tailwindcss";
 
:root {
  --paper: #F6F7F4;  --sheet: #FFFFFF;  --sheet-2: #FFFFFF;
  --ink: #14212B;    --graphite: #5B6873; --rule: #DCE1DE;
  --cobalt: #2449D8; --cobalt-soft: #E7ECFC; --marker: #FFE066;
  --success: #16855B; --warning: #A86A00; --danger: #C42B3A;
 
  /* shadcn mapping */
  --background: var(--paper);   --foreground: var(--ink);
  --card: var(--sheet);         --card-foreground: var(--ink);
  --popover: var(--sheet-2);    --popover-foreground: var(--ink);
  --primary: var(--cobalt);     --primary-foreground: #FFFFFF;
  --secondary: var(--cobalt-soft); --secondary-foreground: var(--cobalt);
  --muted: #EDEFEC;             --muted-foreground: var(--graphite);
  --accent: var(--cobalt-soft); --accent-foreground: var(--ink);
  --destructive: var(--danger);
  --border: var(--rule);        --input: var(--rule);  --ring: var(--cobalt);
}
 
.dark {
  --paper: #0F1820;  --sheet: #17232D;  --sheet-2: #1F2D39;
  --ink: #E6ECEF;    --graphite: #93A1AC; --rule: #2A3946;
  --cobalt: #7B9BFF; --cobalt-soft: #1C2A55; --marker: #E9C84A;
  --success: #4CC38A; --warning: #F0B44C; --danger: #FF7A85;
  --muted: #1A2631;  --primary-foreground: #0F1820;
}
 
@theme inline {
  --color-paper: var(--paper);   --color-sheet: var(--sheet);
  --color-ink: var(--ink);       --color-graphite: var(--graphite);
  --color-rule: var(--rule);     --color-cobalt: var(--cobalt);
  --color-cobalt-soft: var(--cobalt-soft); --color-marker: var(--marker);
  --color-background: var(--background); --color-foreground: var(--foreground);
  --color-primary: var(--primary); --color-primary-foreground: var(--primary-foreground);
  --color-border: var(--border); --color-ring: var(--ring);
}
```
 
---
 
## 3. Typography
 
Type carries TensorLM's personality: a precise sans for the tool, a reading serif for the
explanations. Two families plus mono for code, clearly distinct.
 
| Role | Face | Why |
|---|---|---|
| Interface (nav, buttons, labels, chat input, headings) | **Hanken Grotesk** (400, 500, 600) | Crisp, slightly technical, not the Inter/Geist default every AI app ships |
| Answers and long explanations | **Literata** (400, 400 italic, 600) | Designed for screen reading; makes answers feel like a good textbook, not a chat log |
| Code, tensors, shapes, formulas inline | **JetBrains Mono** (400, 500) | Clear 0/O and 1/l, good for `(batch, seq, d_model)` |
| Display math | **KaTeX** default fonts | Correct math rendering; never fake math in a sans |
 
Load with `next/font` (or `font-display: swap`), subset to Latin + Latin-ext, and preload only
Hanken Grotesk 400/600. Literata loads on first answer.
 
### 3.1 Scale (1.2 minor third, 16px base)
 
| Token | Size / line-height | Face | Use |
|---|---|---|---|
| `display` | 48 / 54, −0.02em, 600 | Hanken | Landing hero only |
| `h1` | 32 / 40, −0.015em, 600 | Hanken | Page titles |
| `h2` | 24 / 32, −0.01em, 600 | Hanken | Section titles, answer headings |
| `h3` | 19 / 28, 600 | Hanken | Card titles, diagram titles |
| `body-read` | 17 / 29 (1.7) | Literata | AI answers, document reader |
| `body` | 15 / 24 | Hanken | Interface text, user messages |
| `small` | 13 / 20 | Hanken | Metadata, timestamps, helper text |
| `code` | 14 / 22 | JetBrains Mono | Code blocks, inline shapes |
 
Mobile: `display` drops to 36/42, `h1` to 26/34, `body-read` stays 17 (never shrink reading text).
 
### 3.2 Type rules
 
- Answer text measure: **60–72 characters** (`max-width: 68ch`). Interface text under 80.
- Serif reading text gets more line-height (1.7) than sans (1.6).
- Sentence case everywhere. **No all-caps labels**, no tracked-out eyebrows above headings.
- Don't accent one word in a headline with italic, bold or colour.
- Numbers in tables and stats use `font-variant-numeric: tabular-nums`.
- Weight does the hierarchy, not colour: 600 for headings, 500 for emphasis in UI, 400 for body.
- Inline code in answers: mono at 0.92em, `muted` background, 4px radius, 2px 5px padding.
---
 
## 4. Space, shape, depth
 
### 4.1 Spacing
 
4px base. Allowed steps: 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96. Nothing in between.
Related items sit 8–12 apart; groups 24–32; sections 48–96.
 
### 4.2 Radius scale (one scale, by hierarchy)
 
| Token | Value | Use |
|---|---|---|
| `r-xs` | 4px | Inline code, tags, citation chips |
| `r-sm` | 8px | Buttons, inputs, menu items |
| `r-md` | 12px | Cards, message bubbles, source cards |
| `r-lg` | 16px | Panels, dialogs, the chat composer |
| `r-full` | 999px | Avatars, toggles, status dots only |
 
Never one radius for everything. Nested radius = outer radius − padding.
 
### 4.3 Depth
 
Depth is mostly borders and surface steps, not shadows.
 
```css
--shadow-1: 0 1px 2px rgb(20 33 43 / 0.06);                       /* cards at rest */
--shadow-2: 0 2px 4px rgb(20 33 43 / 0.06), 0 8px 24px rgb(20 33 43 / 0.08);  /* popovers, hover lift */
--shadow-3: 0 4px 8px rgb(20 33 43 / 0.08), 0 24px 48px rgb(20 33 43 / 0.14); /* dialogs, command palette */
```
 
Shadows are tinted with `ink`, never grey `rgba(0,0,0,.1)`. In dark mode, drop shadows almost
entirely and use the `sheet` → `sheet-2` step plus a 1px `rule` border.
 
### 4.4 The graph-paper texture
 
The one background texture TensorLM owns. Use it only on the **diagram canvas** and the
**empty state** of a new notebook, never behind reading text.
 
```css
.graph-paper {
  background-color: var(--paper);
  background-image:
    linear-gradient(var(--rule) 1px, transparent 1px),
    linear-gradient(90deg, var(--rule) 1px, transparent 1px);
  background-size: 24px 24px;
  background-position: -1px -1px;
  /* fade the grid toward the edges so it never feels like a spreadsheet */
  mask-image: radial-gradient(ellipse at center, #000 40%, transparent 85%);
}
.dark .graph-paper { --rule: #22303B; }
```
 
---
 
## 5. Subtle gradients (where, and exactly how much)
 
Gradients in TensorLM are light falling on paper, never decoration. Maximum three places:
 
1. **The composer glow** — when the chat input is focused, a soft cobalt light beneath it.
   ```css
   .composer:focus-within {
     box-shadow: 0 0 0 1px var(--cobalt),
                 0 8px 32px -8px color-mix(in oklab, var(--cobalt) 28%, transparent);
   }
   ```
2. **The thinking shimmer** — the text-shimmer on "Reading your sources…" while the model
   retrieves (section 7.4).
3. **The drop zone** — when a file is dragged over the window, a faint radial wash.
   ```css
   .dropzone[data-active] {
     background:
       radial-gradient(60% 50% at 50% 40%,
         color-mix(in oklab, var(--cobalt) 10%, transparent), transparent 70%),
       var(--paper);
   }
   ```
 
Optional, landing page only: one top-of-hero wash, cobalt at 6% fading into teal at 4% fading
into paper. Never behind body text, never on cards, never animated hue rotation, never more than
10% opacity anywhere.
 
---
 
## 6. Layout
 
### 6.1 App shell (desktop ≥ 1024)
 
```
┌──────────┬─────────────────────────────────┬──────────────────────┐
│ Sources  │  Conversation                   │  Canvas              │
│ 272px    │  fluid, answer max 68ch         │  420–560px, resizable│
│          │                                 │                      │
│ + Add    │  Q: How does attention work?    │  [diagram drawing    │
│ ▣ paper1 │                                 │   itself, step 3/5]  │
│ ▣ notes  │  A: (Literata) ... [1] [2]      │                      │
│ ▣ data   │     ┌ diagram card ┐            │  ◀ Prev  Next ▶      │
│          │                                 │                      │
│ Notebooks│  ┌ composer ──────────────┐     │  Source viewer tab   │
│          │  └────────────────────────┘     │  (marker highlights) │
└──────────┴─────────────────────────────────┴──────────────────────┘
```
 
- **Left: Sources.** What the AI knows. Each file shows type icon, name, index status.
- **Centre: Conversation.** Questions and explained answers. Left-aligned answer column; the user's
  messages sit on `sheet` cards, right-aligned, max 70% width.
- **Right: Canvas.** Opens when an answer has a diagram, graph or citation. Tabs: *Diagram*,
  *Source*. Closes with Esc; width persists per user.
- Panels collapse to icons at 1024–1279. Canvas becomes a bottom sheet at < 1024.
### 6.2 Mobile (< 768)
 
One column. Sources in a left drawer, canvas as a bottom sheet with three snap points (peek 25%,
half, full). Composer is fixed to the bottom, above the safe area
(`padding-bottom: env(safe-area-inset-bottom)`). Every tap target ≥ 44×44px with 8px between
targets.
 
### 6.3 Layout rules
 
- Equal left and right content edges; everything sits on the grid's columns.
- Visual structure is information. Numbered markers (1, 2, 3) only for real sequences: diagram
  steps, a worked example, a learning path.
- Two boxes deep at most. A card inside a panel is fine; a card inside a card inside a panel is not.
- Breakpoints: 390, 768, 1024, 1280, 1440. Test all of them plus 320 for overflow.
---
 
## 7. Motion
 
### 7.1 Motion tokens
 
```css
--dur-instant: 80ms;   /* press, toggle */
--dur-fast: 140ms;     /* hover, colour changes */
--dur-base: 220ms;     /* menus, popovers, tabs */
--dur-slow: 360ms;     /* panels, sheets, dialogs */
--dur-draw: 700ms;     /* one diagram stroke */
 
--ease-out: cubic-bezier(0.22, 1, 0.36, 1);      /* things arriving */
--ease-in: cubic-bezier(0.4, 0, 1, 1);           /* things leaving (use shorter durations) */
--ease-inout: cubic-bezier(0.65, 0, 0.35, 1);    /* things moving across */
--spring: cubic-bezier(0.34, 1.4, 0.64, 1);      /* small confirmations only (copied, saved) */
```
 
In Motion (Framer Motion) use `{ type: "spring", stiffness: 420, damping: 34 }` for panels and
`{ duration: 0.14, ease: [0.22, 1, 0.36, 1] }` for hovers.
 
### 7.2 The one orchestrated moment: diagrams that draw themselves
 
This is TensorLM's signature. When an answer includes a diagram:
 
1. Nodes fade from 0 to full opacity and scale 0.96 → 1 (220ms, ease-out), 60ms stagger.
2. Connectors draw with `stroke-dashoffset` from full length to 0 (`--dur-draw`, ease-inout),
   in the order the explanation mentions them.
3. Each node's label appears as its sentence streams in the answer. Hovering a sentence in the
   answer highlights its node; hovering a node highlights its sentence (both directions).
4. Step controls (Prev / Next / Replay) let people walk the diagram at their own pace. Space bar
   advances when the canvas has focus.
```css
.edge { stroke-dasharray: var(--len); stroke-dashoffset: var(--len);
        animation: draw var(--dur-draw) var(--ease-inout) forwards;
        animation-delay: calc(var(--i) * 120ms); }
@keyframes draw { to { stroke-dashoffset: 0; } }
```
 
Nothing else on the screen moves while a diagram draws.
 
### 7.3 Motion rules
 
- Motion that answers a person's action is welcome. Motion nobody asked for is rare.
- **Never:** fade-and-slide on every section, scroll-reveal on cards, parallax on text, tilt
  cards, carousels, auto-rotating tabs, random blinking, bouncing icons, confetti.
- Exits are faster than entrances (about 70% of the duration).
- Animate `transform` and `opacity` only; never `width`, `height`, `top` or `left` (use FLIP or
  `grid-template-rows: 0fr → 1fr` for expanding content).
- **Reduced motion:** with `prefers-reduced-motion: reduce`, diagrams appear complete instantly,
  shimmers become a static label, panels cross-fade in 120ms. Nothing stays hidden.
- Anything that moves for more than 5 seconds has a pause control.
### 7.4 AI-specific motion
 
| State | Treatment |
|---|---|
| Retrieving | Label "Reading 3 sources…" with a text shimmer (gradient sweep, 1.6s loop) plus the source names lighting up one by one in the sidebar |
| Thinking (long) | Same label updates honestly: "Comparing sections 3 and 5…". Never a fake progress bar |
| Streaming text | Tokens append with no per-word animation; a 2px cobalt caret blinks at the end (1s, steps) |
| Streaming done | Caret fades out over 200ms; message actions fade in |
| Diagram incoming | A dashed outline of the canvas appears, then section 7.2 |
| Stopped | Text stays as written, a small "Stopped" note with Continue |
 
```css
.shimmer {
  background: linear-gradient(90deg, var(--graphite) 0%, var(--ink) 50%, var(--graphite) 100%);
  background-size: 200% 100%;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: shimmer 1.6s linear infinite;
}
@keyframes shimmer { from { background-position: 100% 0; } to { background-position: -100% 0; } }
@media (prefers-reduced-motion: reduce) { .shimmer { animation: none; color: var(--graphite); } }
```
 
---
 
## 8. Micro-interactions catalogue
 
Every interactive element answers the pointer and the keyboard. Use these exactly.
 
### 8.1 Controls
 
| Element | Hover | Press | Focus | Done |
|---|---|---|---|---|
| Primary button | background darkens 6% (`color-mix` with ink), 140ms | `scale(0.98)`, 80ms | 2px cobalt ring, 2px offset | — |
| Ghost / icon button | `cobalt-soft` fill fades in | `scale(0.94)` | ring | — |
| Link | underline draws left→right (`background-size` 0→100%), 200ms | — | ring | — |
| Linked card | lifts 2px, `shadow-1` → `shadow-2` | settles back 1px | ring on the card | — |
| Toggle | thumb slides with `--spring` | — | ring | label updates ("On") |
| Copy button | icon tints cobalt | `scale(0.94)` | ring | icon morphs to a check for 1.5s, tooltip "Copied" |
 
Focus rings use `:focus-visible` only, `outline: 2px solid var(--ring); outline-offset: 2px;`,
and are never hidden under a sticky header (`scroll-margin-top`).
 
### 8.2 Uploading sources
 
1. Drag a file anywhere over the window: the full-window drop zone fades in (220ms) with the wash
   from section 5 and the line "Drop to add to this notebook".
2. Drop: the file card appears in the sidebar at its final position (no flying).
3. Progress has honest stages, shown as a thin bar plus a word: *Uploading* → *Reading* →
   *Indexing* → *Ready* (check icon, success colour, 1.5s then settles to normal).
4. Failure: card shows danger icon, the reason ("Scanned PDF with no text layer") and the fix
   ("Run OCR" button). Never "Something went wrong".
5. Paste an image or a link into the composer: it becomes a source chip inside the composer.
### 8.3 Asking and answering
 
- **Composer** auto-grows from 1 to 8 lines, then scrolls. Enter sends, Shift+Enter adds a line,
  `/` opens commands (Explain, Diagram, Example, Quiz me, Summarise), `@` picks a source.
- **Send button** is disabled-looking (graphite) when empty, becomes cobalt the moment there's text.
  While streaming it turns into **Stop** (square icon) in the same spot.
- **Citations** are small numbered chips `[1]` in `r-xs`, cobalt-soft fill. Hover (or long-press
  on mobile) shows a preview card after 300ms: file name, page, the quoted passage with marker
  highlight. Click opens the Source tab scrolled to that passage, which flashes its marker
  highlight once (opacity 0.3 → 0.6 → 0.45, 600ms).
- **Message actions** (Copy, Regenerate, Make simpler, Go deeper, Save to notes) appear on hover
  and on focus within the message, always visible on touch.
- **Make simpler / Go deeper** replace the answer in place with a cross-fade; a small "Level:
  Beginner · Intermediate · Expert" switch keeps the choice.
- **Code blocks:** copy button top-right, language name top-left in graphite, line wrap toggle.
- **Math:** click a formula to see its LaTeX and copy it.
- **Feedback:** thumbs up/down; down opens a 3-option inline reason ("Wrong", "Unclear",
  "Missing source") — no modal.
### 8.4 Toasts and confirmations
 
- Bottom-left on desktop, top on mobile, 4s, pause on hover, dismiss on Esc.
- The verb matches the button: **Delete source** → toast "Source deleted" with **Undo** (8s).
- Destructive actions use undo rather than "Are you sure?" dialogs wherever undo is possible.
### 8.5 Keyboard
 
`⌘/Ctrl K` command palette · `⌘/Ctrl U` add source · `⌘/Ctrl /` focus composer ·
`Esc` close canvas or stop streaming · `←/→` diagram steps · `⌘/Ctrl ⇧ C` copy last answer.
Show shortcuts in tooltips and in the command palette.
 
---
 
## 9. Writing in the interface
 
Words are design content. Write them before the layout.
 
- **Plain verbs, sentence case, no filler.** "Add source", "Explain this section", "Draw a diagram".
- **Name things the way learners think,** not how the system works: "Sources", not "Knowledge
  base"; "Reading your files", not "Embedding chunks".
- **Buttons are a verb and an object** and say exactly what happens. The action keeps its name
  through the whole flow.
- **Errors say what happened and how to fix it,** in the product's voice, without apology:
  "This file is 120 MB. The limit is 50 MB. Split the PDF or upload chapters separately."
- **Empty states invite one action:** New notebook → "Add a paper, notes or a dataset, then ask
  anything about it." plus **Add source** and three example questions as chips.
- **AI honesty:** when sources don't cover a question, say so: "Your sources don't mention
  positional encoding. I can explain it from general knowledge, marked as such." General-knowledge
  passages get a graphite "Not from your sources" tag.
- **Banned words:** seamless, unleash, supercharge, revolutionize, effortless, magic, next-level,
  "AI-powered" as a headline, "Oops!", "Something went wrong". No `→` stuck on button text. No
  "A · B · C" meta strings as decoration.
- Never invent testimonials, user counts or figures on marketing pages.
---
 
## 10. Component patterns
 
### 10.1 Source card
Type icon (real file-type icon: PDF, DOCX, CSV, PNG) · name (truncate middle: `attention-is-al…ed.pdf`)
· status line in `small` ("12 pages · Ready") · overflow menu. Selected sources have a cobalt
2px left edge. Unchecking a source excludes it from answers, shown instantly in the composer
("Asking 2 of 3 sources").
 
### 10.2 Answer
Literata body, `h2`/`h3` Hanken headings inside long answers, citations inline, diagrams as
inline cards (click to open in canvas), worked examples in a `sheet` card with numbered steps,
"Key idea" callout with a 3px cobalt left border (one per answer at most).
 
### 10.3 Diagram card
Graph-paper background, title in `h3`, step counter "Step 2 of 5", Replay, Open in canvas,
Download SVG/PNG. Nodes `r-sm`, palette from 2.4. Always a text alternative: a collapsible
"Describe this diagram" that lists nodes and connections.
 
### 10.4 Graphs
From the user's data: axis labels in `small` graphite, gridlines in `rule` at 60%, no chart
junk (no 3D, no shadows), tooltip on hover/focus with exact values in tabular nums, a "View data"
table toggle for accessibility. Max five series.
 
### 10.5 Learning tools
Quiz me (one question at a time, options as full-width rows, correct = success tint + check,
wrong = danger tint + the explanation, never just red), flashcards (flip with 3D rotateY 400ms,
reduced motion: cross-fade), learning path (a real numbered sequence, completed steps ticked).
 
### 10.6 Loading
Skeletons match the real layout's shapes, `muted` fill with a slow 1.6s sheen; show after 300ms
only (fast loads never flash a skeleton).
 
---
 
## 11. Anti-slop list (check every plan against it)
 
These read as "generated". Only use one if the brief explicitly asks for it.
 
1. Warm cream background with a high-contrast serif and terracotta accent.
2. Near-black background with one acid-green or vermilion accent.
3. Purple/violet gradients, glowing orbs, "aurora" blobs, sparkle ✨ icons as the AI symbol.
4. The SaaS card kit: everything chopped into identical rounded cards with the same grey shadow.
5. Big number + small label + gradient accent as the default hero.
6. ALL-CAPS tracked eyebrows over every heading; numbered 01/02/03 markers on non-sequences.
7. One word in a headline italicised or coloured.
8. Glassmorphism panels, neon glows, gradient borders on every card.
9. Fade-up entrance on every section; hover animation on every card for no reason.
10. Inter / Roboto / Arial / system fonts as the brand face.
11. A generic dashboard screenshot instead of TensorLM's real UI.
12. Typing-dots "…" as the only AI state, or fake progress bars.
---
 
## 12. Landing page (tensorlm.io)
 
- **Hero shows the product working:** a real question ("How does multi-head attention work?")
  next to the real canvas with a diagram drawing itself (the section 7.2 moment, played once on
  load, Replay button). The h1 names what it is and for whom, e.g. "Understand any paper, with
  diagrams that explain it" + one hard fact ("Upload PDFs, notes, images and CSVs"). One main
  action: **Try it free**. A second, quieter action at most.
- One section per screen, each with a single idea and its own real UI fragment: upload → cited
  answer with marker highlights → diagram steps → graph from a CSV → quiz. Different compositions
  each section, never the same card grid twice.
- Pricing in ₹ with plain plan names; one contrasting band (ink background) at most per page.
- Same tokens, fonts and motion as the app. The hero diagram is the only animated moment besides
  hover states.
- Head: title, description, Open Graph image (the hero diagram), theme-color = paper.
---
 
## 13. Quality floor and final checklist
 
Run this before calling any screen done.
 
**Look**
- [ ] Only tokens used; no raw hex, no new radius, no grey `rgba(0,0,0,.1)` shadow.
- [ ] Cobalt only on actions and "you are here"; marker only on source evidence.
- [ ] Correct face for each role; answers in Literata at 17px, 68ch max.
- [ ] Boldness spent in one place; one accessory removed.
- [ ] Light and dark both checked; dark uses surface steps, not heavy shadows.
**Behaviour**
- [ ] Every button, link and card answers hover, press and focus (section 8.1).
- [ ] Every AI state designed: empty, retrieving, streaming, stopped, error, no-source-match.
- [ ] Every upload stage and failure designed with a fix.
- [ ] Only one orchestrated motion moment on screen.
- [ ] Reduced motion: everything visible, nothing animating.
**Access**
- [ ] Contrast: 4.5:1 text, 3:1 UI and focus ring.
- [ ] Keyboard reaches everything in order; visible focus; skip link; Esc closes overlays.
- [ ] Streaming answers in an `aria-live="polite"` region (announce on completion, not per token).
- [ ] Diagrams and graphs have text alternatives; icons have accessible names.
- [ ] Tap targets ≥ 44px; nothing overflows at 320px.
**Speed**
- [ ] Fonts subset and swapped; Literata lazy.
- [ ] Diagrams are SVG; graphs render under 100ms for 1,000 points; no layout shift on stream.
- [ ] Long conversations virtualised; images lazy and sized.
**Words**
- [ ] Sentence case, verbs on buttons, matching toast verbs.
- [ ] Errors explain and fix; empty states invite one action; no banned words.
---
 
## 14. Notes for future passes
 
Keep a short log at the end of this file of what was tried and how it landed (for example, "tried
a teal accent on the canvas tabs, too close to chart series 2, reverted"). Designers remember;
this log is the memory.