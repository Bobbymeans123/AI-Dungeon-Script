// ---------- shape and size adjectives ----------
// Each list is [upper limit, word]: the first limit the value falls under gives the word. Edit the words freely.
// 'average' entries are left out of the description, so it only mentions what stands out.
const LOOK_WORDS = {
  height: [[150, 'petite'], [158, 'short'], [168, 'average height'], [177, 'tall'], [184, 'very tall'], [999, 'towering']],   // cm
  build: [[14, 'very lean'], [19, 'lean'], [24, 'slim'], [30, 'medium'], [35, 'soft'], [41, 'plush'], [48, 'heavyset'], [999, 'very heavyset']],   // body fat %
  bust: [[2, 'flat'], [3, 'small'], [4, 'modest'], [5, 'full'], [6, 'large'], [8, 'very large'], [10, 'huge'], [99, 'enormous']],   // cup index (A = 2, B = 3, C = 4, D = 5)
  waist: [[0.66, 'very narrow'], [0.72, 'narrow'], [0.78, 'defined'], [0.85, 'soft'], [0.93, 'thick'], [9, 'wide']],   // waist / hips
  hips: [[0.50, 'narrow'], [0.56, 'slim'], [0.62, 'average'], [0.68, 'wide'], [0.75, 'very wide'], [9, 'broad']],   // hips / height
  thigh: [[0.27, 'slender'], [0.31, 'slim'], [0.36, 'average'], [0.41, 'thick'], [0.47, 'very thick'], [9, 'massive']],   // thigh / height
  arm: [[0.135, 'slender'], [0.155, 'slim'], [0.18, 'average'], [0.21, 'sturdy'], [9, 'thick']]   // upper arm / height
}
const tier = (table, v) => {
  for (let i = 0; i < table.length; i++) { if (v < table[i][0]) return table[i][1] }
  return table[table.length - 1][1]
}
function shapeName(m) {
  const whr = m.waist / m.hips, diff = (m.bust - m.hips) / m.hips
  if (whr > 0.85) return 'apple-shaped'
  if (whr <= 0.76 && Math.abs(diff) <= 0.08) return 'hourglass'
  if (diff < -0.08) return 'pear-shaped'
  if (diff > 0.08) return 'inverted-triangle'
  return 'straight'
}
function describeLook(s, m) {
  const H = m.height, bf = m.bodyfat
  const wr = (s.mus.legs + s.mus.glutes + 1.3 * s.mus.arms + 1.2 * s.mus.chest + 0.9 * s.mus.core) / (23.01 * Math.pow(H / s.start.height, 2) * (s.start.weight / 60))
  const prefix = wr >= 1.25 ? 'muscular' : wr >= 1.1 ? 'athletic' : wr >= 1.04 ? 'toned' : ''
  const build = (prefix ? prefix + ', ' : '') + tier(LOOK_WORDS.build, bf)
  const cupIdx = clampN(Math.round((m.bust - m.underbust - 7.5) / 2.5), 0, CUPS.length - 1)
  const extras = []
  const hw = tier(LOOK_WORDS.hips, m.hips / H), tw = tier(LOOK_WORDS.thigh, m.thigh / H), aw = tier(LOOK_WORDS.arm, m.arm / H)
  if (hw !== 'average') extras.push(hw + ' hips')
  if (tw !== 'average') extras.push(tw + ' thighs')
  if (aw !== 'average') extras.push(aw + ' arms')
  const lr = s.mus.legs / s.mus0.legs, ar = s.mus.arms / s.mus0.arms
  if (lr >= 1.12) extras.push('muscular legs'); else if (lr >= 1.04) extras.push('toned legs')
  if (ar >= 1.12) extras.push('muscular arms'); else if (ar >= 1.06) extras.push('toned arms')
  const gm = s.mus.glutes / s.mus0.glutes, gf = s.fat.glutes / s.fat0.glutes
  if (gf >= 1.2) extras.push('full glutes'); else if (gm >= 1.1) extras.push('firm, rounded glutes')
  const cf = s.fat.core / s.fat0.core, cm = s.mus.core / s.mus0.core
  if (cf >= 1.25) extras.push('soft belly'); else if (cf <= 0.85 && bf < 22) extras.push('flat stomach')
  if (cm >= 1.12 && bf < 20) extras.push('defined abs')
  return 'Look: ' + tier(LOOK_WORDS.height, H) + ', ' + build + ' ' + shapeName(m) + ' figure; ' + tier(LOOK_WORDS.bust, cupIdx) + ' bust; ' +
    tier(LOOK_WORDS.waist, m.waist / m.hips) + ' waist' + (extras.length ? '; ' + extras.join(', ') : '')
}

