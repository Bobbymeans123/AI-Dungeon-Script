// ---------- seeding your sheet from state.placeholders (custom build) ----------
// AI Dungeon fills state.placeholders (an array of { question, answer }) once, when the adventure starts. On the first turn the
// answers set up YOUR sheet, once, and only while nothing has happened to it yet. A missing, empty or unreadable answer keeps the
// default; if no placeholders exist (or none match) nothing happens. The "seeded" mark lives on the sheet, so it is part of the
// undo/retry snapshots: a replayed first turn seeds once, and later :set changes are never overwritten.
const PH_BUILD = { slim: [18, 'even', 'athletic'], average: [24, 'even', 'off'], curvy: [32, 'pear', 'curvy'], athletic: [16, 'even', 'athletic'] }   // body fat %, fat pattern, look
const PH_ACTIVITY = { couch: { activity: 1.2, muscle: 0.85 }, active: {}, runner: { activity: 1.5, muscle: 1.1 } }   // activity factor, starting muscle multiplier
const PH_CHEST = { small: [60, 150], average: [90, 200], large: [130, 300] }   // glandular cc, potential cc
const PH_WORDS = { slim: ['skinny', 'thin'], average: ['medium', 'normal', 'avg'], curvy: ['thick'], athletic: ['fit', 'toned'], couch: ['sedentary', 'lazy'], runner: ['running'], small: ['tiny', 'flat'], large: ['big', 'huge'] }   // other words that mean the same

function phAnswers() {   // the answers by field, or null when there are no placeholders
  const ph = state.placeholders
  if (!ph || typeof ph !== 'object') return null
  const list = Array.isArray(ph) ? ph : Object.keys(ph).map((k) => ({ question: k, answer: ph[k] }))
  const out = {}
  list.forEach((p) => {
    if (!p || p.question === undefined || p.answer === undefined || p.answer === null) return
    const q = String(p.question).toLowerCase().replace(/\s+/g, ' ').trim(), a = String(p.answer).replace(/\s+/g, ' ').trim()
    if (!a) return
    const f = /^(?:character\.)?name\b/.test(q) ? 'name' : /^(?:character\.)?gender\b/.test(q) ? 'gender' : /^height/.test(q) ? 'height' : /^weight/.test(q) ? 'weight'
      : /^build/.test(q) ? 'build' : /^activity/.test(q) ? 'activity' : /^chest/.test(q) ? 'chest' : ''
    if (f && out[f] === undefined) out[f] = a
  })
  return out
}
function phHeight(a) {   // "170", "170cm", "1.70 m", "5'7", "5 ft 7 in", "67 in" -> cm, kept within 120-230; null if there is no number
  const s = a.toLowerCase().replace(/[’′]/g, "'").replace(/[”″]/g, '"')
  let cm = null, m
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*cm\b/))) cm = parseFloat(m[1])
  else if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:'|ft(?![a-z])|feet\b|foot\b)\s*(\d+(?:\.\d+)?)?/))) cm = parseFloat(m[1]) * 30.48 + (m[2] ? parseFloat(m[2]) * 2.54 : 0)
  else if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:in|inch|inches)\b/))) cm = parseFloat(m[1]) * 2.54
  else if ((m = s.match(/(\d+(?:\.\d+)?)\s*m(?:eters?|etres?)?\b/))) cm = parseFloat(m[1]) * 100
  else if ((m = s.match(/\d+(?:\.\d+)?/))) { const n = parseFloat(m[0]); cm = n <= 3 ? n * 100 : n <= 8 ? n * 30.48 : n }   // 1.7 = metres, 5.7 = feet, 170 = cm
  return cm !== null && cm > 0 ? r1(clampN(cm, 120, 230)) : null
}
function phWeight(a) {   // "60", "60 kg", "130 lb", "9 st 7" -> kg, kept within 30-250; null if there is no number
  const s = a.toLowerCase()
  let kg = null, m
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:st|stone)\b\s*(?:(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)?)?/))) kg = parseFloat(m[1]) * 6.35029 + (m[2] ? parseFloat(m[2]) * 0.453592 : 0)
  else if ((m = s.match(/(\d+(?:\.\d+)?)\s*(?:lb|lbs|pounds?)\b/))) kg = parseFloat(m[1]) * 0.453592
  else if ((m = s.match(/\d+(?:\.\d+)?/))) kg = parseFloat(m[0])
  return kg !== null && kg > 0 ? r1(clampN(kg, 30, 250)) : null
}
function phPick(answer, keys) {   // which of the words the answer says (typos allowed, the earliest one wins), or null
  const toks = tokensOf(answer)
  let best = null, at = 1e9
  keys.forEach((key) => {
    ;[key].concat(PH_WORDS[key] || []).forEach((w) => {
      const i = findTok(toks, [w])
      if (i >= 0 && i < at) { at = i; best = key }
    })
  })
  return best
}
function seedFromPlaceholders() {
  const s = state.bt
  if (!CFG.PLACEHOLDERS || state.bt_hideYou || !s || s.seeded) return
  const a = phAnswers()
  if (!a) return
  const st = {}, o = {}, said = []
  const nm = a.name !== undefined ? (a.name.match(/[A-Za-z][\w-]*/) || [''])[0] : ''   // one word, and not a character that already exists
  if (nm && !state.npcs[nm.toLowerCase()]) o.name = nm
  const gender = a.gender !== undefined ? a.gender.slice(0, 20) : ''
  const h = a.height !== undefined ? phHeight(a.height) : null
  if (h) { st.height = h; said.push(h + ' cm') }
  const w = a.weight !== undefined ? phWeight(a.weight) : null
  if (w) { st.weight = w; said.push(w + ' kg') }
  const b = a.build !== undefined ? phPick(a.build, ['slim', 'average', 'curvy', 'athletic']) : null
  if (b) { st.bodyfat = PH_BUILD[b][0]; o.pattern = PH_BUILD[b][1]; o.look = PH_BUILD[b][2]; said.push(b) }
  const act = a.activity !== undefined ? phPick(a.activity, ['couch', 'active', 'runner']) : null
  if (act) { Object.assign(o, PH_ACTIVITY[act]); said.push(act) }
  const ch = a.chest !== undefined ? phPick(a.chest, ['small', 'average', 'large']) : null
  if (ch) { st.gland = PH_CHEST[ch][0]; st.potential = PH_CHEST[ch][1]; said.push(ch + ' chest') }
  if (!o.name && !gender && !said.length) return   // nothing usable: do nothing
  if (!playerPristine(s)) { s.seeded = true; return }   // the story has already moved on: never overwrite it
  const n = newBT(Object.assign({}, s.start, st), { name: o.name || s.name, pattern: o.pattern || s.pattern, look: o.look || s.look, muscle: o.muscle, activity: o.activity })
  n.pace = s.pace; n.paceSet = s.paceSet; n.support = s.support
  if (gender) n.gender = gender   // remembered only, no stat changes
  n.seeded = true
  const v = (x) => (x === undefined ? '' : x)
  n.seedCard = 'name=' + (o.name || '') + ' height=' + v(st.height) + ' weight=' + v(st.weight) + ' bodyfat=' + v(st.bodyfat) + ' underbust= bust= waist= hips= pattern=' + n.pattern + ' look=' + n.look + ' gland=' + v(st.gland) + ' potential=' + v(st.potential)
  state.bt = n
  if (said.length) state.bt_cardNote = 'Player sheet set from your answers: ' + said.join(', ') + '.'
}
