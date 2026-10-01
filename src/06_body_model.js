// ---------- body model ----------
function volume(s) {   // breast volume per breast, in cc
  const fat = s.fat.chest * BREAST_FAT_SHARE * 1000 / FAT_G_PER_CC / 2
  const tissue = fat + s.gland + CONN_CC, milk = s.lact.stored / 2
  return { fat: fat, gland: s.gland, conn: CONN_CC, milk: milk, tissue: tissue, total: tissue + milk }
}
function chestCalc(s) {
  const V = volume(s), g = V.gland / V.tissue
  const musR = s.mus.chest / s.mus0.chest
  const firm = clampN(60 + 80 * (g - 0.25) + 10 * (musR - 1) / 0.6 - 12 * s.sag, 0, 100)
  return { V: V, g: g, firm: firm }
}
const firmWord = (f) => (f >= 70 ? 'firm' : f >= 45 ? 'moderately firm' : 'soft')
const sagWord = (x) => (x < 0.4 ? 'no sag' : x < 1.2 ? 'slight sag' : x < 2.2 ? 'moderate sag' : 'significant sag')

// ---- milk ----
const milkCap = (s) => s.gland * 2 * 1.5                          // ml both breasts hold when full
const milkRateMax = (s) => 750 * Math.pow(s.gland / 150, 0.8)     // ml per day at full supply, both breasts
const milkCost = (s) => milkRateMax(s) * s.lact.sup * MILK_KCAL_PER_ML
const glandCeil = (s) => s.glandMax * (s.curses.forced ? 1.5 : 1)
const lactActive = (s) => s.lact.on || s.curses.forced
function drainMilk(s, req) {
  const got = Math.min(s.lact.stored, req)
  s.lact.stored -= got
  s.lact.drained += req   // asking counts as demand even if there is less to take
  return got
}
// ---- mana ----
function manaCap(s, r) {
  let c = s.mus[r] * MANA_PER_KG.mus + s.fat[r] * MANA_PER_KG.fat
  if (r === 'chest') c += s.gland * 2 / 1000 * MANA_PER_KG.gland
  return c
}
const fillOf = (s, rs) => {
  let m = 0, c = 0
  rs.forEach((r) => { m += s.mana[r]; c += manaCap(s, r) })
  return c ? m / c : 0
}
function manaInfuse(s, target, n) {
  const rs = target === 'all' ? REGIONS : [target]
  const free = {}
  let tot = 0
  rs.forEach((r) => { free[r] = Math.max(0, manaCap(s, r) - s.mana[r]); tot += free[r] })
  const add = Math.min(n, tot)
  if (tot > 0) rs.forEach((r) => { s.mana[r] += add * free[r] / tot })
  return { added: add, wasted: n - add }
}
function manaSpend(s, target, n) {
  const rs = target === 'all' ? REGIONS : [target]
  let tot = 0
  rs.forEach((r) => { tot += s.mana[r] })
  const spent = Math.min(n, tot)
  if (tot > 0) rs.forEach((r) => { s.mana[r] -= spent * s.mana[r] / tot })
  return { spent: spent, short: n - spent }
}
function setCurse(s, op, name, region) {
  const on = op === 'add'
  if (name === 'hunger') s.curses.hunger = on
  else if (name === 'forced') s.curses.forced = on
  else if (name === 'leech') s.curses.leech = on ? (region || 'chest') : ''
  else if (name === 'bias') s.curses.bias = on ? (region || 'chest') : ''
  return (on ? 'Cursed: ' : 'Curse lifted: ') + name + (on && region ? ' (' + region + ')' : '')
}

