// ---------- small helpers ----------
// effective settings (SILLY bundles lazy meals, a faster pace and more forgiving fat gain)
const lazyOn = () => !!(CFG.LAZY || CFG.SILLY)
const paceOf = (s) => (s.paceSet ? s.pace : (CFG.SILLY ? CFG.SILLY_PACE : CFG.PACE))   // :pace n sets s.pace and s.paceSet
const fatGain = () => (CFG.SILLY ? CFG.SILLY_FAT_GAIN : CFG.FAT_GAIN)
const r1 = (v) => Math.round(v * 10) / 10
const r2 = (v) => Math.round(v * 100) / 100
const clampN = (v, a, b) => Math.min(b, Math.max(a, v))
const sum = (o) => REGIONS.reduce((t, r) => t + o[r], 0)
const zero = () => ({ chest: 0, arms: 0, core: 0, glutes: 0, legs: 0 })
const copy = (o) => JSON.parse(JSON.stringify(o))
const fmt = (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
const sgn = (v) => (v >= 0 ? '+' : '')

