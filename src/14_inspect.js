// ---------- inspecting one body part ----------
function inspectPart(s, part) {
  const m = measures(s), a = abilities(s, m), H = m.height
  const dl = (v, base, dec) => (Math.abs(v - base) < 0.005 ? '' : ' (' + sgn(v - base) + (dec === 2 ? r2(v - base) : r1(v - base)) + ')')
  const musFat = (r) => 'muscle ' + r2(s.mus[r]) + ' kg' + dl(s.mus[r], s.mus0[r], 2) + ', fat ' + r2(s.fat[r]) + ' kg' + dl(s.fat[r], s.fat0[r], 2)
  const mana = (r) => 'Mana ' + Math.round(s.mana[r]) + ' of ' + Math.round(manaCap(s, r)) + '.'
  if (part === 'chest') {
    const c = chestCalc(s), V = c.V
    const cupIdx = clampN(Math.round((m.bust - m.underbust - 7.5) / 2.5), 0, CUPS.length - 1)
    let t = 'Chest inspection: ' + tier(LOOK_WORDS.bust, cupIdx) + ' bust, bra ' + cup(m) + ' (bust ' + r1(m.bust) + ' cm over underbust ' + r1(m.underbust) + ' cm). Each breast about ' + Math.round(V.total) + ' cc: glandular ' +
      Math.round(V.gland) + ' cc (' + Math.round(c.g * 100) + '% of tissue), fat ' + Math.round(V.fat) + ' cc (' + Math.round(V.fat / V.tissue * 100) + '%)' + (V.milk > 1 ? ', milk ' + Math.round(V.milk) + ' cc' : '') +
      '. ' + firmWord(c.firm).charAt(0).toUpperCase() + firmWord(c.firm).slice(1) + ' (firmness ' + Math.round(c.firm) + ' of 100), ' + sagWord(s.sag) + ' (sag ' + r1(s.sag) + ' of 3). Chest ' + musFat('chest') + '. '
    if (lactActive(s) || s.lact.stored > 1) t += 'Milk ' + Math.round(s.lact.stored) + ' of ' + Math.round(milkCap(s)) + ' ml stored, supply ' + Math.round(s.lact.sup * 100) + '%. '
    return t + mana('chest') + ' Glandular tissue can grow to about ' + Math.round(glandCeil(s)) + ' cc.'
  }
  if (part === 'arms') return 'Arm inspection: ' + tier(LOOK_WORDS.arm, m.arm / H) + ' arms, upper arm ' + r1(m.arm) + ' cm. Arms ' + musFat('arms') + '. ' + mana('arms') + ' Strength ' + a.str.score + '.'
  if (part === 'core') return 'Core inspection: ' + tier(LOOK_WORDS.waist, m.waist / m.hips) + ' waist, ' + r1(m.waist) + ' cm (waist to hip ' + r2(m.waist / m.hips) + '). Core ' + musFat('core') + '. ' + mana('core') + (s.fat.core / s.fat0.core >= 1.25 ? ' The belly is soft and rounded.' : s.fat.core / s.fat0.core <= 0.85 ? ' The stomach is flat.' : '')
  if (part === 'glutes') return 'Hip and glute inspection: ' + tier(LOOK_WORDS.hips, m.hips / H) + ' hips, ' + r1(m.hips) + ' cm. Glutes ' + musFat('glutes') + '. ' + mana('glutes') + (s.fat.glutes / s.fat0.glutes >= 1.2 ? ' Noticeably full.' : s.mus.glutes / s.mus0.glutes >= 1.1 ? ' Firm and rounded.' : '')
  if (part === 'legs') return 'Leg inspection: ' + tier(LOOK_WORDS.thigh, m.thigh / H) + ' thighs, ' + r1(m.thigh) + ' cm around. Legs ' + musFat('legs') + '. ' + mana('legs') + ' Dexterity ' + a.dex.score + '.'
  return 'Full inspection: ' + describeLook(s, m).replace(/^Look: /, '') + '. ' + r1(m.height) + ' cm, ' + r1(m.weight) + ' kg, body fat ' + r1(m.bodyfat) + '%, muscle ' + r1(sum(s.mus)) + ' kg, bra ' + cup(m) + '. Stats: ' + statLine(a) + '.'
}
function detectInspect(text) {
  const toks = tokensOf(text)
  const vi = findTok(toks, ['inspect', 'examine', 'scan', 'check', 'study', 'measure', 'look', 'see', 'view'])
  if (vi >= 0) {
    const strongVerb = findTok(toks, ['inspect', 'examine', 'scan', 'check', 'study', 'measure']) >= 0
    const words = Object.keys(PARTS).filter((w) => strongVerb || (w !== 'all' && w !== 'body'))   // "look at" only counts for a specific part
    for (let i = vi + 1; i < Math.min(toks.length, vi + 6); i++) {
      for (let k = 0; k < words.length; k++) {
        if (near(toks[i], words[k])) return PARTS[words[k]]
      }
    }
  }
  if (/\b(?:step|walk|stand|get)\w*\s+(?:into|in|under|inside)\s+the\s+(?:body\s+)?scanner\b/.test(normText(text))) return 'all'
  return ''
}

