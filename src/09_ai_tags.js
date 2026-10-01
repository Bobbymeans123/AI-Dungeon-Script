// ---------- tags written by the AI ----------
function parseOne(t) {   // one tag such as "[ate 600]" -> an event, or null if it is not ours
  let m = t.match(/^\[\s*train\s+(chest|arms|core|glutes|legs)(?:\s+([1-3]))?\s*\]$/i)
  if (m) return { type: 'train', r: m[1].toLowerCase(), n: m[2] ? parseInt(m[2], 10) : 2 }
  m = t.match(/^\[\s*curse\s+(add|remove)\s+(hunger|leech|forced|bias)(?:\s+(chest|arms|core|glutes|legs))?\s*\]$/i)
  if (m) return { type: 'curse', op: m[1].toLowerCase(), name: m[2].toLowerCase(), r: m[3] ? m[3].toLowerCase() : '' }
  m = t.match(/^\[\s*lactating\s+(on|off)\s*\]$/i)
  if (m) return { type: 'lact', on: m[1].toLowerCase() === 'on' }
  m = t.match(/^\[\s*mana\s*([+\-])\s*(\d+(?:\.\d+)?)(?:\s+(chest|arms|core|glutes|legs))?\s*\]$/i)
  if (m) return { type: 'mana', sign: m[1], n: parseFloat(m[2]), r: m[3] ? m[3].toLowerCase() : 'all' }
  m = t.match(/^\[\s*(\w+)\s*([+\-=]?)\s*(\d+(?:\.\d+)?)?\s*(?:cm|kg|kcal|cc|ml|%)?\s*\]$/i)
  if (m) {
    const k = m[1].toLowerCase(), op = m[2], n = m[3] === undefined ? null : parseFloat(m[3])
    if (STAT_KEYS.indexOf(k) >= 0 && op && n !== null) return { type: 'stat', k: k, op: op, n: n }
    if (k === 'ate' && n !== null) return { type: 'ate', n: n }
    if (k === 'burn' && n !== null) return { type: 'burn', n: n }
    if (k === 'milk' && op === '-' && n !== null) return { type: 'milk', n: n }
    if (k === 'day') return { type: 'day', n: n || 1 }
  }
  return null
}
function parseTags(text) {
  const events = []
  const clean = text.replace(/\[[^\[\]\n]{1,80}\]/g, (tag) => {
    let who = '', t = tag
    const keys = npcKeys()
    for (let i = 0; i < keys.length; i++) {   // "[ate 300 Whitney]" or "[Whitney: ate 300]"
      const nm = esc(state.npcs[keys[i]].name || keys[i])
      const tail = new RegExp('\\s+' + nm + '\\s*\\]$', 'i'), head = new RegExp('^\\[\\s*' + nm + '\\s*[:,]?\\s+', 'i')
      if (tail.test(t)) { who = keys[i]; t = t.replace(tail, ']'); break }
      if (head.test(t)) { who = keys[i]; t = t.replace(head, '['); break }
    }
    const ev = parseOne(t)
    if (!ev) return tag   // not one of ours: leave it alone
    ev.who = who
    events.push(ev)
    return '\u0001'
  })
  return { clean: clean.replace(/ ?\u0001/g, ''), events: events }
}
function applyAll(events, useSkip) {   // sends each event to the right character; a new day passes for everyone
  const notes = [], groups = {}
  events.filter((e) => e.type !== 'day').forEach((e) => { const k = e.who || defKey(); (groups[k] = groups[k] || []).push(e) })
  Object.keys(groups).forEach((k) => {
    const s = sheetOf(k)
    if (!s) return
    applyEvents(s, groups[k], useSkip ? s.auto : null).forEach((n) => notes.push(labelOf(k) + n))
    state.bt_touched = (state.bt_touched || []).concat(state.bt_touched && state.bt_touched.indexOf(k) >= 0 ? [] : [k])
  })
  if (!(useSkip && state.bt.auto && state.bt.auto.day)) {
    events.filter((e) => e.type === 'day').forEach((e) => { notes.push(dayAll(Math.min(e.n, 30))) })
  }
  return notes
}
// "already counted this turn" guard: s.auto[type] is set by whatever counts first (typed text, a command, or the AI),
// and anything later of the same type for that character is dropped. Identical repeats inside one reply count once.
function applyEvents(s, events, skip) {
  if (skip) events = events.filter((e) => !skip[e.type])
  const seen = {}
  events = events.filter((e) => {
    if (e.type !== 'ate' && e.type !== 'burn') return true
    const id = e.type + e.n
    return seen[id] ? false : (seen[id] = true)
  })
  if (skip) events.forEach((e) => { if (e.type === 'ate' || e.type === 'burn' || e.type === 'train') s.auto[e.type] = true })
  const order = { stat: 0, curse: 1, lact: 2, ate: 3, burn: 4, train: 5, mana: 6, milk: 7, day: 8 }
  events.sort((a, b) => order[a.type] - order[b.type])
  const notes = []
  events.forEach((e) => {
    if (e.type === 'stat') notes.push(applyOp(s, e.k, e.op, e.n))
    else if (e.type === 'ate') { const n = Math.min(e.n, 5000); s.eaten = (s.eaten || 0) + n; notes.push('+' + fmt(n) + ' kcal') }
    else if (e.type === 'burn') { const n = Math.min(e.n, 3000); s.burned += n; notes.push('Burned ' + fmt(n) + ' kcal') }
    else if (e.type === 'train') { s.train[e.r] = Math.min(4, s.train[e.r] + e.n); notes.push('Trained ' + RWORD[e.r]) }
    else if (e.type === 'curse') notes.push(setCurse(s, e.op, e.name, e.r))
    else if (e.type === 'lact') { s.lact.on = e.on; notes.push('Lactation ' + (e.on ? 'on' : 'off')) }
    else if (e.type === 'mana') notes.push(doMana(s, e.sign, e.n, e.r))
    else if (e.type === 'milk') { const req = Math.min(e.n, 3000); const got = drainMilk(s, req); notes.push('Drained ' + Math.round(got) + ' ml') }
    else if (e.type === 'day') notes.push(advanceDays(s, e.n))
  })
  return notes
}

