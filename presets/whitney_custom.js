// Preset: Whitney scenario with a custom player (Scenario 2). Applied right after the config.
// You are not Rue: you get the default sheet (set it with :set height 170, :set weight 60 ... or :sheet), and an unnamed
// "You order ..." in the AI's reply, or anything you do unnamed, goes to that player sheet. No player seed, no YOU_NAME.
CFG.SILLY = true         // game pace: PACE 6, more forgiving fat gain, lazy meals (see the config). :pace n still overrides
CFG.HIDE_PLAYER = false  // you are tracked too
CFG.PLACEHOLDERS = true  // the character-creation answers (state.placeholders) set up your sheet on the first turn
CFG.PLAYER_CARD = true   // a "Player setup" story card: fill in name= height= weight= ... to set up your own sheet
CFG.PROBE = true        // :probe writes a story card showing what the hooks receive (info, state keys, history). Delete the card when done
CFG.CHARACTERS = [
  { name: 'Whitney', pattern: 'pear', look: 'curvy', bonus: { cha: 2 },   // proud and charismatic
    start: { height: 196, weight: 105, bodyfat: 34, underbust: 96, bust: 116, waist: 100, hips: 128, arm: 36, thigh: 75, gland: 150, potential: 225 } }
]
