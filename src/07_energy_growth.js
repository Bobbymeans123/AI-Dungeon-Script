// ---------- energy and growth ----------
const leanMass = (s, m) => m.weight - sum(s.fat)
const need = (s, m, burn) => {
  const base = (370 + 21.6 * leanMass(s, m)) * CFG.ACTIVITY
  return Math.round(base + (burn || 0) + milkCost(s) + (s.curses.hunger ? base * 0.25 : 0))
}

// where fat lands (gain) or leaves (loss: the stubborn areas empty last)
function distWeights(s, gain) {
  const p = PATTERNS[s.pattern] || PATTERNS.pear
  let w = {}
  if (gain) w = Object.assign({}, p)
  else {
    let tot = 0
    REGIONS.forEach((r) => { w[r] = 1 / p[r]; tot += w[r] })
    REGIONS.forEach((r) => { w[r] /= tot })
  }
  const b = s.curses.bias   // growth bias curse: new fat lands here, and leaves here last
  if (b) {
    if (gain) REGIONS.forEach((r) => { w[r] = 0.4 * w[r] + (r === b ? 0.6 : 0) })
    else {
      w[b] *= 0.3
      let t = 0
      REGIONS.forEach((r) => { t += w[r] })
      REGIONS.forEach((r) => { w[r] /= t })
    }
  }
  return w
}

function advanceDay(s, useLogged) {
  const m0 = measures(s)
  const eaten = useLogged ? s.eaten : null
  const burned = useLogged ? s.burned : 0
  const nd = need(s, m0, burned)
  const net = eaten === null ? 0 : eaten - nd
  if (eaten !== null) {
    s.fuelLog.push(Math.abs(eaten / nd - 1) <= 0.25 ? 1 : 0)
    if (s.fuelLog.length > 14) s.fuelLog.shift()
  }
  const scale = CFG.SILLY ? paceOf(s) : 1   // SILLY: body change (fat and lean, gain and loss) is scaled by the pace, so a few days show. :pace n changes it
  const deltaKg = net / CFG.KCAL_PER_KG * scale
  const share = net >= 0 ? fatGain() : CFG.FAT_LOSS
  const fatD = deltaKg * share
  const w = distWeights(s, fatD >= 0)
  REGIONS.forEach((r) => { s.fat[r] = Math.max(0.3, s.fat[r] + fatD * w[r]) })
  s.other = Math.max(8, s.other + deltaKg * (1 - share))

  // muscle grows where you trained, and shrinks a little elsewhere in a hard deficit
  const fuel = eaten === null ? 0.6 : net >= 200 ? 1 : net >= -300 ? 0.6 : 0.25
  const musBefore = sum(s.mus)
  const grew = []
  REGIONS.forEach((r) => {
    const t = useLogged ? s.train[r] : 0
    if (t > 0) {
      const room = Math.max(0, 1 - (s.mus[r] / s.mus0[r] - 1) / 0.6)
      const g = s.mus[r] * 0.0011 * t * fuel * room * paceOf(s)
      s.mus[r] += g
      if (g > 0) grew.push(RWORD[r])
    } else if (net < -500) {
      s.mus[r] -= s.mus[r] * 0.0004 * (-net / 500)
    }
  })
  const musD = sum(s.mus) - musBefore

  // milk: supply follows demand, storage fills, and full breasts leak and slow down
  const L = s.lact, rateMax = milkRateMax(s), capT = milkCap(s)
  let leaked = 0
  if (lactActive(s)) {
    L.demand = 0.7 * L.demand + 0.3 * L.drained
    let target = clampN(L.demand / rateMax, 0.15, 1)
    if (s.curses.forced) target = Math.max(target, 0.6)
    L.sup += (target - L.sup) * 0.25
  } else {
    L.sup *= 0.85
    L.demand *= 0.7
    L.stored *= 0.8   // unused milk is slowly reabsorbed
    if (L.sup < 0.01) L.sup = 0
    if (L.stored < 0.5) L.stored = 0
  }
  const prod = rateMax * L.sup
  L.stored += prod
  if (L.stored > capT) { leaked = L.stored - capT; L.stored = capT; L.sup *= 0.92 }
  // glandular tissue adapts: grows under sustained high demand, shrinks back after a week of low demand
  const ratio = rateMax > 0 ? L.demand / rateMax : 0
  if (lactActive(s) && ratio > 0.9 && s.gland < glandCeil(s)) s.gland = Math.min(glandCeil(s), s.gland * (1 + 0.004 * paceOf(s)))
  L.lowDays = ((lactActive(s) && ratio >= 0.3) || s.curses.forced) ? 0 : L.lowDays + 1
  if (L.lowDays >= 7 && s.gland > s.gland0) s.gland = Math.max(s.gland0, s.gland * 0.993)
  L.drained = 0

  // mana fades fast; a leech curse refills one area and turns overflow into lasting tissue
  REGIONS.forEach((r) => { s.mana[r] *= (1 - MANA_DECAY) })
  if (s.curses.leech) {
    const r = s.curses.leech, cap = manaCap(s, r), add = cap * 0.7, space = cap - s.mana[r]
    if (add <= space) s.mana[r] += add
    else {
      s.mana[r] = cap
      const over = add - space
      if (r === 'chest') s.gland = Math.min(600, s.gland + over * 0.05)
      else s.mus[r] += over * 0.0008
    }
  }

  // strain on the breast tissue: fast tissue change, heavy volume and full breasts all add sag
  const v1 = volume(s)
  const rate = Math.abs(v1.tissue - s.volPrev) / s.volPrev * 100
  const heavy = Math.max(0, v1.total - 500) / 500
  const fillM = L.stored / Math.max(1, capT)
  const engorge = fillM > 0.8 ? (fillM - 0.8) / 0.2 * 0.02 : 0
  s.sag = clampN(s.sag + (0.015 * heavy + 0.02 * rate + engorge) * (s.support ? 0.5 : 1), 0, 3)
  s.volPrev = v1.tissue

  s.day++
  s.eaten = null
  s.burned = 0
  s.train = zero()

  const milkTxt = lactActive(s) ? ', milk +' + Math.round(prod) + ' ml' + (leaked > 1 ? ' (' + Math.round(leaked) + ' leaked)' : '') : ''
  if (eaten === null) return 'Day ' + (s.day - 1) + ': nothing logged, assumed maintenance' + milkTxt
  let rep = 'Day ' + (s.day - 1) + ': ate ' + fmt(eaten) + ', needed ' + fmt(nd) + ' (' + sgn(net) + fmt(net) + ' kcal)'
  if (Math.abs(musD) >= 0.005) rep += ', muscle ' + sgn(musD) + r2(musD) + ' kg' + (grew.length ? ' in ' + grew.join(', ') : '')
  return rep + milkTxt
}
function advanceDays(s, n) {
  n = clampN(Math.round(n), 1, 30)
  let rep = advanceDay(s, true)
  for (let i = 1; i < n; i++) advanceDay(s, false)
  if (n > 1) rep += ' (+' + (n - 1) + ' more days at maintenance)'
  return rep
}

