// ---------- spotting meals in the AI's reply (Output tab) ----------
// Only the start of a meal counts: served, ordered, grabbed, dug into, "eats a ...". Wording that continues or only
// talks about a meal (another bite, chews, finishes, looks at, wants) does not. A meal goes to a character only when
// the sentence names them (or says "you" and the player has a sheet), otherwise nothing is counted. All sentences
// about one meal in a reply are merged and counted once, and the same character + food word is not counted again
// for NARRATE_COOLDOWN actions, so order, arrival, bites and "devours the rest" over several replies are one meal.
const NARRATE_COOLDOWN = 3
const START_RE = /\b(?:arrives?|arrived|orders?|ordered|ordering|grabs?|grabbed|digs? into|dug into|tucks? into|starts? (?:on|eating)|begins? (?:to eat|eating)|brings?|serves?|served|sets? down|slides? (?:over|across)|eats?|ate|helps? (?:herself|himself|themselves) to|picks? up)\b/i
const CONT_RE = /\b(?:another (?:bite|nibble|sip|taste|piece|forkful|spoonful)|takes? (?:a|one|the) (?:bite|nibble|sip|taste)|bites? into|chews?|chewing|savou?rs?|savou?ring|finish(?:es|ed)?|the rest|last (?:bite|piece|crumb)|licks?|swallows?|polish(?:es|ed)? off|wipes?|leftovers?|looks? (?:at|down)|stares?|eyes|smells?|watch(?:es|ed)|admires?|considers?|wants?|wonders?)\b/i

const DISHES = ['burger', 'sandwich', 'pizza', 'salad', 'pasta', 'cake']   // when one of these is in the sentence, its ingredients are not separate foods
const INGREDIENTS = ['meat', 'cheese', 'bacon', 'ham', 'egg', 'eggs', 'butter', 'bread', 'chicken', 'pork', 'lamb', 'turkey']
function narratedEaters(sent) {   // keys of the characters this sentence is about; [] means do not guess
  const names = namesIn(sent)
  if (names.length > 1) return /\b(?:both|together|and|share|shares)\b/i.test(sent) ? names : []
  if (names.length === 1) return names
  if (/\byou(?:r|rs)?\b/i.test(sent)) {
    const you = CFG.YOU_NAME && state.npcs[CFG.YOU_NAME.toLowerCase()] ? CFG.YOU_NAME.toLowerCase() : ''
    if (you) return [you]
    if (!state.bt_hideYou) return ['']
  }
  return []
}
function narratedMeals(text, count) {   // returns [{ key, kcal, parts, label }]
  const found = {}
  const sentences = text.replace(/\[[^\]]*\]/g, ' ').replace(/\.{2,}|…/g, ' ').split(/(?<=[.!?])\s+|[;\n]+|\s*[—–,]\s*and\s+(?=[A-Z])/)   // also "..., and Whitney nudges ...": a new clause with its own subject
  sentences.forEach((sent) => {
    const at = sent.search(CONT_RE)
    const head = at >= 0 ? sent.slice(0, at) : sent   // what happens before "takes another bite" still counts
    if (!START_RE.test(head)) return
    let parts = detectAteInfo(head, true).parts.filter((p) => p.kcal > 0)   // water, tea and typo matches like "waiter" do not count
    if (parts.some((p) => DISHES.indexOf(p.food) >= 0)) parts = parts.filter((p) => INGREDIENTS.indexOf(p.label) < 0)   // "burger ... slabs of meat" is one dish
    if (!parts.length) return
    narratedEaters(sent).forEach((k) => {
      found[k] = found[k] || {}
      parts.forEach((p) => { found[k][p.food] = p })
    })
  })
  const out = []
  Object.keys(found).forEach((k) => {
    const s = sheetOf(k)
    if (!s || s.auto.ate) return   // already counted this turn by typed text, a command or an AI tag
    const cool = s.cool || {}
    const fresh = Object.keys(found[k]).filter((f) => cool[f] === undefined || Math.abs(count - cool[f]) > NARRATE_COOLDOWN).map((f) => found[k][f])
    if (!fresh.length) return
    const kcal = fresh.reduce((t, p) => t + p.kcal, 0)
    out.push({ key: k, kcal: Math.round(Math.min(kcal, 5000)), parts: fresh, label: fresh.map((p) => (/s$/.test(p.label) ? p.label : 'a ' + p.label)).join(' and ') })
  })
  return out
}
function countNarrated(text) {   // adds the meals found in the AI's reply and returns the status notes
  const count = typeof info !== 'undefined' && info && typeof info.actionCount === 'number' && info.actionCount > 0 ? info.actionCount : (typeof history !== 'undefined' && history ? history.length : 0)
  const notes = []
  narratedMeals(text, count).forEach((o) => {
    const s = sheetOf(o.key)
    s.eaten = (s.eaten || 0) + o.kcal
    s.auto.ate = true
    s.cool = s.cool || {}
    o.parts.forEach((p) => { s.cool[p.food] = count })
    s.lastAuto = { kcal: o.kcal, label: o.label }
    state.bt_touched = (state.bt_touched || []).concat([o.key])
    notes.push('Counted: ' + (o.key ? state.npcs[o.key].name : 'You') + ' ate ' + o.label + ' (~' + fmt(o.kcal) + ' kcal). Type :undo meal to remove.')
  })
  if (notes.length) state.bt_flag = true
  return notes
}
