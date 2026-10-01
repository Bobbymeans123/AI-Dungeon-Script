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
function readCard() {
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