function extraAI(s) {
  const parts = [], L = s.lact
  if (lactActive(s) || L.stored > 1) parts.push('Milk ' + Math.round(L.stored / Math.max(1, milkCap(s)) * 100) + '% full' + (lactActive(s) ? ', lactating' : ''))
  const mf = fillOf(s, REGIONS)
  if (mf > 0.05) parts.push('Mana ' + Math.round(mf * 100) + '%')
  const cs = []
  if (s.curses.hunger) cs.push('hunger')
  if (s.curses.leech) cs.push('mana leech (' + RWORD[s.curses.leech] + ')')
  if (s.curses.forced) cs.push('forced milk')
  if (s.curses.bias) cs.push('growth bias (' + RWORD[s.curses.bias] + ')')
  if (cs.length) parts.push('Cursed: ' + cs.join(', '))
  return parts.length ? ' ' + parts.join('. ') + '.' : ''
}
function aiSummary(s, label) {
  const m = measures(s), a = abilities(s, m), c = chestCalc(s)
  return (label ? label : 'Body') + ': ' + r1(m.height) + ' cm, ' + r1(m.weight) + ' kg, ' + Math.round(m.bodyfat) + '% fat, bra ' + cup(m) + '. ' + (CFG.DESCRIBE ? describeLook(s, m) + '. ' : '') + (aiLine(s) === 'No notable changes yet' ? '' : aiLine(s) + '. ') +
    'Chest: about ' + Math.round(c.V.total) + ' cc each, ' + firmWord(c.firm) + ', ' + sagWord(s.sag) +
    '.' + extraAI(s) + ' Ate ' + fmt(s.eaten || 0) + ' of ' + fmt(need(s, m, s.burned)) + ' kcal today. Stats: ' + statLine(a) + '.'
}
function refreshMemory(recent) {
  const s = state.bt
  state.memory = state.memory || {}
  let note = state.bt_hideYou ? '' : '[' + aiSummary(s) + ']'
  // other tracked characters are described only while their name is in the recent story
  const mentioned = namesIn(recent || '')
  if (state.bt_hideYou && defKey() && mentioned.indexOf(defKey()) < 0) mentioned.unshift(defKey())   // the main character is always described
  mentioned.slice(0, CFG.NPC_MAX).forEach((k) => { note += ' [' + aiSummary(state.npcs[k], state.npcs[k].name) + ']' })
  if (note) note += ' [Never invent body measurements or changes; use only these numbers.]'
  if (state.bt_inspect) {
    const who = state.bt_inspectWho || '', t = sheetOf(who)
    if (t) note += ' [Describe this in detail using only these facts: ' + (who ? t.name + ': ' : '') + inspectPart(t, state.bt_inspect) + ']'
  }
  state.memory.authorsNote = note.trim()
  // the tag reminder goes at the very end of the context, where the AI pays the most attention
  if (CFG.TAG_HELP) {
    const F = CFG.FEATURES
    let t = '[Hidden tags: after any eating, exercise or sleeping, end your reply with tags and never mention them: [ate 600] kcal eaten, [burn 300] hard exercise, [train legs 2] (chest, arms, core, glutes, legs), [day] when a new day begins, [gland +20] or [bust +2] for magic only'
    if (F.milk) t += ', [lactating on] or [lactating off], [milk -300] drained'
    if (F.mana) t += ', [mana +30 arms] infused, [mana -20] spent'
    if (F.curses) t += ', [curse add hunger]'
    t += '.'
    const names = npcKeys().map((k) => state.npcs[k].name)
    if (names.length) t += ' Also tracked: ' + names.join(', ') + '. When a tag is about them, put their name last, like [ate 300 ' + names[0] + '].'
    state.memory.frontMemory = t + ']'
  } else {
    state.memory.frontMemory = ''
  }
}
function sheetText(s, label) {
  const m = measures(s), a = abilities(s, m), c = chestCalc(s)
  const list = (o) => REGIONS.map((r) => r + ' ' + r1(o[r])).join(', ')
  return 'BODY SHEET' + (label ? ': ' + label : '') + ' (updated by the script)\n' +
    'Day: ' + s.day + '\n' +
    'Height: ' + r1(m.height) + ' cm\n' +
    'Weight: ' + r1(m.weight) + ' kg\n' +
    'Body fat: ' + r1(m.bodyfat) + ' %\n' +
    'Bust: ' + r1(m.bust) + ' cm\n' +
    'Underbust: ' + r1(m.underbust) + ' cm\n' +
    'Waist: ' + r1(m.waist) + ' cm\n' +
    'Hips: ' + r1(m.hips) + ' cm\n' +
    'Arm: ' + r1(m.arm) + ' cm\n' +
    'Thigh: ' + r1(m.thigh) + ' cm\n' +
    'Bra: ' + cup(m) + '\n' +
    describeLook(s, m) + '\n' +
    'Glandular cc: ' + r1(s.gland) + '\n' +
    'Breast cc each: ' + Math.round(c.V.total) + ' (fat ' + Math.round(c.V.fat) + ')\n' +
    'Firmness: ' + Math.round(c.firm) + '\n' +
    'Sag: ' + r1(s.sag) + '\n' +
    'Potential cc: ' + r1(s.glandMax) + '\n' +
    'Milk ml: ' + Math.round(s.lact.stored) + ' / ' + Math.round(milkCap(s)) + ' (' + (lactActive(s) ? 'lactating' : 'not lactating') + ', supply ' + Math.round(s.lact.sup * 100) + '%)\n' +
    'Mana: ' + Math.round(REGIONS.reduce((t, r) => t + s.mana[r], 0)) + ' / ' + Math.round(REGIONS.reduce((t, r) => t + manaCap(s, r), 0)) + '\n' +
    'Curses: ' + ([s.curses.hunger && 'hunger', s.curses.leech && 'leech ' + s.curses.leech, s.curses.forced && 'forced milk', s.curses.bias && 'bias ' + s.curses.bias].filter(Boolean).join(', ') || 'none') + '\n' +
    'Stats: ' + statLine(a) + '\n' +
    'Muscle kg: ' + list(s.mus) + '\n' +
    'Fat kg: ' + list(s.fat) + '\n' +
    'Kcal today: ' + fmt(s.eaten || 0) + ' / ' + fmt(need(s, m, s.burned))
}
function sheetLine(s, label) {
  const m = measures(s), a = abilities(s, m)
  return (label ? label + ' | ' : '') + 'Day ' + s.day + ' | ' + r1(m.height) + ' cm, ' + r1(m.weight) + ' kg, ' + r1(m.bodyfat) + '% fat | bra ' + cup(m) +
    ', ' + Math.round(volume(s).total) + ' cc each | ' + statLine(a) + ' | ' + fmt(s.eaten || 0) + '/' + fmt(need(s, m, s.burned)) + ' kcal'
}
function statusLine(notes) {
  let touched = (state.bt_touched && state.bt_touched.length) ? state.bt_touched : [defKey()]
  touched = touched.filter((k, i) => touched.indexOf(k) === i && sheetOf(k))
  if (!touched.length) touched = [defKey()]
  const lines = touched.map((k) => '[' + sheetLine(sheetOf(k), nameOf(k)))
  let first = lines[0]
  if (state.bt_note) first += ' | ' + state.bt_note
  if (notes && notes.length) first += ' | ' + notes.join(', ')
  lines[0] = first
  let t = lines.map((l) => l + ']').join('\n')
  if (state.bt_help) t += '\n' + HELP
  return t
}

