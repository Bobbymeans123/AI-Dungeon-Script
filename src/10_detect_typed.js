// ---------- spotting actions in what the player types (works without AI tags) ----------
// Text is lower-cased, stretched letters are squeezed ("sleeeep" -> "sleep") and matching forgives small typos.
const normText = (text) => text.toLowerCase()
  .replace(/\b(push|pull|sit|press)[- ]ups?\b/g, '$1up')
  .replace(/\bice[- ]cream\b/g, 'icecream')
  // multi-word foods become one word so the pieces ("hot", "dog", "soda") are not read on their own
  .replace(/\bhot[- ]dogs?\b/g, 'hotdog').replace(/\bcorn[- ]dogs?\b/g, 'corndog').replace(/\bpork[- ]chops?\b/g, 'porkchop')
  .replace(/\blamb[- ]chops?\b/g, 'lambchop').replace(/\bfried[- ]chicken\b/g, 'friedchicken')
  .replace(/\b(?:cotton[- ]candy|candy[- ]floss)\b/g, 'cottoncandy').replace(/\bfunnel[- ]cakes?\b/g, 'funnelcake')
  .replace(/\bcaramel[- ]apples?\b/g, 'caramelapple').replace(/\bs['’]?mores?\b/g, 'smores')
  .replace(/\bsweet[- ]tea\b/g, 'sweettea').replace(/\benergy[- ]drinks?\b/g, 'energydrink')
  // drinks with no calories must be joined before plain "soda" or "water" can be read
  .replace(/\b(?:diet|zero[- ]sugar|sugar[- ]free)[- ](?:soda|coke|cola|pepsi|lemonade)\b|\bcoke[- ]zero\b|\bzero[- ]sugar\b/g, 'dietsoda')
  .replace(/\bclub[- ]soda\b/g, 'clubsoda').replace(/\bsparkling[- ]water\b/g, 'sparklingwater')
  // things that look like food but are not
  .replace(/\bbaking[- ]soda\b/g, 'bakingsoda').replace(/\bpie[- ]charts?\b/g, 'piechart').replace(/\bcookie[- ]cutters?\b/g, 'cookiecutter')
  .replace(/\bcandy[- ](?:colou?red|striped|apple red)\b/g, 'candycolored')
  // drink sizes become one word each
  .replace(/\b(?:1|one)[- ]?(?:l|liter|litre)\b/g, 'oneliter').replace(/\b(?:2|two)[- ]?(?:l|liter|litre)s?\b/g, 'twoliter')
  .replace(/\b(?:64[- ]?oz|big[- ]gulp)\b/g, 'biggulp')
  .replace(/(.)\1{2,}/g, '$1$1')
  .replace(/[^a-z0-9'\- ]+/g, ' ')
const tokensOf = (text) => normText(text).split(/\s+/).filter(Boolean)
function editDist(a, b, subCost) {   // Damerau-Levenshtein: a swapped pair of letters counts as one typo
  const d = []
  for (let i = 0; i <= a.length; i++) { d.push([i]) }
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : subCost
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c)
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1)
    }
  }
  return d[a.length][b.length]
}
const NOT_THIS = { steak: ['stake', 'steal', 'steam', 'steel', 'stack', 'steep'], steaks: ['stakes', 'steals'], churro: ['church'], churros: ['churches'] }   // real words that must not be read as the food
function near(tok, word) {
  if (tok === word) return true
  if (NOT_THIS[word] && NOT_THIS[word].indexOf(tok) >= 0) return false
  if (!CFG.FUZZY) return false
  const L = word.length
  if (tok.length >= 3 && tok.length < L && tok.length >= L - 1 && word.startsWith(tok)) return true   // last letter missing ("cak")
  if (L === 3 && tok.length === 4 && tok.startsWith(word)) return true   // one extra letter on a 3-letter word ("eatt")
  const lim = L <= 3 ? 0 : L <= 8 ? 1 : 2
  if (lim === 0 || tok.length < 4 || Math.abs(tok.length - L) > lim) return false
  // short words must not change a letter ("lake" is not "cake", "sheep" is not "sleep")
  return editDist(tok, word, L <= 5 ? 2 : 1) <= lim
}
const findTok = (toks, words, from) => {
  for (let i = from || 0; i < toks.length; i++) { for (let k = 0; k < words.length; k++) { if (near(toks[i], words[k])) return i } }
  return -1
}

