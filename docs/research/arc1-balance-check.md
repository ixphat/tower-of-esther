# Arc 1 balance check

Research note, Nov 9, 2026, for the PRD. It does not change any decision; the owning docs stay the source of truth.

## How to read this

**Verdicts.** Keep, Change or Test in play. Change is used only for a real defect: a rule that is missing, contradicts another rule, or offers a choice that is never correct. Being harder than another game is never a reason.

**Confidence.**

- High: the owner's page was opened, or our own arithmetic from `docs/04-systems.md`.
- Medium: a community wiki page was opened, or an official page was seen only as a search excerpt.
- Low: forum posts, fan guides or review sites, or search excerpts of them.

**Limits of this research.** The page fetch tool refused or failed on Bulbapedia, wiki.gg, Smogon, most Wikipedia pages (the Tower of God page did open), Tom's Hardware, copyright.gov, Nexon's support site, Orange Mushroom, Anime News Network, Vitest and www.gamedeveloper.com. For those, the claim rests on a search excerpt and is marked "excerpt". Where a claim rests on a batch of search results, the link is the most likely of those results and may not be the exact page that carried the wording, so recheck it before quoting. The GDC talks were not watched. Items that could not be verified at all are listed near the end.

**Our arithmetic.** Enhancement is a 100,000-run Monte Carlo of the rules in Equipment. Class stats use the Level-up rule (proportional growth, 3 points per level). Floor gear is the recommended grade at +0 to +4 by floor. At floor 10 the weapon is C at +4, because of finding S3 below. Skills average 130%, the same assumption as the doc's simulator.

| Floor (level, gear) | Slowest to fastest class, turns to kill a normal | Hits a normal needs to kill the climber |
| --- | --- | --- |
| 1 (Lv 1, F) | 2.5 to 4.0 | 26 to 45 |
| 5 (Lv 9, D +2) | 2.7 to 3.8 | 24 to 43 |
| 10 (Lv 20, C +4) | 3.1 to 4.4, average 3.6 | 19 to 36 |

The enhancement figures in `docs/04-systems.md` all reproduce: +4 mean 4.7 attempts and 218 materials; +6 mean 9.6 attempts, 635 materials and 9.3 rare parts; +6 with charms 7.0 attempts, 468 materials and 3.9 charms; +10 mean 132.5 attempts, or 16.5 with charms.

---

## 1. Damage and mitigation

