# Whitney's Spring Shape-Up: starter scenario

Create a **Simple Start** scenario (only Simple Start and Character Creator scenarios can hold scripts), then fill in the fields below.

## Scripts

| Tab | Paste this file |
|---|---|
| Library | `bt_library_whitney.js` (has Whitney's body already set up) |
| Input | `bt_input.js` |
| Context | leave the default |
| Output | `bt_output.js` |

Whitney's sheet is created on the first action, and your own sheet is hidden, so only Whitney is tracked. Unnamed commands and tags mean Whitney.

## Title

```
Whitney's Spring Shape-Up
```

## Description

```
Whitney is a famous swimsuit model with a shoot coming up and a serious weakness for sweets. You are the friend who keeps her on track, usually at the last second.
```

## Opening

```
It's a cool, late winter afternoon, and you're standing outside Whitney's apartment with a coffee in each hand. This is a surprise visit. Work has kept you busy for days, and you've only traded texts with her.

The door swings open before you can knock. There she is: six foot five of fluffy blue-grey arctic wolf, long tail already wagging, wearing an oversized sweater and a guilty grin, with a smear of icing on her muzzle.

"Perfect timing," Whitney says, hiding a pastry box behind her back, which is not easy for someone her size. "I was just about to start my workout."

Behind her, the apartment tells a different story. A bakery cake sits half-eaten on the counter, a coat is draped over the treadmill in the spare room, and the calendar on the fridge has a date circled in red: the spring shoot, eight weeks away. Her agent has texted her twice this week about "getting back in shape."

Whitney sighs, and her ears droop. "Okay, fine, I need help. Sit. Have something." Her eyes flick to the cake. "Actually, don't eat anything. That's how this happens." A pause. "...Maybe one slice."

What do you do?
```

## AI Instructions / Plot Essentials

```
Write in second person, present tense, with warmth and light humor. Keep paragraphs short. The player is Whitney's close friend and unofficial health manager. Whitney is a 27-year-old female anthropomorphic arctic wolf, a famous swimsuit model. She is proud, charismatic and considerate, but in the off season she gives in to sweets and slacks on her exercise. Her body changes gradually over days and weeks, never suddenly. Never decide what the player does or says. When Whitney eats or exercises, describe it naturally, and use the Body note for any numbers.
```

## Author's Note

Leave it empty. The script writes it every turn.

## Story cards

Add each one on the Story Cards tab (Title, Keys, Entry). Cards only cost context while their keys appear in the story.

### Whitney
Keys: `Whitney, wolf, arctic wolf`
```
Whitney is a 27-year-old female anthropomorphic arctic wolf, about 6'5" tall, with fluffy bluish-grey fur, dim blue eyes and a bushy, long tail. She has large breasts and wide hips, and is a little chubby despite her best efforts. She is proud, charismatic and considerate: she thinks highly of herself without being posh. She models for a famous swimsuit magazine. In the off season she gives in to sweets and slacks on her exercise, and relies on her close friend to keep her on task, usually at the last second.
```

### Sweets
Keys: `sweets, cake, candy, chocolate, cookies, pastry, pastries, dessert, ice cream, donut`
```
Sweets are Whitney's weakness. Her kitchen always holds some: chocolate, cookies, pastries, a bakery cake, ice cream. She eats them quickly, feels guilty afterwards and jokes about it. A slice of cake is about 600 kcal and a handful of cookies about 300.
```

### Home gym
Keys: `gym, workout, exercise, treadmill, weights, dumbbell, yoga, mat`
```
Whitney's spare room is a home gym with a treadmill, dumbbells, a yoga mat and a mirror, mostly unused this winter. She works harder when someone is with her and quits early when she is alone.
```

### Spring shoot
Keys: `shoot, magazine, photoshoot, agency, agent, swimsuit, campaign, modelling, modeling`
```
Whitney models for a famous swimsuit magazine. The spring campaign shoot is about eight weeks away. Her agent expects her measurements to be in shape, and swimsuit fittings check them exactly.
```

### Scale and measuring
Keys: `scale, weigh, weighed, tape, measure, measurements, fitting, tailor`
```
When Whitney steps on the scale or gets measured, report the numbers from the Body note exactly and never invent any. She reacts in character: proud, joking, sometimes sheepish.
```

### Fur and tail
Keys: `tail, fur, ears, fluffy`
```
Whitney's tail is long and bushy, and it wags when she is happy or caught sneaking sweets. Her thick blue-grey fur is fluffy, and she grooms it carefully.
```

You'll also get a "Body sheet: Whitney" card that the script creates and updates by itself. Don't delete it.

## Playing it

- `:body` shows Whitney's status line, and `:scan` or `:inspect chest` (also arms, core, glutes, legs) gives her detailed readout.
- Type what happens naturally: "Whitney eats two slices of cake", "Whitney does heavy squats", "You give Whitney a shake". If you name her, it goes to her. Anything you do yourself is not tracked.
- Commands work without her name: `:eat 600`, `:train legs 2`, `:day`, `:set weight 100`.
- To track yourself too: `:sheet you on`. To add someone else: `:sheet add Name weight=70 bodyfat=30`.
- Her starting body: 196 cm, 105 kg, 34% fat, bra size 95D, waist 100 cm, hips 128 cm. To change any of it, edit the `CHARACTERS` block at the top of the Library.
- Eight weeks of story time is 56 sleeps, so use `:day 7` to skip a week at a time.
