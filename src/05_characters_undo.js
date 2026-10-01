// ---------- several characters: you plus anyone added with :sheet add ----------
const esc = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const npcKeys = () => Object.keys(state.npcs || {})
function namesIn(text) {   // keys of tracked characters mentioned in the text
  const out = []
  npcKeys().forEach((k) => {
    const nm = state.npcs[k].name || k
    if (new RegExp("\\b" + esc(nm) + "(?:'s)?\\b", 'i').test(text)) out.push(k)
  })
  return out
}
const sheetOf = (key) => (key ? state.npcs[key] : state.bt)
const defKey = () => (state.bt_hideYou && npcKeys().length ? npcKeys()[0] : '')   // who unnamed commands and tags mean
const labelOf = (key) => (key ? state.npcs[key].name + ': ' : '')
function recentText(text) {
  let t = text || ''
  if (typeof history !== 'undefined' && history && history.length) t += ' ' + history.slice(-3).map((a) => (a && a.text) || '').join(' ')
  return t
}
function resetAuto() {
  state.bt.auto = {}
  npcKeys().forEach((k) => { state.npcs[k].auto = {} })
}
function dayAll(n) {   // time passes for everyone
  const notes = [advanceDays(state.bt, n)]
  npcKeys().forEach((k) => { notes.push(state.npcs[k].name + ': ' + advanceDays(state.npcs[k], n)) })
  return notes.join(' | ')
}

// undo / retry support: the tracker is snapshotted once per turn, keyed by where the story is
// (the action count plus a fingerprint of the last few actions). If we come back to a moment we
// already saw, the tracker goes back to how it was then, so a retry or undo is never counted twice.
const snap = () => JSON.stringify({ bt: state.bt, npcs: state.npcs || {} })
const restore = (str) => {
  const o = JSON.parse(str)
  if (o && o.bt !== undefined) { state.bt = o.bt; state.npcs = o.npcs || {} } else state.bt = o   // older snapshots held just the player
}
const hashStr = (str) => {
  let x = 5381
  for (let i = 0; i < str.length; i++) x = ((x << 5) + x + str.charCodeAt(i)) | 0
  return (x >>> 0).toString(36)
}
function slotKey() {
  const c = (typeof info !== 'undefined' && info && typeof info.actionCount === 'number') ? info.actionCount : ''
  let tail = ''
  if (typeof history !== 'undefined' && history && history.length) {
    tail = history.slice(-4).map((a) => (a && a.text) || '').join('\u0002')
  }
  if (c === '' && tail === '') return ''   // nothing tells one turn from another, so skip snapshots
  return c + ':' + hashStr(tail)
}
function takeSlot(name) {
  if (!Array.isArray(state[name])) state[name] = []
  const list = state[name], key = slotKey()
  if (key === '') return
  for (let i = list.length - 1; i >= 0; i--) {
    if (list[i][0] === key) { restore(list[i][1]); list.length = i; break }   // been here before: go back to that moment
  }
  list.push([key, snap()])
  while (list.length > 40) list.shift()
}

