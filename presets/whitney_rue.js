// Preset: Whitney scenario. Applied right after the config, so it overrides the defaults.
CFG.SILLY = true         // game pace: PACE 6, more forgiving fat gain, lazy meals (see the config). :pace n still overrides
CFG.HIDE_PLAYER = false  // you (Rue) are tracked too; unnamed commands and tags go to your sheet
CFG.YOU_NAME = 'Rue'     // "you" in the AI's narration means Rue
CFG.PLAYER = {           // your own sheet, seeded once on the first turn
  name: 'Rue', pattern: 'even', look: 'athletic', set: { dex: 13 },
  start: { height: 168, weight: 54, bodyfat: 18, underbust: 72, bust: 87, waist: 60, hips: 88, arm: 24, thigh: 49, gland: 90, potential: 200 }
}
CFG.CHARACTERS = [
  { name: 'Whitney', pattern: 'pear', look: 'curvy', bonus: { cha: 2 },   // proud and charismatic
    start: { height: 196, weight: 105, bodyfat: 34, underbust: 96, bust: 116, waist: 100, hips: 128, arm: 36, thigh: 75, gland: 150, potential: 225 } }
]
