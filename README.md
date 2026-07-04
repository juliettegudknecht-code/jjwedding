# Handoff: Juli & Josh Wedding Website

## Overview
A multi-page wedding website for **Juli Taylor & Josh Lane**, married **May 15, 2027** at **The Jewel Box** (a 1936 Art Deco glass greenhouse) in Forest Park, St. Louis. The couple lives in DC and met in Missouri. The site's concept is a **botanical greenhouse + treasure-map scavenger hunt**: warm, hand-drawn, relaxed, no wedding party, Zola registry. It is designed to deploy on **GitHub Pages**.

## About the Design Files
The files in this bundle are **design references created in HTML** — prototypes that show the intended look, motion, and behavior. They are **not production code to copy verbatim**. The task is to **recreate these designs in the target codebase's environment** (e.g. React/Next, Vue, Astro, plain static site) using its established patterns, then wire up real data (RSVP storage, auth) properly.

Technical note: the prototypes run on a small custom "Design Component" runtime (`support.js`) that streams `*.dc.html` templates and renders them with React. **Do not ship `support.js`.** Treat each `*.dc.html` as one page/component: the markup between `<x-dc>…</x-dc>` is the template, and the `<script data-dc-script>` block is its logic class (`renderVals()` returns the values the template binds to). Reimplement each as a component in the chosen framework.

## Fidelity
**High-fidelity (hifi).** Final colors, typography, spacing, motifs, copy, and interactions are all decided.

**Update (shipped build):** "Travel" and "Things to Do" have been **merged into a single page** (`travel.dc.html`, nav label "Travel & Things to Do"). `things-to-do.dc.html` now redirects there so old links keep working. This build ships as-is to GitHub Pages (the `.dc.html` prototypes plus the `support.js` runtime), with `.nojekyll` at the repo root.

## Design Tokens

### Color
| Role | Hex |
|---|---|
| Page background (ivory) | `#F4EEDF` |
| Card / surface | `#FCFAF3`, `#FFFDF7` |
| Deep green (headings) | `#2E4634` (also `#233D2C`, `#24331F`) |
| Sage greens (foliage/UI) | `#6E8262`, `#88997C`, `#7E9068`, `#9FB08C`, `#5E7350` |
| Leaf outline / dark green | `#3E5A3E` |
| Muted teal-green accents | `#8CA177`, `#E4EAD6` (leaf fill on dark) |
| Terracotta (primary accent) | `#C0674A`; hover `#A9542F`; dark stroke `#8A3F22`; alt `#B4562F` |
| Blush / tan | `#E4B79A`, `#D98C5F`, `#B08A64`, `#8A6A52` |
| Gold (ring/spadix) | `#C6A24E`, `#CBA75E`, `#EBD79E`, `#E8B84B` (calla spadix), stroke `#C99433` |
| Diamond (gem) | fill `#DCEBF7`/`#E7F1FA`, stroke `#9FB4C6` |
| Body text | `#4A473B`, `#5A5647`, `#6E6A58` |
| Card borders | `#CBA75E` (framed), `#E4D8B8`, input `#CFC3A5`, dotted trail `#C9B48A` |

Backgrounds use a subtle dotted "paper" texture: `radial-gradient(#e7dfc0 0.7px, transparent 0.7px)` at `background-size:24px 24px` over `#F4EEDF`.

### Typography (Google Fonts)
- **Cormorant Garamond** — display & headings (weights 500/600; italic used for the `&`, taglines, and "are getting married"). Names/hero scale up to `clamp(58px,11.5vw,152px)`.
- **Caveat** — handwritten accents, section kickers, the footer sign-off "xoxo, J & J".
- **Jost** — body, form fields, and uppercase labels (letter-spacing `.16em`–`.34em`, `text-transform:uppercase`, 11–14px).

### Shape / elevation
- Border radius: mostly **2–4px** (squared, not pill). No pill buttons.
- Shadows are **flat/offset** (e.g. `3px 4px 0 rgba(120,95,55,.14)`, `box-shadow:2px 2px 0 …`) — no soft glowy/gradient shadows.
- Buttons: solid deep-green `#2E4634` or terracotta `#C0674A`, 1.5px darker border, flat offset shadow, uppercase Jost.

