# 05 Online

Real-player features for "Option B": asynchronous, with no need to be online at the same time and no real-time PvP. The game is single-player; other climbers appear through what the server remembers of them. Concept only, no code yet. All details are drafts. How these features look on screen is in 06 UI (screen 8).

## Principles

1. **Asynchronous.** Nothing requires two players online together. Everything is stored and shown later.
2. **Other climbers are part of the world.** In the story, other climbers are the real players (see 01 Lore). Their notes, builds and results make the Tower feel shared.
3. **No direct competition for rank.** Players do not fight each other. Comparison happens through clear grades and progress boards.
4. **The server is the truth for shared things only.** Single-player progress lives with the player. Anything shown to others (boards, notes, echoes) is checked by the server.
5. **Safe by design.** Short notes, preset phrases, a report button and light moderation, so shared text cannot ruin the story or spoil it too much.

## Features

| Feature | Where | What players see and do |
| --- | --- | --- |
| Guestbook | Floor 2 (Rest Town) | Read messages left by other climbers and sign it once to open the road gate. Signing always opens the gate; the message is posted only if the player is signed in and online. Messages are short and moderated |
| Notice board | Floor 2 | Quests and rumors. Some rumors come from real players' notes |
| Wall board | Floor 2, and a read-only copy in the Board window | Where the server's climbers are stuck: counts of climbers at each wall floor (the First Wall first), first clears and best clear grades |
| Echoes | Floor 2, the hall on floor 9 and each floor's resting place | A recorded snapshot of another player's climber (class, any add-on class, branch, level, strongest skills with their stages, gear, clear results) shown as an NPC climber. You can talk to an echo and see the build. You cannot fight or trade with it. At most 3 appear per location, chosen at random from climbers who reached that floor and refreshed each visit |
| Hall of echoes | Floor 9 (barracks) | A hall where echoes of other climbers' builds stand as gladiators on display. For viewing only, not fights |
| Notes at key spots | On every floor | Leave a short note (draft: 60 characters) or a preset sign at a spot. Others see it when they reach it. Presets: "Danger ahead", "Hidden path", "Rest here", "Turn back", "Worth it", "Look closer". On floor 8, where the layout changes every entry, notes attach to stable landmarks (the scouts' camp, the Elder Tree, ancient trees) instead of coordinates, so they stay valid |
| Path statistics | After a clear | After clearing a floor, see how many climbers took each path (for example how many chose Cure on floor 3). Later available in the Board window, only for floors the climber has cleared |
| Clear grade board | Rest Town wall board, and a read-only copy in the Board window | Best clear grade per floor for the climber and the share of climbers at each grade |

## What the server stores

| Data | Notes |
| --- | --- |
| Display name | Chosen by the player. No real name or email shown |
| Echo snapshot | Class, any add-on class, branch, level, strongest skills with stages, equipped gear, Hero power grade. Updated when the climber clears a floor. The player can switch echoes off |
| Clear results | Per floor: path taken, clear grade, date |
| Notes | The text or preset, the spot, the author, report count |
| Counters | For the wall board and path statistics |

Single-player progress (inventory, fusion journal, recipes) stays with the player's own save.

## Backend (concept)

- Supabase (decided Nov 2, 2026, see 00 Overview): database, accounts, access rules, and server-side functions for validation. A separate server such as Elysia can be added in front of it later if the checks become too complex.
- No account is needed for single-player play, which is saved on the device. Players sign in by email magic link, with no passwords, only to post or appear to others, so their echo, results and notes belong to them.
- The game works offline for the single-player parts. Shared features need a connection and fail quietly if it is missing.
- Shared data is read-only for other players and writable only by its author.

## Anti-cheat (concept)

The game runs on the player's device, so any number sent from the client can be faked. The rule is to trust the client for single-player play and check anything that becomes public.

| Measure | Purpose |
| --- | --- |
| Plausibility checks | Reject results the rules make impossible, such as a level above the cap, stat totals above what a level allows, skill levels above what the fights a climber could have had would give, or gear of a grade the climber could not have |
| Recorded runs for top results | For clears that reach the best grades or the first clear of a wall, the client sends a short log of key actions and the random seed, so a result can be checked later |
| Outlier flags | Flag unusually fast or perfect results for review |
| Rate limits | Limit how often a player can post notes and submit results |
| Removal | Cheated entries can be removed from boards and echoes later, with the author's board entries hidden |
| Reports | Players can report notes and echoes |

The first version relies on plausibility checks, rate limits, reports and outlier flags. Recorded runs are off at launch; storing and checking them is designed when the first real top results appear.

## Floors that use online features

| Floor | Hook |
| --- | --- |
| 2 | Guestbook, notice board, wall board, echoes, clear grade board |
| 8 | Notes attached to stable landmarks |
| 9 | Hall of echoes |
| 10 | The First Wall counts and first clears on the wall board |
| All | Notes at key spots and path statistics after a clear |

## Decisions on open questions (Nov 9, 2026)

- Moderation: a server word filter runs before a note is posted. A note is hidden automatically at 3 reports, and hidden notes are reviewed by hand.
- Boards and echoes are on by default, with the off switch shown at first sign-in.
- A note is tied to a stable spot ID. If its spot is removed by an update, the note is hidden. Echoes remain.
