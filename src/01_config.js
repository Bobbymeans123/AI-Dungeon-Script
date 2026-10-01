// ---------- CONFIG: change these freely ----------
const CFG = {
  PACE: 3,               // muscle growth speed. 1 = realistic, 3 = fast (game pace)
  PATTERN: 'pear',       // where new fat lands at the start: pear | apple | even
  LOOK: 'curvy',         // what Charisma rewards: curvy | athletic | soft | off  (change in game with :look)
  SUPPORT: true,         // supportive bra halves sag build-up (change in game with :support on/off)
  ACTIVITY: 1.35,        // 1.2 sedentary, 1.35 light, 1.55 active
  KCAL_PER_KG: 7700,     // energy in 1 kg of body tissue
  FAT_GAIN: 0.75,        // share of a surplus that becomes fat (the rest is lean tissue)
  FAT_LOSS: 0.8,         // share of a deficit that comes from fat
  TAG_PLACE: 'note',     // where the hidden-tag reminder goes: 'note' (Author's Note, default, least likely to be echoed) | 'front' (last line of the context, strongest)
  TAG_HELP: true,        // tell the AI about the hidden tags at the end of the context (turn off to save tokens)
  DESCRIBE: true,        // add a 'Look:' line with shape and size adjectives to the AI's note (edit the words in LOOK_WORDS below)
  FUZZY: true,           // forgive typos and odd wording when spotting actions in what you type
  NPC_MAX: 2,            // other tracked characters go into the AI's note only while their name is in the recent story, at most this many
  HIDE_PLAYER: false,   // true = you are not tracked, only the characters below (unnamed commands and tags then go to the first one)
  CHARACTERS: [],       // characters that exist from the first turn: { name, start: { weight: 70, ... }, pattern, look, bonus: { cha: 2 } } (see presets/)
  SILLY: false,          // game-pace preset: PACE 6 (SILLY_PACE), FAT_GAIN 0.9 (SILLY_FAT_GAIN), lazy meals, and fat gain/loss is scaled by the pace so a few days show. :pace n still overrides the pace. Off = everything back to the normal values
  SILLY_PACE: 6,
  SILLY_FAT_GAIN: 0.9,   // share of a surplus that becomes fat under SILLY (more forgiving: less of it is lean)
  PLAYER: null,          // seeds YOUR sheet once, on the first turn: { name, start: { ... }, pattern, look, bonus: {}, set: { dex: 12 } }. HIDE_PLAYER must be false to see it
  PLAYER_CARD: false,    // true = a "Player setup" story card (name= height= weight= ...) fills in your own sheet when you edit it. Only the custom preset turns it on
  PROBE: false,         // true = the :probe command exists (writes a story card describing what the hooks receive). Only the custom preset turns it on
  LAZY: false,          // true = typed and narrated meals use flat amounts: meal 700, snack 300, sweet 400 kcal, scaled by size words (massive x1.5, small x0.5). :eat stays exact
  YOU_NAME: '',          // who "you" means in the AI's narration when your own sheet is hidden, e.g. 'Rue'. Empty = "you" is not attributed
  AUTO: true,           // also spot eating, exercise and sleeping in what YOU type, so tracking works even if the AI never writes tags
  STATUS: 'commands',    // add a status line to the reply: 'off' | 'commands' (commands and spotted actions) | 'always'
  CARD_READBACK: false,  // read hand edits of the Body sheet story card back into the tracker
  // starting body (measurements in cm, weight in kg, gland = glandular tissue in cc per breast)
  START: { height: 165, weight: 60, bodyfat: 26, underbust: 74, bust: 89, waist: 70, hips: 95, arm: 27, thigh: 55, gland: 90, potential: 150 },
  // which optional systems the Author's Note tells the AI about (turn one off to save tokens)
  FEATURES: { milk: true, mana: true, curses: true }
}
const CARD_TYPE = 'Body sheet'
const CARD_KEYS = 'bodysheet'   // nothing in the story says this, so the card never costs context

