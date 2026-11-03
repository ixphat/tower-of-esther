# Tower of Esther

Korean-manhwa-style tower-climbing RPG for the web. Turn-based, single-player, real players compete asynchronously (Option B). 50 floors in 5 arcs of 10. First goal: Arc 1 (floors 1–10) with every system in place.

## Phase

**Concept design. No code until Phat asks.** (Change this line when building starts.)

## How to work with Phat

- Stick exactly to the requested scope. No unrequested features, no fallback logic.
- When coding: follow current best practices and the standard conventions of each language, framework and tool. Code must be readable, secure and maintainable. Short inline comments, no separate doc files.
- If Phat pastes a version he edited, that version is the new base.
- "ok" / "next" = start the next most necessary item without asking; ask only when there is a real choice.
- "use your judgement" = decide, mark those decisions as Claude's choices in the doc, and report them.
- Difficulty stance: the game must not be easy. When a balance number is questioned, default to keeping the hard number.

## Docs (source of truth)

| File | Holds |
| --- | --- |
| `docs/00-overview.md` | Goal, decided, not decided yet, next steps. **Wins over any conflicting file.** |
| `docs/01-lore.md` | World, overarching story, 5 arcs, Esther, Ezra, the Watchers, the Order |
| `docs/02-floor-design.md` | Design principles, things to avoid, floor template, clear grades |
| `docs/03-arc1.md` | Floors 1–10 in detail, bondable NPCs, class master chains |
| `docs/04-systems.md` | Grades, stats, classes, skills, fusion, equipment, crafting, enhancement, EXP, Watchers |
| `docs/05-online.md` | Option B features, Supabase backend, anti-cheat |
| `docs/06-ui.md` | Eight screen designs (visual direction lives in 00) |

Rules:
- Each topic lives in one file only. Don't duplicate content across files; link to the file instead.
- Read only the files a task needs. Search with grep before reading a whole file.
- When a decision is made or changed: update the owning file, then move the item in 00 from "Not decided yet" to "Decided" (one-line summary pointing to the owning file).

## Tech stack (decided, for when coding starts)

Vite + TypeScript + Svelte, Supabase backend, hosted on GitHub Pages. All game data (skills, floors, items, recipes, balance numbers) lives in JSON under `data/`, separate from code.

## Wayfinder

- Tracker: GitHub Issues of this repo. The map is the issue labelled `wayfinder:map`.
- The docs stay the source of truth. Tickets and comments link to the doc section; they don't copy its content.
- When a ticket is resolved: update the docs as above in the same session, then comment the answer on the ticket with a link to the changed section, then close it.
- Grilling tickets: ask Phat, never answer for him. Offer options with a recommendation when useful.
- Out of scope unless the map is redrawn: Arc 2 and later (floors 11–50), real-time PvP, anything outside Option B.

## Agent skills

### Issue tracker

GitHub Issues in `ixphat/tower-of-esther`, via `gh`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