const FOODS = [   // [words, kcal per serving, kcal for the whole thing (optional)]
  [['cake', 'cakes', 'cheesecake', 'gateau'], 600, 12000],
  [['cupcake', 'cupcakes', 'muffin', 'muffins'], 350],
  [['shake', 'shakes', 'protein', 'smoothie', 'smoothies'], 130],
  [['pizza', 'pizzas'], 285, 2300],
  [['burger', 'burgers', 'cheeseburger', 'hamburger'], 550],
  [['sandwich', 'sandwiches', 'sub', 'wrap', 'burrito', 'taco', 'tacos'], 400],
  [['salad', 'salads'], 250],
  [['steak', 'steaks', 'chicken', 'pork', 'fish', 'meat', 'ribs', 'sausage', 'bacon', 'ham', 'turkey', 'lamb', 'ribeye', 'sirloin', 'porkchop', 'porkchops', 'lambchop', 'lambchops', 'brisket', 'roast', 'meatball', 'meatballs', 'kebab', 'kebabs', 'kabob', 'kebob', 'hotdog', 'hotdogs', 'wings', 'nuggets', 'friedchicken', 'bbq'], 450],
  [['pasta', 'spaghetti', 'noodles', 'noodle', 'lasagna', 'ramen', 'macaroni'], 450],
  [['rice', 'curry', 'sushi'], 300],
  [['soup', 'stew', 'porridge', 'oatmeal', 'cereal'], 250],
  [['fries', 'chips', 'crisps', 'nachos', 'popcorn', 'pretzel', 'pretzels', 'corndog', 'corndogs'], 400],
  [['bread', 'toast', 'bagel', 'roll', 'rolls'], 150],
  [['pancake', 'pancakes', 'waffle', 'waffles'], 150],
  [['cottoncandy', 'fudge', 'smores', 'caramelapple', 'churro', 'churros', 'funnelcake'], 300],
  [['egg', 'eggs', 'omelette', 'omelet'], 75],
  [['apple', 'apples', 'banana', 'bananas', 'fruit', 'orange', 'oranges', 'grapes', 'berries', 'strawberries', 'peach', 'pear'], 100],
  [['cookie', 'cookies', 'biscuit', 'biscuits', 'brownie', 'brownies'], 160],
  [['chocolate', 'candy', 'sweets', 'sweet', 'lollipop', 'gummies'], 250],
  [['icecream', 'gelato', 'sundae'], 300],
  [['donut', 'donuts', 'doughnut', 'doughnuts', 'pastry', 'pastries', 'croissant', 'pie', 'pies', 'tart'], 300],
  [['milk', 'juice', 'latte', 'cocoa', 'lemonade'], 150],
  [['soda', 'cola', 'coke', 'pepsi'], 140],
  [['beer', 'wine', 'cocktail', 'whiskey', 'vodka', 'ale'], 150],
  [['cheese', 'yogurt', 'yoghurt', 'butter'], 200],
  [['nuts', 'peanuts', 'almonds', 'granola', 'bar'], 200],
  [['sweettea', 'energydrink'], 150],
  [['dietsoda', 'clubsoda', 'sparklingwater'], 0],
  [['water', 'tea', 'coffee'], 0]
]
const MEALS = { breakfast: 450, brunch: 600, lunch: 600, dinner: 700, supper: 700, snack: 200, snacks: 300, meal: 500, dessert: 350, feast: 1500 }
const QTY = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, couple: 2, few: 3, several: 3, both: 2 }
const STRONG_EAT = ['eat', 'eats', 'ate', 'eating', 'eaten', 'devour', 'devours', 'gulp', 'swallow', 'chew', 'munch', 'nibble', 'bite', 'drink', 'drinks', 'drank', 'sip', 'chug', 'consume', 'scarf', 'stuff', 'wolf', 'feast', 'dine', 'inhale', 'gorge', 'binge', 'feed', 'feeds', 'fed']
const WEAK_EAT = ['have', 'having', 'take', 'grab', 'try', 'taste', 'sample', 'finish', 'pour', 'order', 'get', 'grab', 'help', 'mix', 'make', 'cook', 'polish', 'share', 'split', 'serve', 'offer', 'give', 'hand', 'has', 'had']
// ---- lazy mode: a meal is a flat amount, scaled by the biggest/smallest size word near the food ----
const LAZY_KCAL = { meal: 700, snack: 300, sweet: 400 }
const LAZY_CLASS = {   // food group (first word of its FOODS row) -> class. Drinks and water are not listed: they keep their own kcal
  burger: 'meal', sandwich: 'meal', pizza: 'meal', salad: 'meal', steak: 'meal', pasta: 'meal', rice: 'meal', soup: 'meal',
  fries: 'snack', bread: 'snack', egg: 'snack', apple: 'snack', cheese: 'snack', nuts: 'snack',
  pancake: 'sweet', cottoncandy: 'sweet', cake: 'sweet', cupcake: 'sweet', cookie: 'sweet', chocolate: 'sweet', icecream: 'sweet', donut: 'sweet',
  breakfast: 'meal', brunch: 'meal', lunch: 'meal', dinner: 'meal', supper: 'meal', meal: 'meal', feast: 'meal', snack: 'snack', snacks: 'snack', dessert: 'sweet'
}
const SIZE = { massive: 1.5, huge: 1.5, giant: 1.5, double: 1.5, mountain: 1.5, small: 0.5, little: 0.5, tiny: 0.5, half: 0.5 }
function sizeNear(toks, i) {   // the largest size word in the 4 words before the food, or null
  let best = null
  for (let j = Math.max(0, i - 4); j < i; j++) { if (SIZE[toks[j]] && (best === null || SIZE[toks[j]] > best)) best = SIZE[toks[j]] }
  return best
}
function mealKcal(parts) {   // total kcal for the foods of one meal. Normal mode: the sum of the food table
  if (!lazyOn()) return parts.reduce((t, p) => t + p.kcal, 0)
  const by = { meal: [], snack: [], sweet: [] }
  let total = 0
  parts.forEach((p) => {
    if (by[p.cls]) by[p.cls].push(p)
    else if (p.drink && p.size) total += (p.kcal / p.qty) * Math.min(2, p.size * p.qty)   // a giant cup of soda
    else total += p.kcal
  })
  const main = by.meal.length ? 'meal' : by.sweet.length ? 'sweet' : ''   // snacks next to a meal or sweet are part of it
  ;['meal', 'sweet', 'snack'].forEach((c) => {
    let list = by[c]
    if (!list.length || (c === 'snack' && main)) return
    let sizes = list.map((p) => p.size).filter(Boolean)
    if (!sizes.length && c === main) sizes = by.snack.map((p) => p.size).filter((s) => s > 1)   // "a mountain of fries" makes the meal big
    const size = sizes.length ? Math.max.apply(null, sizes) : 1
    const qty = Math.max.apply(null, list.map((p) => p.qty))
    total += LAZY_KCAL[c] * Math.min(2, size * qty)
  })
  return total
}
const LABELS = { dietsoda: 'diet soda', clubsoda: 'club soda', sparklingwater: 'sparkling water', hotdog: 'hot dog', hotdogs: 'hot dogs', corndog: 'corn dog', corndogs: 'corn dogs', porkchop: 'pork chop', porkchops: 'pork chops', lambchop: 'lamb chop', lambchops: 'lamb chops', friedchicken: 'fried chicken', cottoncandy: 'cotton candy', funnelcake: 'funnel cake', caramelapple: 'caramel apple', smores: "s'mores", sweettea: 'sweet tea', energydrink: 'energy drink' }
const sipLine = (k, labels) => (k ? state.npcs[k].name : 'You') + ' sipped ' + labels.map(withArticle).join(' and ') + ' (0 kcal, very virtuous)'
const withArticle = (l) => (/s$|water$|^fudge$|^bbq$/.test(l) ? l : 'a ' + l)
// ---- drinks: the container sets the amount (real kcal, also in lazy mode) ----
const DRINK_ROWS = ['milk', 'soda', 'sweettea']   // FOODS rows (first word) that use containers
const GAG = ['dietsoda', 'clubsoda', 'sparklingwater']   // zero-kcal drinks that get a light status line when named exactly (plain water counts 0 and says nothing)
const SIZE_DRINK = { oneliter: 420, twoliter: 840, biggulp: 800 }   // a named size can sit a few words away ("a 2-liter bottle of soda")
const CONTAINER = { can: 150, cans: 150, glass: 200, glasses: 200, cup: 200, cups: 200, bottle: 210, bottles: 210, jug: 420, jugs: 420 }   // must sit right next to the drink ("a can of soda")
function containerNear(toks, i) {   // kcal for the container around the drink word at i, or 0
  for (let j = Math.max(0, i - 4); j <= Math.min(toks.length - 1, i + 3); j++) { if (SIZE_DRINK[toks[j]]) return SIZE_DRINK[toks[j]] }
  const before = toks[i - 1] === 'of' ? toks[i - 2] : toks[i - 1]
  return CONTAINER[before] || CONTAINER[toks[i + 1]] || 0
}
function detectAte(text) { return detectAteInfo(text, false).kcal }
function detectAteInfo(text, force) {   // force: the caller already knows this sentence starts a meal, so no eating verb is needed
  const toks = tokensOf(text), foods = [], labels = [], parts = []
  const strong = findTok(toks, STRONG_EAT) >= 0, weak = findTok(toks, WEAK_EAT) >= 0
  if (!strong && !weak && !force) return { kcal: 0, foods: foods, label: '', parts: parts, gag: [] }
  let total = 0, found = false
  const qtyBefore = (i) => {   // nearest quantity word in the few words before the food
    for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
      const w = toks[j]
      if (/^d+(?:.d+)?$/.test(w)) return w
      if (QTY[w] || w === 'half' || w === 'whole' || w === 'entire' || w === 'all') return w
    }
    return null
  }
  FOODS.forEach((f) => {
    const i = findTok(toks, f[0])
    if (i < 0) return
    found = true
    foods.push(f[0][0])
    const word = toks[i], lab = (SIZE[toks[i - 1]] ? toks[i - 1] + ' ' : '') + (LABELS[word] || word)
    labels.push(lab)
    const q = qtyBefore(i)
    const drink = DRINK_ROWS.indexOf(f[0][0]) >= 0, base = (drink && containerNear(toks, i)) || f[1]   // a can, glass or 2-liter sets the kcal of a soft drink
    let kcal = base
    if (q) {
      if (/^d/.test(q)) kcal = base * parseFloat(q)
      else if (QTY[q]) kcal = base * QTY[q]
      else if (q === 'half') kcal = f[2] ? f[2] / 2 : base * 0.5
      else kcal = f[2] ? f[2] : base * 4   // whole / entire / all
    }
    const num = q && (/^\d/.test(q) ? parseFloat(q) : QTY[q])
    parts.push({ food: f[0][0], word: word, kcal: kcal, label: lab, cls: LAZY_CLASS[f[0][0]], size: sizeNear(toks, i), qty: num || 1, drink: drink, gag: kcal === 0 && GAG.indexOf(word) >= 0 })   // gag: an exact zero-kcal drink, never a fuzzy match
  })
  Object.keys(MEALS).forEach((w) => {
    if (findTok(toks, [w]) >= 0 && !found) { found = true; foods.push(w); labels.push(w); parts.push({ food: w, word: w, kcal: MEALS[w], label: w, cls: LAZY_CLASS[w], size: null, qty: 1 }) }
  })
  if (!found) return { kcal: strong ? (lazyOn() ? LAZY_KCAL.meal : 400) : 0, foods: [], label: 'a meal', parts: parts, gag: [] }   // "I eat" with no food named counts as a plain meal; "I have" alone does not
  if (/\b(?:just a|a little|a tiny|a small) (?:taste|nibble|bite|sip)\b/.test(normText(text))) parts.forEach((p) => { p.size = 0.5 })   // "just a taste"
  return { kcal: Math.round(Math.min(mealKcal(parts), 5000)), foods: foods, label: labels.map(withArticle).join(' and '), parts: parts, gag: parts.filter((p) => p.gag).map((p) => p.label) }
}