function measures(s) {
  const fatT = sum(s.fat), musT = sum(s.mus), weight = fatT + musT + s.other
  const m = { height: s.height, weight: weight, bodyfat: fatT / weight * 100 }
  MEAS.forEach((k) => {
    if (k === 'bust') return
    let v = s.start[k] + s.adj[k]
    const c = COEF[k]
    for (const r in c.fat) v += c.fat[r] * (s.fat[r] - s.fat0[r])
    for (const r in c.mus) v += c.mus[r] * (s.mus[r] - s.mus0[r])
    m[k] = clampN(v, LIMITS[k][0], LIMITS[k][1])
  })
  // bust = underbust plus the cup difference, which comes from breast volume
  m.bust = clampN(m.underbust + s.bustA * Math.pow(volume(s).total, 0.4) + s.adj.bust, LIMITS.bust[0], LIMITS.bust[1])
  return m
}
function cup(m) {
  const idx = Math.round((m.bust - m.underbust - 7.5) / 2.5)
  return (Math.round(m.underbust / 5) * 5) + CUPS[clampN(idx, 0, CUPS.length - 1)]
}

// Ability scores. Body based: STR, DEX, CON, CHA. Story based: INT, WIS.
function abilities(s, m) {
  const H2 = Math.pow(m.height / s.start.height, 2), bf = m.bodyfat
  const wm = s.mus.legs + s.mus.glutes + 1.3 * s.mus.arms + 1.2 * s.mus.chest + 0.9 * s.mus.core
  const wRatio = wm / (23.01 * H2 * (s.start.weight / 60))
  const coreLeg = (s.mus.core / s.mus0.core + s.mus.legs / s.mus0.legs) / 2
  const musRatio = sum(s.mus) / (22 * H2 * (s.start.weight / 60))
  const inRange = bf >= 18 && bf <= 30
  const dist = bf < 18 ? 18 - bf : bf > 30 ? bf - 30 : 0
  const n = s.fuelLog.length, steady = n ? s.fuelLog.reduce((a, c) => a + c, 0) / n : 0
  const raw = {}
  raw.str = 10 + (wm - 23.01 * H2 * (s.start.weight / 60)) * 0.6
  raw.dex = 10 + (26 - clampN(bf, 12, 45)) * 0.25 + 2 * (coreLeg - 1) / 0.6
  raw.con = 10 + (inRange ? 1 : -Math.min(5, dist * 0.3)) + (n >= 3 ? (steady - 0.5) * 3 : 0) + (musRatio - 1) * 3
  raw.int = 10
  raw.wis = 10
  const whr = m.waist / m.hips
  let shape = 0
  if (s.look === 'curvy') shape = 1 - Math.abs(whr - 0.68) / 0.15
  else if (s.look === 'athletic') shape = (clampN((wRatio - 1) / 0.3, -1, 1) + clampN(1 - Math.abs(bf - 20) / 15, -1, 1)) / 2
  else if (s.look === 'soft') shape = 1 - Math.abs(bf - 32) / 12
  shape = clampN(shape, -1, 1)
  raw.cha = 10 + 2 * shape + ((raw.str + raw.dex + raw.con) / 3 - 10) * 0.2
  // mana gives temporary bonuses; full breasts cost Dexterity
  const mb = { str: 3 * fillOf(s, ['arms', 'chest', 'legs']), dex: 3 * fillOf(s, ['core', 'glutes']), con: 2 * fillOf(s, REGIONS), int: 2 * fillOf(s, REGIONS), wis: 2 * fillOf(s, REGIONS), cha: 0 }
  const fillMilk = s.lact.stored / Math.max(1, milkCap(s))
  const pen = { dex: fillMilk > 0.95 ? 2 : fillMilk > 0.8 ? 1 : 0 }
  const out = {}
  AB.forEach((k) => {
    const perm = raw[k] + s.bonus[k], total = perm + mb[k] - (pen[k] || 0)
    out[k] = { perm: perm, total: total, score: clampN(Math.round(total), 3, 20) }
  })
  return out
}
const statLine = (a) => AB.map((k) => k.toUpperCase() + ' ' + a[k].score).join(', ')

