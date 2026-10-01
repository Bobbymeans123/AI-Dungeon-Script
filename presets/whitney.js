// Preset: Whitney scenario. Applied right after the config, so it overrides the defaults.
CFG.HIDE_PLAYER = true   // you are not tracked, only the characters below (unnamed commands and tags go to the first one)
CFG.LAZY = true          // flat meal amounts with size words (see the config)
CFG.CHARACTERS = [
  { name: 'Whitney', pattern: 'pear', look: 'curvy', bonus: { cha: 2 },   // proud and charismatic
    start: { height: 196, weight: 105, bodyfat: 34, underbust: 96, bust: 116, waist: 100, hips: 128, arm: 36, thigh: 75, gland: 150, potential: 225 } }
]
