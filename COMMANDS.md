# Body tracker: commands and detection

Everything here comes from the code (`src/11_commands.js` and the `:help` text), and every example below is run by the test harness (`node bt_test.js`), which also fails if the parser handles a command this file does not mention. Examples were checked on the custom build, where you are a default player (165 cm, 60 kg) next to Whitney. In the Rue build you are Rue, so numbers differ but the commands are the same.

## Quick start

1. **Paste the files** into AI Dungeon (full table in [PASTE.md](PASTE.md)):
   - Library tab: `bt_library_whitney.js` (you are Rue) or `bt_library_whitney_custom.js` (you are a custom player)
   - Input tab: `bt_input.js`
   - Output tab: `bt_output.js`
2. Type `:help` as an action. The reply gets the list of commands.
3. Type `:body`. The reply gets a status line with your sheet: day, height, weight, body fat, bra, stats, kcal eaten today.

## How commands work

- Type a command in any action (Do, Say, Story). Case does not matter.
- The command text is replaced by a short in-story line (for example "You eat a meal.") so the AI still has something to answer. Anything else you wrote around the command stays.
- **Who it applies to:** a tracked name anywhere in the action targets that character (`:eat 600 Whitney`). With no name it applies to your own sheet.
- The reply gets a status line showing the sheet and what changed.
- Anything in `[brackets]` below is optional.

---

## Eating and exercise

### `:eat kcal`
Adds exactly that many kcal to today's intake (at most 5000 per command). Not changed by lazy mode or size words.
```text
:eat 600
```
Reply status: `Ate 600 kcal`.

