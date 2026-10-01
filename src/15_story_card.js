// ---------- story card mirror ----------
function writeCard() {
  const cards = typeof storyCards !== 'undefined' ? storyCards : []
  const put = (keys, entry) => {
    let idx = -1
    for (let i = 0; i < cards.length; i++) { if (cards[i].type === CARD_TYPE && cards[i].keys === keys) { idx = i; break } }
    if (idx === -1) addStoryCard(keys, entry, CARD_TYPE)
    else updateStoryCard(idx, keys, entry, CARD_TYPE)
  }
  if (!state.bt_hideYou) {
    const entry = sheetText(state.bt)
    put(CARD_KEYS, entry)
    state.bt_cardPrev = state.bt_card
    state.bt_card = entry
  } else if (typeof removeStoryCard === 'function') {   // your own sheet is hidden: take its card away
    for (let i = cards.length - 1; i >= 0; i--) { if (cards[i].type === CARD_TYPE && cards[i].keys === CARD_KEYS) removeStoryCard(i) }
  }
  npcKeys().forEach((k) => put(CARD_KEYS + '-' + k, sheetText(state.npcs[k], state.npcs[k].name)))
  // drop cards of characters that were removed
  if (typeof removeStoryCard === 'function') {
    for (let i = cards.length - 1; i >= 0; i--) {
      const kk = cards[i].keys
      if (cards[i].type === CARD_TYPE && typeof kk === 'string' && kk.indexOf(CARD_KEYS + '-') === 0 && !state.npcs[kk.slice(CARD_KEYS.length + 1)]) removeStoryCard(i)
    }
  }
}
const CARD_LINES = { 'height': 'height', 'weight': 'weight', 'body fat': 'bodyfat', 'bust': 'bust', 'underbust': 'underbust', 'waist': 'waist', 'hips': 'hips', 'arm': 'arm', 'thigh': 'thigh', 'glandular cc': 'gland', 'potential cc': 'potential', 'sag': 'sag' }
function cardValues(str) {
  const out = {}
  String(str).split('\n').forEach((line) => {
    const m = line.match(/^([A-Za-z ]+):\s*(-?\d+(?:\.\d+)?)/)
    if (m && CARD_LINES[m[1].trim().toLowerCase()]) out[CARD_LINES[m[1].trim().toLowerCase()]] = parseFloat(m[2])
  })
  return out
}
// ---------- Player setup card (custom build): fill in your own sheet by editing one story card ----------
// Created once on the first turn with a blank template. When its text differs from what was last applied, the values are
// applied to your sheet (rebuilt like :sheet add while nothing has happened yet, otherwise like :set), once per edit.
// Blank values keep the default, a bad value is skipped and named in the status line. The keys never appear in the story.
const SETUP_TYPE = 'Player setup', SETUP_KEYS = 'playersetup'
const SETUP_TEMPLATE = 'name= height= weight= bodyfat= underbust= bust= waist= hips= pattern=even look=athletic gland= potential='
function playerPristine(s) {   // nothing has happened to this sheet yet
  return s.day === 1 && s.eaten === null && !s.burned && REGIONS.every((r) => !s.train[r]) && !s.fuelLog.length && AB.every((a) => !s.bonus[a]) &&
    MEAS.every((m) => !s.adj[m]) && s.gland === s.gland0 && s.glandMax === s.start.potential && !s.sag && !s.lact.on
}
function applyPlayerCard() {
  state.bt_cardNote = ''
  const cards = typeof storyCards !== 'undefined' && storyCards ? storyCards : []
  let entry = null
  for (let i = 0; i < cards.length; i++) { if (cards[i].type === SETUP_TYPE && cards[i].keys === SETUP_KEYS) { entry = String(cards[i].entry || ''); break } }
  if (entry === null) {
    if (state.bt_setupMade) return   // you deleted it: it is not made again
    addStoryCard(SETUP_KEYS, SETUP_TEMPLATE, SETUP_TYPE)
    entry = SETUP_TEMPLATE
  }
  state.bt_setupMade = true
  const s = state.bt
  if (s.cardApplied === entry) return   // unchanged since last time: do not apply again (later :set changes stay)
  const r = parseSheetOpts(entry, true)
  const did = Object.keys(r.st).concat(Object.keys(r.o))
  if (did.length) {
    if (playerPristine(s)) {   // rebuild exactly like :sheet add would
      const n = newBT(Object.assign({}, s.start, r.st), { name: r.o.name || s.name, pattern: r.o.pattern || s.pattern, look: r.o.look || s.look })
      n.pace = s.pace; n.paceSet = s.paceSet; n.support = s.support
      state.bt = n
    } else {   // the story has moved on: the same as typing :set for each value
      Object.keys(r.st).forEach((k) => setValue(s, k, r.st[k]))
      if (r.o.pattern) s.pattern = r.o.pattern
      if (r.o.look) s.look = r.o.look
      if (r.o.name) s.name = r.o.name
    }
  }
  state.bt.cardApplied = entry
  const notes = []
  if (did.length && entry !== SETUP_TEMPLATE) notes.push('Player setup applied: ' + (did.length > 4 ? did.length + ' values' : did.join(', ')))
  if (r.bad.length) notes.push('Player setup skipped: ' + r.bad.join(' '))
  state.bt_cardNote = notes.join(' | ')
}
function readCard() {
  if (CFG.PLAYER_CARD) applyPlayerCard()
  if (!CFG.CARD_READBACK || !state.bt_card) return
  const cards = typeof storyCards !== 'undefined' ? storyCards : []
  for (let i = 0; i < cards.length; i++) {
    if (cards[i].type !== CARD_TYPE) continue
    const entry = cards[i].entry
    if (entry === state.bt_card || entry === state.bt_cardPrev) return   // unchanged (or our write is still catching up)
    const was = cardValues(state.bt_card), now = cardValues(entry)
    Object.keys(now).forEach((k) => { if (was[k] !== undefined && Math.abs(now[k] - was[k]) > 0.049) setValue(state.bt, k, now[k]) })
    return
  }
}