const EX_LEGS = ['squat', 'squats', 'lunge', 'lunges', 'calf', 'legpress']
const EX_GLUTES = ['deadlift', 'deadlifts', 'thrust', 'thrusts', 'glute', 'glutes', 'bridges']
const EX_ARMS = ['curl', 'curls', 'bicep', 'biceps', 'tricep', 'triceps', 'pullup', 'pullups', 'dumbbell', 'dumbbells', 'kettlebell', 'kettlebells', 'barbell', 'barbells']
const EX_CHEST = ['pushup', 'pushups', 'bench', 'benchpress', 'fly', 'flies', 'flyes', 'pressup', 'pressups']
const EX_CORE = ['plank', 'planks', 'crunch', 'crunches', 'situp', 'situps', 'abs', 'core']
const EX_GENERIC = ['workout', 'workouts', 'exercise', 'exercises', 'exercising', 'gym', 'train', 'training', 'lift', 'lifting', 'lifts', 'weights', 'weight', 'reps', 'burpees', 'burpee', 'calisthenics']
const EX_CARDIO = ['jog', 'jogging', 'jogs', 'sprint', 'sprinting', 'treadmill', 'cardio', 'swim', 'swimming', 'aerobics']
const EX_ACTION = ['do', 'does', 'doing', 'did', 'perform', 'start', 'begin', 'hit', 'lift', 'lifting', 'use', 'using', 'grab', 'pick', 'curl', 'curls', 'press', 'pump', 'train', 'training', 'workout', 'exercise', 'exercising', 'work', 'swing', 'hoist', 'try', 'go', 'head', 'squat', 'squats', 'lunge', 'lunges', 'deadlift', 'deadlifts', 'plank', 'planks', 'jog', 'sprint', 'swim', 'crunches', 'burpees', 'pushups', 'situps', 'pullups']
function detectExercise(text) {
  const toks = tokensOf(text)
  if (findTok(toks, EX_ACTION) < 0) return null
  const regions = []
  const add = (rs) => rs.forEach((r) => { if (regions.indexOf(r) < 0) regions.push(r) })
  if (findTok(toks, EX_LEGS) >= 0) add(['legs'])
  if (findTok(toks, EX_GLUTES) >= 0) add(['glutes', 'legs'])
  if (findTok(toks, EX_ARMS) >= 0) add(['arms'])
  if (findTok(toks, EX_CHEST) >= 0) add(['chest', 'arms'])
  if (findTok(toks, EX_CORE) >= 0) add(['core'])
  const generic = findTok(toks, EX_GENERIC) >= 0
  const norm = normText(text)
  const cardio = findTok(toks, EX_CARDIO) >= 0 || /\brun(?:s|ning)? (?:laps|for|around|a mile|miles|km)\b|\bgo(?:es)? (?:for )?a run\b/.test(norm)
  if (generic && regions.length === 0) add(['legs', 'arms', 'chest'])
  if (regions.length === 0 && !cardio) return null
  const effort = findTok(toks, ['hard', 'heavy', 'intense', 'max', 'maximum', 'brutal', 'grueling', 'punishing', 'exhausting', 'intensely', 'vigorously']) >= 0 || /all[- ]out/.test(norm) ? 3
    : findTok(toks, ['light', 'easy', 'gentle', 'slow', 'warmup', 'casual', 'lightly', 'quick']) >= 0 ? 1 : 2
  return { regions: regions, effort: effort, burn: [150, 300, 450][effort - 1] }
}

