// ---------- state ----------
const newBT = (startOverride, opts) => {
  opts = opts || {}
  const st = Object.assign({}, CFG.START, startOverride || {})
  const pattern = opts.pattern || CFG.PATTERN
  const P = PATTERNS[pattern] || PATTERNS.pear, k = st.weight / 60
  const s = {
    name: opts.name || '', start: st, pattern: pattern,
    day: 1, eaten: null, burned: 0, train: zero(), height: st.height, fat: {}, mus: {}, adj: {},
    bonus: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 }, gland: st.gland, sag: 0,
    fuelLog: [], auto: {}, lastDayAt: 0, support: CFG.SUPPORT, look: opts.look || CFG.LOOK, pace: CFG.PACE,
    lact: { on: false, stored: 0, sup: 0, demand: 0, drained: 0, lowDays: 0 }, mana: zero(),
    curses: { hunger: false, leech: '', forced: false, bias: '' }, glandMax: st.potential, gland0: st.gland
  }
  const fatT = st.weight * st.bodyfat / 100
  REGIONS.forEach((r) => { s.fat[r] = fatT * P[r]; s.mus[r] = MUS_START[r] * k })
  s.fat0 = copy(s.fat)
  s.mus0 = copy(s.mus)
  s.other = st.weight - fatT - sum(s.mus)
  MEAS.forEach((m) => { s.adj[m] = 0 })
  s.bustA = (st.bust - st.underbust) / Math.pow(volume(s).total, 0.4)
  s.volPrev = volume(s).tissue
  return s
}
function upgradeBT(s) {   // lets an adventure started with an older version keep working
  if (!s.start) s.start = Object.assign({}, CFG.START)
  if (!s.pattern) s.pattern = CFG.PATTERN
  if (s.name === undefined) s.name = ''
  if (!s.auto) s.auto = {}
  if (s.lastDayAt === undefined) s.lastDayAt = 0
  if (!s.lact) s.lact = { on: false, stored: 0, sup: 0, demand: 0, drained: 0, lowDays: 0 }
  if (!s.mana) s.mana = zero()
  if (!s.curses) s.curses = { hunger: false, leech: '', forced: false, bias: '' }
  if (s.glandMax === undefined) s.glandMax = s.start.potential
  if (s.gland0 === undefined) s.gland0 = s.start.gland
}
const initBT = () => {
  if (!state.bt) state.bt = newBT(); else upgradeBT(state.bt)
  if (!state.npcs) state.npcs = {}
  Object.keys(state.npcs).forEach((k) => upgradeBT(state.npcs[k]))
  if (!state.bt_seeded) {   // preset characters are created once, on the first turn
    state.bt_seeded = true
    ;(CFG.CHARACTERS || []).forEach((c) => {
      const k = c.name.toLowerCase()
      if (state.npcs[k]) return
      state.npcs[k] = newBT(c.start, { name: c.name, pattern: c.pattern, look: c.look })
      Object.keys(c.bonus || {}).forEach((b) => { state.npcs[k].bonus[b] = c.bonus[b] })
    })
    if (CFG.HIDE_PLAYER) state.bt_hideYou = true
  }
}