### Signature motifs (hand-drawn SVG, chunky outlined — never thin/elegant)
- **Calla lilies** (Art Deco) and **monstera** leaves, reused throughout.
- **Greenhouse glass roofs**: ridge-and-furrow sawtooth (home hero) and gabled glass; faint sage glass fill `rgba(150,176,132,.15)`, frame `#5E7350`.
- **Hanging plants** from roofs (home only), **calla clumps** (footer), **dotted leaf trails**, **map pins / X-marks-the-spot** (scavenger theme).
- **Engagement ring** = thin gold band + baguette diamond + two accent stones (matches Juli's real ring). Shown inside a **glass greenhouse box** on the home hero and inside a jewel-box on the nav historically.

## Shared Components
- **SiteNav** (`SiteNav.dc.html`): top header on every interior page. Faint greenhouse glass-roof strip, centered animated **calla sprig**, "Juli & Josh" + "the greenhouse wedding · may 15, 2027", nav links with **small leaf glyphs between each item**, and a dotted-trail divider. Takes an `active` prop (page id) to underline the current link. Links: Home, Our Story, The Details & Venue, Schedule, Travel, Things to Do, Gallery, Registry, FAQ, RSVP.
- **SiteFooter** (`SiteFooter.dc.html`): deep-green `#2E4634` panel with glass-roof strip, two large swaying **calla clumps**, a tagline, a **row of round photos threaded on a leafy vine**, footer nav, date line, and a Caveat **"xoxo, J & J"** sign-off.

## Screens / Views

1. **Home** (`home.dc.html`) — Landing hero.
   - On first visit per session, a cursive **"Juli & Josh"** intro (Cormorant) fades over the page then clears (gated by `sessionStorage 'jj_intro'`).
   - Top: compact **greenhouse glass roof** (sawtooth) with **two hanging callas**.
   - Center: small **glass greenhouse box holding the ring** icon → eyebrow "THE JEWEL BOX · FOREST PARK, ST. LOUIS" → giant **"Juli & Josh"** (serif, italic terracotta `&`) → "are getting married" → **circular couple photo** that spins in horizontally (`rotateY`, ~2.4s) and **spins again on hover**.
   - Below: date "MAY 15, 2027", "SAINT LOUIS, MISSOURI", live **countdown** ("N DAYS TO GO", target `2027-05-15`), nav, a taped "spring in bloom" polaroid, and two **calla clumps** at the bottom that **grow/open on hover**.
   - Bottom-right: small uppercase link to the private **sign-in** page.

2. **Our Story** (`our-story.dc.html`) — Illustrated **Missouri → DC** map narrative + an **interactive first-date scavenger hunt** (toggle STL / DC; numbered clue "stops" as map pins; a demo **photo upload** per stop saved in-browser) + a **"DC life lately"** taped-photo strip. The **"The Jewel Box (May 15!)"** map label links to the Details page.

3. **The Details & Venue** (`details.dc.html`) — Ceremony details + venue. Cards: The Celebration, **The Place: The Jewel Box** (5600 Clayton Ave, St. Louis, MO 63110 + **Get directions** button to Google Maps), The Setting, Getting There/parking, What to Wear, Good to Know. RSVP CTA.

4. **Schedule** (`schedule.dc.html`) — Day-of **timeline** laid out as a back-and-forth **leafy vine**, cards alternating left/right.

5. **Travel** (`travel.dc.html`) — Getting there / where to stay / getting around, using **tap-to-open popup cards** (airport + find-flights, venue directions, hotel search, MetroLink).

6. **Things to Do** (`things-to-do.dc.html`) — Cartoon **St. Louis map** with clickable pins linking to attractions (official sites, tickets, Google Maps). *→ To be merged into Travel.*

7. **Gallery** (`gallery.dc.html`) — Masonry of taped photos; **click opens a lightbox** with prev/next and captions.

8. **Registry** (`registry.dc.html`) — Link out to the **Zola** registry (item cards to be filled once item list is provided).

9. **FAQ** (`faq.dc.html`) — Common questions (greenhouse warmth, kids, parking, timing, etc.).

10. **RSVP** (`rsvp.dc.html`) — **"Into the greenhouse"** experience:
    - **Locked**: a greenhouse-doors icon + password field. Password = **`rsvp`** (case-insensitive). Wrong → shake + "that's not it".
    - **Opening**: full-screen overlay of the **greenhouse doors swinging open** (matches the locked icon: arched glass, mullions, gold handles, flanking plants), ~1.5s, no zoom.
    - **Form**: pick a **plant** to answer — lush potted calla = **"Joyfully, yes"**, small sprout = **"Sadly, no"** (selected plant gets a colored ring). Then name, email, party size (if attending), dietary, song, note. Submit → success ("Thank you, {firstName}!") with a potted plant.
    - Below the card: **Ceremony** (Sat May 15 2027, 4:30–5:00 PM, The Jewel Box at Forest Park, 5600 Clayton Ave, greenhouse—fans provided, may be warm) and **Reception** (6:00–10:00 PM, The Trolley Room at the Forest Park Visitor Center, 5595 Grand Dr, cocktail-style, heavy apps + open bar, food 6–8 PM) + attire note (cocktail/garden).

11. **Sign In** (`signin.dc.html`) — Private gate for the couple. Password = **`juli`** → routes to the dashboard.

12. **Dashboard** (`dashboard.dc.html`) — Juli's private planning view: greenhouse-styled header, a **task checklist** (hair/makeup trial + day-of, send invites, finalize guest list, florist/plants, cake tasting, confirm venue, book photographer, music/DJ, day-of timeline, thank-you notes) and **RSVP tracking** that reads saved replies.

## Interactions & Behavior
- **Countdown**: days until `2027-05-15T15:00:00`, recomputed on load.
- **RSVP**: password `rsvp` unlocks → doors-open animation (~1.5s, CSS `scaleX` on two SVG door groups + fade) → plant-pick form. Submissions pushed to `localStorage['juliJosh_rsvps']` (array of `{name,email,attending,party,dietary,song,note,at}`).
- **Sign-in / dashboard**: password `juli`; dashboard reads `juliJosh_rsvps` to summarize accepts/declines and show a guest list.
- **Scavenger hunt** (Our Story): select STL/DC region, step through numbered clue stops; per-stop photo upload is a **demo** persisted in-browser only.
- **Gallery lightbox**: click a photo → modal with ‹ › navigation and Esc/× close.
- **Home**: session-gated intro; couple photo `rotateY` spin on enter + on hover; calla clumps scale/open on hover (`transform-origin:bottom center`).
- **Motion**: gentle `sway`/`hang` keyframes on plants; `fadeUp`/`growIn` entrances; all easing ~`cubic-bezier(.2,.8,.25,1)` or `ease-in-out`, 0.5–2.4s.
- **Navigation**: plain relative `<a href="*.dc.html">` links (rewrite to routes in the target app).

## State Management
- `localStorage['juliJosh_rsvps']` — array of RSVP submissions (guest-facing form writes; dashboard reads).
- `sessionStorage['jj_intro']` — flag so the home cursive intro plays once per session.
- Scavenger-hunt photo uploads — stored in-browser as a demo (replace with real upload/storage).
- **Passwords are client-side placeholders** (`rsvp`, `juli`) for the prototype — replace with real auth for production.

## Assets
- **Photos** (`photos/`): engagement / cherry-blossom shots (`juli-josh-1.png`, `juli-josh-2.png`, plus `*.jpeg` used in gallery, footer, story) and candid "DC life" photos (`dclife1–5.jpg`). Provided by the couple.
- **All illustrations are inline SVG** (callas, monstera, greenhouse roofs/box, ring, map, pins, doors) — no external icon files. Recreate as SVG components or export as needed.
- **Fonts**: Cormorant Garamond, Caveat, Jost (Google Fonts).

## Deployment (current prototype)
- `index.html` at root is a **redirect to `home.dc.html`**; `.nojekyll` disables Jekyll processing for GitHub Pages. All asset/nav paths are relative. Every page pulls `support.js` (prototype runtime).

## Files
- Pages: `home.dc.html`, `our-story.dc.html`, `details.dc.html`, `schedule.dc.html`, `travel.dc.html`, `things-to-do.dc.html`, `gallery.dc.html`, `registry.dc.html`, `faq.dc.html`, `rsvp.dc.html`, `signin.dc.html`, `dashboard.dc.html`
- Shared: `SiteNav.dc.html`, `SiteFooter.dc.html`
- Runtime (reference only, do not ship): `support.js`
- Deploy: `index.html`, `.nojekyll`
- Assets: `photos/`