const SLEEP_WORDS = ['sleep', 'sleeps', 'slept', 'asleep', 'bedtime', 'snooze', 'slumber']
function detectSleep(text) {
  const norm = normText(text)
  if (/\b(?:nap|naps|doze|dozes|can'?t sleep|cannot sleep|not sleep|don'?t sleep|unable to sleep|no sleep)\b/.test(norm)) return false
  const toks = tokensOf(text)
  if (findTok(toks, SLEEP_WORDS) >= 0) return true
  return /\b(?:go(?:es|ing)? to bed|turn(?:s|ing)? in\b|hit(?:s|ting)? the (?:hay|sack)|lie(?:s)? down (?:and|to) (?:sleep|rest)|call(?:s|ing)? it a night|lights out|rest (?:until|till|for the night|overnight)|(?:wait|stay|rest|wake|sleep)\w* (?:until|till|for) (?:the )?(?:morning|tomorrow|dawn|next day)|skip (?:to|ahead to) (?:the )?(?:morning|tomorrow|next day)|(?:the )?next (?:morning|day)|overnight|end (?:the|my|your|of the) day)\b/.test(norm)
}
function autoDetectAll(text) {
  const res = { notes: [], touched: [] }
  if (!CFG.AUTO) return res
  const names = namesIn(text)
  let keys = state.bt_hideYou ? [] : ['']   // with your sheet hidden, what you do yourself is not tracked
  if (names.length) {   // "Whitney eats cake" goes to Whitney; "I share a cake with Whitney" goes to both
    const both = /\b(?:together|both|we|us|share|shares|sharing)\b/i.test(text) || names.some((k) => {
      const nm = esc(state.npcs[k].name || k)
      return new RegExp('\\bwith\\s+' + nm + '\\b|\\b' + nm + '\\s+and\\s+(?:i|me|you)\\b|\\b(?:i|me|you)\\s+and\\s+' + nm + '\\b', 'i').test(text)
    })
    keys = both && !state.bt_hideYou ? [''].concat(names) : names
  }
  const ev = []
  const ate = detectAteInfo(text, false), kcal = ate.kcal, ex = detectExercise(text)
  keys.forEach((k) => {
    const s = sheetOf(k)
    if (!s) return
    if (kcal > 0) { ev.push({ type: 'ate', n: kcal, who: k }); s.auto.ate = true; s.lastAuto = { kcal: Math.min(kcal, 5000), label: 'what you typed' } }
    if (ex) {
      ev.push({ type: 'burn', n: ex.burn, who: k }); s.auto.burn = true
      ex.regions.forEach((r) => { ev.push({ type: 'train', r: r, n: ex.effort, who: k }); s.auto.train = true })
    }
  })
  if (kcal > 0 || ex) res.touched = keys.slice()
  const nowCount = typeof info !== 'undefined' && info && typeof info.actionCount === 'number' ? info.actionCount : 0
  if (detectSleep(text) && (!state.bt.lastDayAt || !nowCount || nowCount - state.bt.lastDayAt >= 4)) {
    ev.push({ type: 'day', n: 1 }); state.bt.auto.day = true; state.bt.lastDayAt = nowCount
    res.touched = ['']
  }
  state.bt_touched = []
  res.notes = applyAll(ev, false)
  if (ate.gag.length) {   // a zero-kcal drink: nothing counted, just a light line
    keys.forEach((k) => { if (sheetOf(k)) res.notes.push(sipLine(k, ate.gag)) })
    if (!res.touched.length) res.touched = keys.slice()
  }
  if (res.notes.length) res.touched = res.touched.length ? res.touched : state.bt_touched
  return res
}