// ---------- :probe (custom build only): what do the hooks receive? ----------
// Writes one story card with keys "probe" listing info, the names of the state keys, any state that looks like
// character/player info, history[0] and the last two history entries in full, and the other story cards.
// It changes no sheet. Read it in AI Dungeon's story card list (type "Probe"), then delete it.
function probeCard() {
  const cut = (v, n) => {
    let t
    try { t = typeof v === 'string' ? v : JSON.stringify(v) } catch (e) { t = String(v) }
    if (t === undefined) return 'undefined'
    return t.length > n ? t.slice(0, n) + '...(+' + (t.length - n) + ' more characters)' : t
  }
  const L = ['PROBE written at action ' + turnNo()]
  L.push('', '--- info (key = value) ---')
  if (typeof info !== 'undefined' && info) Object.keys(info).forEach((k) => L.push(k + ' = ' + cut(info[k], 300)))
  else L.push('info is missing')
  L.push('', '--- state keys (names only) ---', Object.keys(state).join(', '))
  if (state.memory && typeof state.memory === 'object') L.push('state.memory keys: ' + Object.keys(state.memory).join(', '))
  L.push('', '--- does state hold character or player info? ---')
  const guess = ['character', 'player', 'name', 'characterName', 'playerName', 'you', 'class', 'hero', 'persona', 'user', 'protagonist']
  guess.forEach((k) => L.push('state.' + k + ': ' + (state[k] === undefined ? 'absent' : 'PRESENT = ' + cut(state[k], 300))))
  Object.keys(state).filter((k) => /char|player|name|class|hero|persona|user|protag/i.test(k) && guess.indexOf(k) < 0).forEach((k) => L.push('state.' + k + ' (found by name) = ' + cut(state[k], 300)))
  const H = typeof history !== 'undefined' && history ? history : []
  L.push('', '--- history: ' + H.length + ' entries ---')
  const shown = []
  ;[0, H.length - 2, H.length - 1].forEach((i) => {
    const a = H[i]
    if (!a || shown.indexOf(i) >= 0) return
    shown.push(i)
    const txt = typeof a.text === 'string' ? a.text : ''
    L.push('', 'history[' + i + '] type=' + a.type + ', length=' + txt.length + ', fields=' + Object.keys(a).join(','), txt)
  })
  const cards = typeof storyCards !== 'undefined' && storyCards ? storyCards : []
  L.push('', '--- story cards: ' + cards.length + ' (type | keys | start of entry) ---')
  cards.forEach((c) => { if (c.keys !== 'probe') L.push((c.type || '') + ' | ' + c.keys + ' | ' + cut(String(c.entry || '').slice(0, 160), 160)) })
  const entry = L.join('\n')
  let idx = -1
  for (let i = 0; i < cards.length; i++) { if (cards[i].keys === 'probe') { idx = i; break } }
  if (idx === -1) addStoryCard('probe', entry, 'Probe')
  else updateStoryCard(idx, 'probe', entry, 'Probe')
  return 'Probe card written (story card "probe")'
}