| # | Claim | Source | Confidence | Our number | Verdict |
| --- | --- | --- | --- | --- | --- |
| 1.1 | League of Legends uses damage × 100/(100+armor), and each armor point adds 1% effective health with no diminishing returns | [LoL Wiki, Armor](https://wiki.leagueoflegends.com/en-us/Armor) (community wiki; no Riot statement found) | Medium | Identical formula. Def 3 to 60 removes 2.9% to 37.5%. Guard 18 to 86 removes 15% to 46% | **Keep** |
| 1.2 | Pokémon rolls a random factor of 85% to 100% on damage | [Bulbapedia, Damage](https://bulbapedia.bulbagarden.net/wiki/Damage) (excerpt) | Medium | We define no damage roll, yet the Sword Saint trait "Precision" raises "the lowest damage roll" | **Change** (fix 6) |
| 1.3 | Darkest Dungeon Protection is a flat percentage reduction on direct damage that does not affect bleed or blight; one guide says the reduction rounds down | [DD Wiki, Glossary](https://darkestdungeon.wiki.gg/wiki/Glossary), [GamePressure](https://www.gamepressure.com/darkestdungeon/attributes/z48426) (excerpts) | Low to Medium | Ours is a ratio, so it has no cap problem. DoT also ignores Guard here, the same split | **Keep** |
| 1.4 | Slay the Spire uses flat multipliers: Vulnerable +50%, Weak −25%, and they do not affect Poison | [StS Wiki, Debuffs](https://slaythespire.wiki.gg/wiki/Debuffs) (excerpt) | Medium | Our debuffs are smaller (3 to 20%). Scrap skills are meant to be weak | **Keep** |
| 1.5 | Curve check at our ranges | Our arithmetic | High | Time to kill a normal holds near 3 turns on every floor, so the Def column tracks player Attack well. Enemy hits are low integers (3 to 7 on floors 1 to 3), and no rounding rule exists | **Keep** the curve. **Change** the rounding gap (fix 5) |

The ratio formula is sound at our ranges. It cannot reach zero or go negative, and it has no breakpoints to exploit. Guard 100 is exactly half damage, which is easy to explain to players.

**A note on the difficulty read.** A normal enemy needs 19 to 45 hits to kill the climber. Attrition comes from no regeneration between fights and from elites and bosses, not from single hits. That is a valid hard-game shape, but it depends on enemy scripts and floor rules that the simulator left out. Test it in play.

## 2. Enemy tiers and fight length

| # | Claim | Source | Confidence | Our number | Verdict |
| --- | --- | --- | --- | --- | --- |
| 2.1 | Mega Crit balanced Slay the Spire from collected play data, because a small team could not hand-balance hundreds of cards | [GDC listing](https://gdconf.com/news/learn-slay-spires-successful-metrics-driven-approach-game-balancing-gdc-2019) (excerpt); talk not watched | Low to Medium | Our turn targets are simulator guesses. Record real turns per fight from the first playable build | **Test in play** |
| 2.2 | No published fight-length guidance for turn-based RPGs was found. The Game Balance book covers PvE progression, but its text was not read | [Routledge listing](https://www.routledge.com/Game-Balance/Schreiber-Romero/p/book/9781315156422) | Low | HP multipliers 1 / 1.67 / 3.33 / 4.67 / 4 to 8 are just target turns ÷ 3. They are internally consistent but have no external benchmark | **Test in play** |
| 2.3 | Floor 10 runs long | Our arithmetic | High | With a C +4 weapon, a normal takes 3.1 to 4.4 turns (average 3.6) against the target of 3. The 24-turn master becomes about 29. That is harder, not broken, but S3 decides which weapon the target assumed | **Test in play** |
| 2.4 | Seconds per round are uneven | Our arithmetic | High | Normal 6.7 s per round, elite 12 s, mini-boss 17 s, master 15 to 20 s. If a normal fight takes 30 s instead of 20 s and a tough one 60 s instead of 40 s, a floor 10 sweep rises from 56 to 73 minutes (+29%) | **Test in play** |
| 2.5 | Group fights are fair | Our arithmetic | High | A trio at ×0.6 deals about 1.2× the damage of three solo fights to a single-target climber, and area skills such as Cleave pay off | **Keep** |
| 2.6 | Master damage budget | Our arithmetic | High | Floor 10, no healing, 24 turns at ×1.2: Vanguard takes about 80% of its HP and Arcanist about 150%. The gap is covered by the 2-Draught rule. The doc already says to recheck once leaked rules exist | **Test in play** |

## 3. Crit, evasion, statuses, cooldowns

| # | Claim | Source | Confidence | Our number | Verdict |
| --- | --- | --- | --- | --- | --- |
| 3.1 | Crit design | Our arithmetic | High | Agility reaches about 27 in Arc 1, so crit tops out near 18.5%. The 50% cap needs Agility 90, so it is inactive in Arc 1. Crit is worth about +9% damage at most | **Keep** |
| 3.2 | Evasion is widely disliked as pure luck: competitive Pokémon players restrict it because it removes player choice | [Smogon discussion](https://www.smogon.com/forums/goto/post?id=4107143) (forum, excerpt) | Low | Base Evasion reaches only about 8% in Arc 1. The 40% cap is reached only by stacking Forms and gear, and Blood-Shadow Step alone is 40% | **Keep** the cap |
| 3.3 | Darkest Dungeon gives a stunned unit a temporary +50% stun resistance so turns are not skipped repeatedly. An official patch note raised this buff "to further help prevent successive stuns" | [DD fan wiki](https://darkestdungeon.fandom.com/wiki/Restoration), [official patch note](https://old.darkestdungeon.com/?p=327162) (excerpts) | Medium | Our "immune 1 turn" solves the same problem more simply. Stun skills are 20 to 35% on cooldowns of 3 to 5, so stun-lock is not possible | **Keep** |
| 3.4 | Percent-of-max-HP DoT grows with boss HP | Our arithmetic | High | Poison at half strength is 1.5% per turn. Poison Dart (cooldown 3, 3 turns) can stay up, so a 24-turn master loses about 36% of its HP from DoT alone. Trickster gains most, which suits a class meant to be weak early. The risk grows with later arcs' longer fights | **Test in play**, and decide a cap before Arc 2 |
| 3.5 | Enemy Mind | Our arithmetic | High | "Skill chance is reduced by 0.5% per target's Mind", but the enemy table has no Mind column | **Change** (fix 4) |
| 3.6 | Cooldown meaning and Arcanist charges | Our arithmetic | High | "Cooldown 1" is not defined. Read as "usable every turn", Spark does 120% per turn. Flame Lance gives 220% over 2 turns, 110% per turn. Chant then Spark gives 168% over 2 turns, 84% per turn. Chant only breaks even on a skill of 300% or more | **Change** (fix 7) |
| 3.7 | Skill levels and stages have no combat effect | `docs/04-systems.md` Skills, Hero power grade | High | Stage and level feed only the Hero score. Skill tables list one value ("values at Novice"), and the First class skills section promises a "higher ceiling when they move up a stage" that no rule delivers | **Change** (fix 1) |

## 4. Enhancement failure economy

| # | Claim | Source | Confidence | Our number | Verdict |
| --- | --- | --- | --- | --- | --- |
| 4.1 | MapleStory Star Force outcomes are success, keep, drop or destroy. Two failures in a row trigger Chance Time, a guaranteed success | [Nexon support](https://support-maplestory.nexon.com/hc/en-us/articles/204088639-How-do-I-enhance-equips-with-Star-Force) (excerpt; region and date not confirmed) | Medium | We never destroy, but we drop 2 levels and have no pity rule | **Keep** |
| 4.2 | Korean MapleStory, Mar 2025: failures at 15 stars or more no longer lose stars, and destruction at 21 stars or below was cut by 30% | [Orange Mushroom translation of KMS 1.2.401](https://orangemushroom.net/2025/03/20/kms-ver-1-2-401-maplestory-next-destiny-weapon-star-force-reorganization) (fan translation, excerpt) | Low to Medium | Evidence that the longest-running game of this type has been softening failure. A reason to watch ours, not to copy it | **Keep** |
| 4.3 | Lost Ark honing has Artisan's Energy. Official pages confirm the system exists; the fill-to-100%-guaranteed behaviour is described only by players and guides | [Official notes](https://www.playlostark.com/en-us/game/releases/arbiter-of-death), [Maxroll](https://maxroll.gg/lost-ark/resources/gear-honing-system) (excerpts) | Medium for existence, Low for behaviour | No pity. Ours has charms in its place, which remove the penalty rather than guarantee the win | **Keep** |
| 4.4 | Black Desert Cron Stones prevent level drops on failure, and the system remains in current patches | [Patch notes, Nov 6, 2025](https://www.naeu.playblackdesert.com/en-US/News/Detail?groupContentNo=9266), [Aug 13, 2026](https://www.naeu.playblackdesert.com/en-us/News/Detail?groupContentNo=10451&countryType=en-us) (official, excerpts) | Medium | Direct precedent for our protection charm | **Keep** |
| 4.5 | The Korea Fair Trade Commission fined Nexon 11.6 billion won (about $8.9 million) for changing MapleStory Cube odds without telling players | [Game Developer](https://gamedeveloper.com/business/maplestory-dev-nexon-fined-8-9-million-by-korean-regulator-for-misleading-players) (opened; KFTC's own release not found) | High for the fact | The issue was hidden odds and real money. We have no paid items, and `docs/06-ui.md` shows the chance and the failure result before every attempt | **Keep** |
| 4.6 | Players read odds emotionally: Sid Meier's GDC 2010 keynote reported that playtesters accepted wins at 3:1 odds but questioned wins at 1:3, so combat could not be purely mathematical | [Game Informer](https://gameinformer.com/b/news/archive/2010/03/12/sid-meier-gamers-arent-logical) (excerpt; talk not watched) | Low to Medium | A 70% roll that fails twice in a row will feel unfair even though it happens 9% of the time. Keep showing the rate | **Keep** |
| 4.7 | Spread of outcomes | Our Monte Carlo | High | One piece to +6 without charms: median 9 attempts, p90 15, p99 27. Materials: mean 635, p90 1,080, p99 1,890, so the unlucky 1% pay 3× the average. With charms from +4: p99 11 attempts and 810 materials. A pity rule is not needed at Arc 1's cap | **Keep** |
| 4.8 | Charms are decisive at +10 | Our Monte Carlo | High | +10 falls from 132.5 attempts to 16.5, which needs 13.4 charms per piece. Not an Arc 1 issue. Revisit with the Arc 5 charm supply | **Keep** for Arc 1 |
| 4.9 | Armor enhancement has no effect | `docs/04-systems.md` Combat formulas | High | "Each +1 enhancement adds 5% weapon attack" is the only combat effect. Five of six slots gain only 1 Hero score point per 2 levels | **Change** (fix 2) |
| S3 | A +6 weapon cannot exist in Arc 1 | `docs/04-systems.md` Equipment, Weapon mastery | High | +6 needs grade B or above. A B weapon needs Advanced proficiency. Arc 1 masters test only up to Intermediate, which allows D to C. So the Wall Defender's B weapon cannot be used in Arc 1, and the weapon caps at C +5. "Six pieces to +6" and the 44 attack value for B do not apply to it | **Change** (fix 3) |
| 4.10 | Late enhancement pays little | Our arithmetic | High | C weapon, +4 to +5: +1.6 Attack, about +1.7% damage at Lv 20. This is the weakest part of the reward curve and fixes 2 and 3 improve it without touching cost | **Keep** the costs |

**Retention evidence.** No first-party retention data on enhancement failure was found. The evidence is indirect: studios keep softening failure (4.1, 4.2), players complain loudly on [official forums](https://forums.playlostark.com/t/give-us-100-honing-success-chance/237508?page=2), and Korean regulators focus on undisclosed odds. Our rules are mild for this genre: no destruction, no drop before +4, and shown odds. The 2-level drop is fine.

## 5. Grind and pacing

| # | Claim | Source | Confidence | Our number | Verdict |
| --- | --- | --- | --- | --- | --- |
| 5.1 | Persona 5 Royal's main story averages about 103 to 106 hours (HowLongToBeat-based) | [How Long Is Persona 5 Royal, GGRecon](https://ggrecon.com/guides/how-long-is-persona-5-royal) (excerpt, secondary) | Low | 25 hours per arc would be about 125 for 50 floors, the same class of game | **Keep** |
| 5.2 | Linear level curves are said to feel grindy; this comes from a summary of Schreiber's material, not the original | [Summary](https://hanifnaoh-github-io.pages.dev/posts/game-balance) (secondary) | Low | Our per-level cost is linear, so total EXP is quadratic. Floor rewards also rise, and the budget table is arithmetically correct (19,000 to Lv 20) | **Keep** |
| 5.3 | 50 hours for six +6 pieces | Our arithmetic, doc's assumptions | Medium | About 2× the story and clearly optional, which fits the stance. It is sensitive to fight time (2.4), and it is partly unreachable (S3). About 65 sweeps means roughly 3,600 kills played by hand | **Keep** the target. **Test in play** the real hours |
| 5.4 | EXP inversion at the top of the arc | `docs/04-systems.md` Monster EXP | High | A floor 9 normal gives 16 EXP, floor 10 gives 6, so a sweep gives 3,008 against 1,176. The cause is the deliberate floor 10 cap budget. Players below the cap will farm floor 9 over the harder floor | **Test in play**, recheck with Arc 2 EXP |
| 5.5 | Style mark on floor 1 | Our arithmetic | High | Full Style needs 8 turns. A master with HP ×4 takes 10 to 16 turns at Lv 1, so full marks require a replay at a higher level. Fine, because replays are intended and the Keeper yields at low HP | **Keep** |

## 6. Skill count and design

| # | Claim | Source | Confidence | Our number | Verdict |
| --- | --- | --- | --- | --- | --- |
| 6.1 | A Persona holds up to eight skills | [Guides](https://screenrant.com/persona-5-royal-character-builds-ryuji-sakamoto-skull/) (excerpts, secondary) | Low | No slot limit. Pressure comes from tags, cooldowns and 6 pinned slots. A real difference, not a flaw, as long as choices stay real (3.6) | **Test in play** |
| 6.2 | In SMT, skills pass to a fused demon by inheritance, and sources conflict on whether the player picks or re-rolls | [Megami Tensei Wiki](https://megatenwiki.com/wiki/Skill_Inheritance) (excerpt) | Low | Ours is closer to discovery: hidden traits decide the odds. Different in kind, with no copying concern in the mechanic | **Keep** |
| 6.3 | Fusion odds across the real skill list | Our arithmetic, all 135 skills with trait columns | High | Random pairs: 53% share no traits, 35% one, 11% two, 2% three. Average result: 11.9% one stage higher, 31.6% scrap. Random trios: 14%, 35%, 35%, 16%. Average 24.6% higher, 20.3% scrap. Trios earn better odds even per ingredient (8.2% against 6.0%), which rewards experiment | **Keep**, confirm in play |
| 6.4 | 12 counted skills | Our arithmetic | High | Typical climber has about 10 usable by floor 10, so the limit does not bite in Arc 1 and only blocks hoarding, as intended | **Keep** |
| 6.5 | Monster Hunter comparison | none | Not researched | Omitted rather than stated from memory | none |

## 7. Story structure

Reader views below come from individual reviews and forums. They show recurring opinions, not consensus.

| # | Work | Readers praise | Readers criticise | Source | Confidence | What it means for us | Verdict |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 7.1 | Tower of God | Creative tests, an ambitious long structure | Questions pile up while answers stay scarce | [MangaUpdates reviews](https://www.mangaupdates.com/series/5z98aus/tower-of-god?page=8), [Reddit](https://lr.eu.psf.lt/r/TowerofGod/comments/1gzi50h/how_good_would_you_say_siu_is_in_writing_terms) (excerpts) | Low | Our Truth arc gives Arc 1 only "first signs", and major answers wait for Arcs 3 to 5. Arc 1 is also the first thing players get | **Change** (fix 9) |
| 7.2 | Solo Leveling | Clear power fantasy | Protagonist so strong there is little suspense; a repeating dungeon, clear, upgrade loop; thin supporting cast | [MAL review](https://myanimelist.net/reviews.php?id=360547), [MAL review](https://myanimelist.net/reviews.php?id=433145) (excerpts) | Low | We already avoid this: floor rules, a climber who can lose, floor masters with tragedies | **Keep** |
| 7.3 | The Beginning After the End | Balance of action and emotion | Slow pacing, overpowered lead, unremarkable plot | [FandomWire](https://fandomwire.com/blame-the-original-manhwa-for-the-beginning-after-the-ends-pacing-issue/), [ANN preview](https://www.animenewsnetwork.com/preview-guide/2026/spring/the-beginning-after-the-end-season-2/.234733) (excerpts) | Low | Same warning as 7.2. Each floor being self-contained protects pacing | **Keep** |
| 7.4 | Omniscient Reader | The reader-protagonist premise (reviews were not opened) | Not verified | [Soompi terms guide](https://www.soompi.com/article/1753585wpp/4-essential-terms-to-know-before-watching-omniscient-reader) (opened) | Medium for the setting | See originality flags | **Change** (fix 8) |

A blank protagonist is our biggest structural difference. These stories are carried by specific leads, and our climber has only a shared motive. Named floor masters and NPCs must carry the emotion. Test this with readers of the Arc 1 script.

### Originality flags

Copyright does not protect a game's idea, title or method of play ([US Copyright Office, games guidance](https://www.copyright.gov/register/tx-games.html), excerpt), but it does protect specific expression. The flags below are about originality, which is the owner's goal. This is not legal advice.

| Flag | Our design | Existing work | Severity | Action |
| --- | --- | --- | --- | --- |
| Watchers | Superior beings who watch climbers "like a livestream", tip coins and give quests with a cost; five named patrons with favor | Omniscient Reader: Constellations watch the scenarios from beyond Earth and act as Sponsors giving equipment, resources and skills; dokkaebi deliver the scenarios ([Soompi](https://www.soompi.com/article/1753585wpp/4-essential-terms-to-know-before-watching-omniscient-reader)). Coins are its main currency, and fan sources describe the dokkaebi as livestreaming | **High: closest match in the design** | **Change** (fix 8). The mechanic can stay; the framing and words should move |
| Tower premise | Climb a tower of separate floors, each with tests and its own society, toward a mystery at the top | Tower of God: floors with their own cultures, tests, Guardians, and Rankers who reach the top ([Wikipedia](https://en.wikipedia.org/wiki/Tower_of_God), opened) | Medium, genre-level | **Keep**. "Each floor is a dying world taken in as a lifeboat" and "floor masters are last survivors" were not found in Tower of God sources and are the real distinction |
| Title | "Tower of Esther" | "Tower of God" has the same word pattern | Low to Medium | **Keep**, but note it for the marketing page. Titles are not copyright-protected; a trademark check is separate |
| "The Empty Throne" | Name of the seat at the top | Novels with this title exist ([listing](https://authorwars.com/publications/the-empty-throne-39170.html)) | Low | **Keep**. A common phrase, not a plot match |
| Esther and Ezra | Creator and Tower Master | One search found no tower-climbing work with these names | Low | **Keep** |
| "The Retired Heavenly Demon" | Fierce master on floor 4 | "Heavenly Demon" is a murim genre term; a title search for this exact phrase returned nothing usable | Low | **Keep**, recheck when naming is final |

## 8. Tools for balance simulation

| # | Claim | Source | Confidence | Fit | Verdict |
| --- | --- | --- | --- | --- | --- |
| 8.1 | Node runs TypeScript directly by stripping types. Stable since v24.12.0 and v25.2.0. It ignores `tsconfig.json` and rejects `enum`, parameter properties and runtime namespaces | [Node docs](https://nodejs.org/api/typescript.html) (opened) | High | No build step or new dependency. Write the combat core with unions and plain objects | **Recommended** |
| 8.2 | `resolveJsonModule` lets TypeScript import JSON and type-checks use against its shape | [TS docs](https://www.typescriptlang.org/tsconfig/resolveJsonModule.html) (opened) | High | The sim and the game read the same `data/` files | **Recommended** |
| 8.3 | Machinations runs batch simulations on charged "Events", and has a free Public plan with limits not confirmed | [Pricing](https://machinations.io/pricing) (vendor, excerpt) | Medium | Good for resource flows, but it would be a second copy of the rules outside the repo | **Do not use** |
| 8.4 | Spreadsheet | Our judgement | Medium | Fine for one-off tables. It cannot run turn-by-turn fights with cooldowns and statuses, and it is another copy of the data | Only for quick tables |
| 8.5 | Vitest integrates with Vite | Known from project stack; docs page could not be opened | Low | Useful once tests exist. Not needed for the sim itself | Later |

**Recommendation, the smallest suitable option:** one TypeScript script, for example `tools/sim.ts`, run with `node`. It imports the same pure combat functions the game uses and the JSON under `data/`, takes a seeded random generator, and prints win rate and turns per class, floor and tier over about 10,000 runs per case. No UI, no new service, no Supabase. The same pure core can later support server replay of top clears, which `docs/00-overview.md` already anticipates. The doc's earlier throwaway simulator is not in the repo, so its results cannot be rerun.

---

## Prioritised fixes

Only real defects. None of these lowers a cost or weakens an enemy. Fixes 1 and 2 add player power, so the same step must rerun the simulator and raise enemy HP to hold the turn targets.

| # | Problem | Current | Proposed | Owning doc |
| --- | --- | --- | --- | --- |
| 1 | Skill level and stage do nothing in combat | No effect; values are "at Novice" | Skill % and effect values × (1 + 1% × (Lv − 1)) × (1 + 10% × stages above Novice). Then raise the HP column to keep the turn targets | 04 Skills |
| 2 | Armor enhancement is undefined | Only "adds 5% weapon attack" | Add: each +1 adds 5% of that piece's Guard and Ward. Five C pieces at +4 give about +11 Guard | 04 Combat formulas |
| 3 | +6 weapon and B weapon unreachable in Arc 1 | Intermediate: D–C; Advanced: B–A | Intermediate: D–B; Advanced: A. **Phat's choice:** the alternative keeps the lock, makes the floor 10 weapon piece grade C, and restates the goal as five pieces at +6 and a weapon at +5 | 04 Weapon mastery |
| 4 | Enemies have no Mind | No column; status chance formula needs one | Add enemy Mind = 2 × floor number (2 to 20), and state that 0.5% per Mind is percentage points off the chance | 04 Combat formulas, Statuses |
| 5 | No rounding rule | Undefined | Round damage to the nearest integer, minimum 1 on any hit that lands | 04 Combat formulas |
| 6 | "Precision" refers to a roll that does not exist | No damage roll | Add a roll of ×0.9 to ×1.1 (average unchanged); Precision raises the low end to ×1.0 | 04 Combat formulas, Branches |
| 7 | Cooldown undefined; Flame Lance and Chant are never the best damage choice | "Cooldown 1" undefined; Flame Lance 220%; Chant +40% | Define: cooldown N means usable again after N turns, so 1 is every turn. Flame Lance 250%. Chant +110% | 04 Skills, skill values |
| 8 | Watcher framing is too close to Omniscient Reader | "watch climbers like a livestream"; "tip coins"; "Watcher coins" | Keep the mechanic. Reword as an audience at the Great Games, which floor 9 already sets up. "Watcher coins" becomes "Tithes", "tip" becomes "offering", and remove "livestream" from 01 Lore | 01 Lore, 04 Watchers |
| 9 | Arc 1 gives only signs, no answers | Arc 1 row of the Truth arc is all hints | Add one real answer by floor 10: that every floor is a world the Tower took in before it vanished. Keep the memory cost for Arc 3 | 01 Lore |
| 10 | Bow trial can be close to impossible | "Win without being hit in the first 3 turns": 0.01% to 16% depending on the elite's attack weighting | "first 2 turns" (about 11% at 70% attack weight and 5% Evasion). Mace "Stun twice" at about 5 to 8% per try: Test in play | 04 Weapon trials |

## Fine as it is

Damage formula; Def and Guard curve; trio attack scaling; crit values and 50% cap; 40% Evasion cap; stun plus immunity; the enhancement rates; the 2-level drop; charms; no destruction; shown odds; 25-hour story and 50-hour goal as targets; EXP formula; no slot limit with tags; 12 counted skills; hidden-trait fusion and its odds; defeat tied to lost memories; self-contained floor tragedies.

## Watch in the first playable build

Real seconds per round and hours per sweep (2.4, 5.3); floor 10 fight length (2.3); master damage budget (2.6); DoT share of boss HP (3.4); whether players use a wide set of skills or settle on a few (6.1); floor 9 against floor 10 farming (5.4).

## Could not verify

- Riot's own statement of the armor formula. The figure is from the community wiki.
- Pokémon's critical multiplier, poison fractions and EXP group formulas. Those pages were blocked, so no comparison is made.
- Current official Star Force rates. Nexon's public material found gave outcomes, not a rate table.
- Lost Ark's "guaranteed at 100%" rule from an official page, and exact Black Desert rates.
- KFTC's own press release. The fine is from trade press.
- The content of the Slay the Spire and Sid Meier GDC talks. Only listings and write-ups were seen.
- Any published turn-count benchmark for turn-based RPG fights.
- Retention data tied to enhancement failure.
- Reader praise of Omniscient Reader, and whether "sudden quest" is used there.
- Second Life Ranker, SSS-Class Revival Hunter and I'm the Max-Level Newbie, which are listed inspirations but were not compared.
- Monster Hunter and exact Honkai: Star Rail figures.
