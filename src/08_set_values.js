// ---------- setting values ----------
function currentValue(s, k) {
  if (AB.indexOf(k) >= 0) return abilities(s, measures(s))[k].perm
  if (k === 'gland') return s.gland
  if (k === 'potential') return s.glandMax
  if (k === 'sag') return s.sag
  return measures(s)[k]
}
function setValue(s, k, v) {
  if (AB.indexOf(k) >= 0) { s.bonus[k] += v - currentValue(s, k); return }
  if (k === 'gland') { s.gland = clampN(v, 0, 600); return }
  if (k === 'potential') { s.glandMax = clampN(v, 0, 600); return }
  if (k === 'sag') { s.sag = clampN(v, 0, 3); return }
  v = clampN(v, LIMITS[k][0], LIMITS[k][1])
  const m = measures(s)
  if (k === 'height') s.height = v
  else if (k === 'weight') s.other = Math.max(5, s.other + (v - m.weight))
  else if (k === 'bodyfat') {
    const d = m.weight * v / 100 - sum(s.fat)
    const w = distWeights(s, d >= 0)
    REGIONS.forEach((r) => { s.fat[r] = Math.max(0.2, s.fat[r] + d * w[r]) })
    s.other = Math.max(5, s.other - d)
  } else s.adj[k] += v - m[k]
}
function applyOp(s, k, op, n) {
  const old = currentValue(s, k)
  setValue(s, k, op === '+' ? old + n : op === '-' ? old - n : n)
  const now = currentValue(s, k)
  if (AB.indexOf(k) >= 0) return k.toUpperCase() + ' ' + Math.round(old) + ' to ' + Math.round(now)
  return (LABEL[k] || k) + ' ' + r1(old) + ' to ' + r1(now) + (UNIT[k] ? ' ' + UNIT[k] : '')
}

function doMana(s, sign, n, region) {
  n = Math.min(n, 2000)
  if (sign === '+') {
    const r = manaInfuse(s, region, n)
    return 'Mana +' + Math.round(r.added) + (region === 'all' ? '' : ' ' + region) + (r.wasted > 0.5 ? ' (' + Math.round(r.wasted) + ' wasted)' : '')
  }
  const r = manaSpend(s, region, n)
  return 'Mana -' + Math.round(r.spent) + (region === 'all' ? '' : ' ' + region) + (r.short > 0.5 ? ' (short by ' + Math.round(r.short) + ')' : '')
}