### `:undo meal [Name]`
Takes back the last meal the script counted by itself (from your typed text, or from the AI's reply). With a name: only that person's. With no name: the most recent one, and a shared meal is taken back from everyone in it. Works once per meal. It never touches `:eat` or `[ate N]` tags.
```text
:undo meal Whitney
```
Reply status: `Removed Whitney: a burger (700 kcal)`. If there is nothing to remove: `No auto-counted meal to remove`.

### `:burn kcal`
Adds extra kcal burned today (at most 3000).
```text
:burn 300
```
Reply status: `Burned 300 extra kcal`.

### `:train area [1-3]`
Trains one area for today: `chest`, `arms`, `core`, `glutes` or `legs`. The number is the effort (1 light, 2 normal, 3 hard; default 2). Training makes muscle grow when the day ends, more when you eat a surplus.
```text
:train legs 2
```
Reply status: `Trained legs (effort 2)`.

---

## Body and stats

### `:set stat value`
Sets a value directly. Stats: `height weight bodyfat underbust bust waist hips arm thigh str dex con int wis cha gland sag potential`. Values are kept inside sane limits. An unknown stat answers `Unknown stat "x"`.
```text
:set weight 70
```
Reply status: `Weight 60 to 70 kg`.

### `:gland +/-cc`
Changes glandular tissue (cc per breast).
```text
:gland +20
```
Reply status: `Glandular tissue 90 to 110 cc each`.

### `:potential +/-cc`
Changes the ceiling glandular tissue can grow to.
```text
:potential +50
```
Reply status: `Glandular potential 150 to 200 cc each`.

### `:lactate on|off`
Turns lactation on or off.
```text
:lactate on
```
Reply status: `Lactation on`.

### `:milk ml`
Drains up to that many ml of stored milk (at most 3000). Asking counts as demand even if little is stored.
```text
:milk 300
```
Reply status: `Drained 0 ml` (the number is what was actually stored).

### `:mana +/-n [area]`
Infuses (`+`) or spends (`-`) mana, optionally in one area. Infusing past capacity is wasted.
```text
:mana +30 arms
```
Reply status: `Mana +N arms` (with the amount that fitted).

### `:curse add|remove hunger|leech|forced|bias [area]`
Adds or lifts a curse. `hunger` raises your energy need by 25%, `leech` refills one area's mana, `forced` forces milk production, `bias` pushes new fat toward one area.
```text
:curse add hunger
```
Reply status: `Cursed: hunger`.

### `:support on|off`
Turns a supportive bra on or off (on halves how fast sag builds up).
```text
:support off
```
Reply status: `Support off`.

### `:look curvy|athletic|soft|off`
Sets which look Charisma rewards.
```text
:look athletic
```
Reply status: `Look: athletic`.

### `:pace n`
Sets the growth pace, 0.5 to 10. Under the silly preset the default is 6; `:pace` overrides it for that sheet and stays.
```text
:pace 2
```
Reply status: `Growth pace 2`.

---

## Sheets and characters

### `:sheet add Name [key=value ...]`
Creates a sheet for another character. The name starts with a letter. Options (all optional, no spaces inside a value):

| Option | Meaning |
|---|---|
| `height weight bodyfat underbust bust waist hips arm thigh gland potential` | starting body (cm, kg, %, cc each) |
| `pattern=pear\|apple\|even` | where new fat lands |
| `look=curvy\|athletic\|soft\|off` | what Charisma rewards |
| `muscle=0.5-1.5` | starting muscle multiplier (1 = the usual; 1.2 = a bit more muscular) |
| `activity=1.0-2.0` | daily activity factor for this sheet (default 1.35; 1.2 = sedentary, 1.5 = runner) |

Bad or out-of-range options are ignored. Everything not given keeps the default.
```text
:sheet add Rue height=168 weight=54 bodyfat=18 pattern=even look=athletic
```
Reply status: `Added a sheet for Rue (height 168, weight 54, bodyfat 18)`.

```text
:sheet add Bo muscle=1.2 activity=1.5
```
Reply status: `Added a sheet for Bo`.

### `:sheet remove Name`
Removes a character's sheet.
```text
:sheet remove Rue
```
Reply status: `Removed the sheet for Rue`.

### `:sheet list`
Lists the sheets.
```text
:sheet list
```
Reply status: `Sheets: You, Whitney` (your own sheet is listed as "You").

### `:sheet you on|off`
Shows or hides your own sheet. When it is hidden, what you do unnamed is not tracked and unnamed commands go to the first character.
```text
:sheet you off
```
Reply status: `Your own sheet is hidden`.

---

## Time

### `:day [n]`
Ends the day, for everyone (1 to 30 days; extra days pass at maintenance). The body changes from what was eaten, burned and trained that day.
```text
:day
```
Reply status: `Day 1: nothing logged, assumed maintenance` (or `Day 1: ate 3,000, needed 2,xxx (+xxx kcal)` after eating).

Sleeping in your text also ends the day (see "Sleep" below).

---

## Inspect and info

### `:inspect [part]` and `:scan [part]`
Gives the AI the exact facts about one body part so it can describe it in detail. Parts: `chest` (also `bust`, `breast`, `breasts`), `arms`, `core` (also `waist`, `stomach`, `belly`, `abs`), `glutes` (also `hips`), `legs` (also `thighs`), or `body` / nothing for a full inspection. `:scan` does the same. The details are added after the reply.
```text
:inspect chest
```
Reply: status `Inspecting chest`, then a block starting `Chest inspection:`.

```text
:scan
```
Reply: status `Inspecting all`, then a block starting `Full inspection:`.

### `:body`
Shows the status line for a sheet and changes nothing.
```text
:body
```
Reply: a status line starting `[Day 1 | 165 cm, 60 kg ...` (with a name, `[Whitney | Day 1 | ...`).

### `:help`
Appends the command list to the status line.
```text
:help
```
Reply: ends with `Commands: :set stat value, :eat kcal, ...`.

---

## Setup and debug

### `:reset confirm`
Resets your own sheet (not other characters) to the starting one. The word `confirm` is required.
```text
:reset confirm
```
Reply status: `Tracker reset`.

### `:probe` (custom build only)
Writes a story card with the keys `probe` that shows what AI Dungeon passes to the scripts: `info`, the names of the `state` keys, the full `state.placeholders`, `history[0]` and the last two history entries, and the other story cards. It changes no sheet. Read it in the adventure's story cards, then delete it (its key word is "probe").
```text
:probe
```
Reply status: `Probe card written (story card "probe")`. In the Rue build the text `:probe` is left alone.

### The Player setup card (custom build only)
On the first turn the script creates a story card of type **Player setup** with the keys `playersetup` (never in the story, so it costs no context) and this one line:
```text
name= height= weight= bodyfat= underbust= bust= waist= hips= pattern=even look=athletic gland= potential=
```
Edit the line in the story card list to set up your own sheet. Blank means keep the default. The rules:
- It is applied when the text changed, once per edit. Unchanged, it is never applied again, and later `:set` changes are not overwritten.
- While nothing has happened to your sheet yet it is rebuilt like `:sheet add`; later it works like `:set`.
- A bad part is skipped and named: `Player setup skipped: weight=abc`. That covers an unknown key, a non-number, a value out of range, and a part without `=`.
- `name=` is one word and cannot be a tracked character such as Whitney (`Player setup skipped: name=Whitney`).
- Success says `Player setup applied: height, weight` (or `12 values`).
- If you delete the card it is not made again.

```text
name=Zed height=170 weight=60 bodyfat=22
```
Reply status: `Player setup applied: height, weight, bodyfat, name`.

### Placeholder questions (custom scenario)
If the scenario asks these questions when you create your character, the answers set up your sheet on the first turn. This happens once, only while nothing has happened to your sheet, and never overwrites later changes. Wording is matched ignoring case and extra spaces. Missing, empty or unreadable answers keep the default.

| Question | What it sets |
|---|---|
| `character.name` or `Your name?` | your name (one word; not a tracked character). Order: `character.name`, then `Your name?`, then the `name=` on the Player setup card |
| `character.gender` | remembered only, no stat changes |
| `Height in cm?` | height. Accepts `170`, `170cm`, `1.70 m`, `5'7`, `5 ft 7 in`, `67 in` (kept between 120 and 230 cm) |
| `Weight in kg?` | weight. Accepts `60`, `60 kg`, `130 lb`, `9 st 7` (kept between 30 and 250 kg) |
| `Build? slim, average, curvy or athletic` | slim: 18% fat, even, athletic. average: 24%, even, look off. curvy: 32%, pear, curvy. athletic: 16%, even, athletic |
| `Activity? couch, active or runner` | couch: activity 1.2 and less muscle. active: the default. runner: activity 1.5 and a bit more muscle |
| `Chest? small, average or large` | glandular tissue and potential: small 60 / 150, average 90 / 200, large 130 / 300 cc |

Typos are forgiven (`curvey`, `runer`, `larg`), and a few synonyms work (skinny, thin, fit, toned, medium, normal, big, huge, tiny, flat, sedentary, lazy). The status line then says, for example, `Player sheet set from your answers: 170 cm, 60 kg, curvy, runner.`

---

## What is detected without commands

The script also reads what you type and what the AI writes. Both builds have the silly preset, so lazy mode is on (see "Lazy mode").

### From your typed text
- **Eating:** an eating verb plus a food, with quantities (`two`, `3`, `a couple`, `half`, `whole`), meal words (`breakfast`, `dinner`, `snack`, `dessert`) and typo tolerance. "You eat" with no food named counts as a plain meal.
- **Exercise:** exercise words for an area (squats, lunges, curls, push-ups, planks...) or general words (workout, gym, lift, run, treadmill). Effort words set the amount: hard, heavy, intense, brutal give a big workout; light, easy, gentle, quick a small one; otherwise normal. Burn is 150, 300 or 450 kcal, and the matching area is trained.
- **Sleep:** sleep words and phrases (`go to bed`, `lights out`, `call it a night`, `the next morning`, `overnight`) end the day for everyone. Naps and "can't sleep" do not count, and it cannot trigger twice within 4 actions.
- **Inspect:** `examine your chest`, `check your waist`, `step into the scanner`.
- **Who it goes to:** a tracked name in the text (`Whitney eats cake`), or your own name, goes to that character. With no name it goes to your sheet. `Share`, `split`, `together`, `both`, `with Whitney` or `Whitney and I` go to both people. `We`/`us` with no names goes to everyone tracked: `We share fries.` gives each tracked person a share of a 300 snack (150 each).

### From the AI's replies
- **Hidden tags:** `[ate 600]`, `[burn 300]`, `[train legs 2]`, `[day]`, `[gland +20]`, `[milk -300]`, `[mana +30 arms]`, `[curse add hunger]`, `[lactating on]` and stat tags like `[str +1]`. They are removed from the visible text and applied silently: no status line appears for tags alone, so use `:body` to see the result. For someone else put the name last (`[ate 300 Whitney]`) or first (`[Whitney: ate 300]`); with no name the tag goes to your sheet. If the AI repeats the tag reminder, it is stripped before anything is read.
- **Narrated meals** (when the AI writes no tag): only the *start* of a meal counts: arrives, orders, grabs, digs into, eats, shares, drinks, sips. Continuation wording does not: another bite, chews, savors, finishes, the rest, looks at, wants. A meal goes to a character only when the sentence names them (or says "you", which means you when your sheet is shown); "she" or "they" with no name counts nothing. Several sentences about one meal in a reply count once, and the same food for the same person is not counted again for 3 actions. The status line says what was counted: `Counted: Whitney ate a burger (~700 kcal). Type :undo meal to remove.`
- **Not read from AI replies:** exercise. Only meals and tags.
- **Nothing is counted twice:** whichever counts first this turn for a person (your typed text, a command, an AI tag) wins; later ones of the same kind are dropped. Retry and undo restore the tracker, so they never double count.

### Lazy mode (on in both builds)
Meals are flat amounts instead of a per-food table:

| Kind | kcal | Examples |
|---|---|---|
| meal | 700 | burger, pizza, sandwich, burrito, salad, steak, ribs, chicken, hot dog, wings, pasta, rice, soup, "a meal", breakfast, dinner |
| snack | 300 | fries, chips, nachos, popcorn, pretzel, bread, toast, egg, fruit, cheese, nuts |
| sweet | 400 | cake, cupcake, cookie, brownie, pancake, waffle, ice cream, sundae, donut, pie, candy, chocolate, cotton candy, churro, s'mores, "dessert" |

A snack next to a meal or sweet is part of it (steak and fries is one 700 meal). `:eat` stays exact, and a typed meal such as "a burger and a sundae" counts a meal plus a sweet (1,100).

### Size words
Within 4 words before the food: **massive, huge, giant, double, mountain** make it x1.5; **small, little, tiny, half** make it x0.5. "Just a taste / nibble / bite / sip" is x0.5. The biggest word wins, a number multiplies it (`two massive burgers`), and the total is capped at x2. A massive double burger is 1,050; a small scoop of ice cream is 200; half a sundae is 200.

### Drinks and containers
Drinks keep real kcal, in lazy mode too. A container right next to the drink sets the amount:

| Container | kcal |
|---|---|
| can | 150 |
| glass, cup | 200 |
| bottle | 210 |
| jug, 1 L | 420 |
| 2-liter | 840 |
| 64 oz, big gulp | 800 |

It applies to soda, cola, lemonade, juice, milk, sweet tea and energy drinks (`a can of soda`, `a 2-liter of soda`). Without a container: soda 140, juice or milk 150. Size words scale it too, within the x2 cap.

### Zero-kcal gag drinks
**Diet soda, diet coke, coke zero, zero sugar, sugar-free soda, club soda and sparkling water** count 0 kcal, never as plain soda, and add a light line to the status line: `Whitney sipped a diet soda (0 kcal, very virtuous)`. Plain water, tea and coffee also count 0 but say nothing. Look-alikes (baking soda, pie chart, cookie-cutter, candy-colored) and typos like "stake" or "steal" count nothing.

### Sharing
In lazy mode, a meal shared between people is divided: "Rue and Whitney share cake" gives a 400 sweet as 200 each. "Each" keeps the full amount for everyone ("Whitney and I each eat a burger"). In normal (non-lazy) mode each sharer gets the full serving.

## Troubleshooting
- Nothing seems to happen: check the status line. It appears after commands and after detected actions only.
- A meal was counted wrongly: `:undo meal` (or `:undo meal Name`).
- Wrong number of kcal today: `:eat` adds, there is no subtract; use `:undo meal` for auto-counted meals, or `:reset confirm` for your own sheet.
