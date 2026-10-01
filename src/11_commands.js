// ---------- commands typed by the player ----------
const CMD_RE = [
  ['sheetadd', /:sheet[ \t]+add[ \t]+([A-Za-z][\w\-]*)((?:[ \t]+\w+=[\w.\-]+)*)/i],
  ['sheetremove', /:sheet[ \t]+remove[ \t]+([A-Za-z][\w\-]*)/i],
  ['sheetlist', /:sheet[ \t]+list\b/i],
  ['sheetyou', /:sheet[ \t]+you[ \t]+(on|off)/i],
  ['set', /:set[ \t]+(\w+)[ \t]+(-?\d+(?:\.\d+)?)/i],
  ['undomeal', /:undo[ \t]+meal\b/i],
  ['eat',/:eat[ \t]+(\d+)/i],
  ['burn', /:burn[ \t]+(\d+)/i],
  ['train', /:train[ \t]+(chest|arms|core|glutes|legs)(?:[ \t]+([1-3]))?/i],
  ['day', /:day(?:[ \t]+(\d+))?\b/i],
  ['gland', /:gland[ \t]+([+-]?\d+)/i],
  ['potential', /:potential[ \t]+([+-]?\d+)/i],
  ['lactate', /:lactate[ \t]+(on|off)/i],
  ['milk', /:milk[ \t]+(\d+)/i],
  ['mana', /:mana[ \t]+([+-])(\d+)(?:[ \t]+(chest|arms|core|glutes|legs))?/i],
  ['curse', /:curse[ \t]+(add|remove)[ \t]+(hunger|leech|forced|bias)(?:[ \t]+(chest|arms|core|glutes|legs))?/i],
  ['support', /:support[ \t]+(on|off)/i],
  ['look', /:look[ \t]+(curvy|athletic|soft|off)/i],
  ['pace', /:pace[ \t]+(\d+(?:\.\d+)?)/i],
  ['reset', /:reset[ \t]+confirm/i],
  ['inspect', new RegExp(':(?:inspect|scan)(?:[ \\t]+' + PART_RE + ')?\\b', 'i')],
  ['body', /:body\b/i],
  ['help', /:help\b/i],
  ['probe', /:probe\b/i]   // only when CFG.PROBE is on (the custom build); otherwise the text is left alone
]
function parseCommand(text) {
  for (let i = 0; i < CMD_RE.length; i++) {
    if (CMD_RE[i][0] === 'probe' && !CFG.PROBE) continue
    const m = text.match(CMD_RE[i][1])
    if (m) return { name: CMD_RE[i][0], m: m, who: CMD_RE[i][0].indexOf('sheet') === 0 ? [] : whoIn(text) }
  }
  return null
}
const HELP = 'Other characters: :sheet add Name [weight=68 bodyfat=30 ...], :sheet remove Name, :sheet list, :sheet you off|on. Put a name on any command to target them, like :eat 600 Name. Commands: :set stat value, :eat kcal, :undo meal [Name], :burn kcal, :train area [1-3], :day [n], :gland +/-cc, :potential +/-cc, :lactate on/off, :milk ml, :mana +/-n [area], :curse add/remove hunger|leech|forced|bias [area], :support on/off, :look curvy/athletic/soft/off, :pace n, :inspect [chest|arms|core|glutes|legs|body], :scan, :body, :help. Stats: ' + STAT_KEYS.join(' ')
// key=value options of a sheet, shared by ":sheet add Name ..." and the Player setup card.
// Lenient (the :sheet add way): unknown or bad parts are ignored. strict: bad parts are collected in bad[] so they can be reported.
// Blank values ("height=") always mean "keep the default".
function parseSheetOpts(str, strict) {
  const st = {}, o = {}, bad = []
  String(str || '').trim().split(/\s+/).filter(Boolean).forEach((p) => {
    const i = p.indexOf('=')
    if (i < 0) { if (strict) bad.push(p); return }
    const key = p.slice(0, i).toLowerCase(), val = p.slice(i + 1)
    if (val === '') return
    if (key === 'muscle' || key === 'activity') {   // starting muscle multiplier (0.5-1.5) and activity factor (1.0-2.0)
      const lim = key === 'muscle' ? [0.5, 1.5] : [1.0, 2.0], n = parseFloat(val)
      if (/^\d+(?:\.\d+)?$/.test(val) && n >= lim[0] && n <= lim[1]) o[key] = n
      else if (strict) bad.push(p)
      return
    }
    if (key === 'pattern') { if (PATTERNS[val]) o.pattern = val; else if (strict) bad.push(p) }
    else if (key === 'look') { if (LOOKS.indexOf(val) >= 0) o.look = val; else if (strict) bad.push(p) }
    else if (key === 'name' && strict) { if (/^[A-Za-z][\w-]*$/.test(val)) o.name = val; else bad.push(p) }
    else if (CFG.START[key] !== undefined) {
      if (!strict) { if (!isNaN(parseFloat(val))) st[key] = parseFloat(val); return }
      const lim = LIMITS[key] || [0, 600], n = parseFloat(val)
      if (/^\d+(?:\.\d+)?$/.test(val) && n >= lim[0] && n <= lim[1]) st[key] = n
      else bad.push(p)
    } else if (strict) bad.push(p)
  })
  return { st: st, o: o, bad: bad }
}
function runCommand(cmd) {
  const key = (cmd.who && cmd.who[0]) || (cmd.name.indexOf('sheet') === 0 ? '' : defKey())
  const s = sheetOf(key), m = cmd.m
  let line = '\n> You take stock of your body.\n', note = ''
  state.bt_touched = [key]
  switch (cmd.name) {
    case 'set': {
      const k = m[1].toLowerCase()
      note = STAT_KEYS.indexOf(k) >= 0 ? applyOp(s, k, '=', parseFloat(m[2])) : 'Unknown stat "' + k + '"'
      break
    }
    case 'eat': {
      const n = Math.min(parseInt(m[1], 10), 5000)
      s.eaten = (s.eaten || 0) + n
      note = 'Ate ' + fmt(n) + ' kcal'
      line = '\n> You eat a meal.\n'
      break
    }
    case 'undomeal': {   // takes back the last meal the tracker counted by itself (once per meal)
      let keys
      if (cmd.who && cmd.who.length) keys = cmd.who   // ":undo meal Whitney" / ":undo meal Rue": only that person
      else {   // no name: the most recent auto-counted meal (a shared meal is taken back from everyone in it)
        const have = [''].concat(npcKeys()).filter((k) => sheetOf(k) && sheetOf(k).lastAuto)
        const top = Math.max.apply(null, have.map((k) => sheetOf(k).lastAuto.at || 0))
        keys = have.filter((k) => (sheetOf(k).lastAuto.at || 0) === top)
      }
      const done = []
      keys.forEach((k) => {
        const x = sheetOf(k)
        if (!x || !x.lastAuto) return
        x.eaten = Math.max(0, (x.eaten || 0) - x.lastAuto.kcal)
        done.push((nameOf(k) || 'You') + ': ' + x.lastAuto.label + ' (' + fmt(x.lastAuto.kcal) + ' kcal)')
        x.lastAuto = null
      })
      note = done.length ? 'Removed ' + done.join(' | ') : 'No auto-counted meal to remove'
      state.bt_touched = keys.length ? keys : [key]
      line ='\n> You think back over what you ate.\n'
      break
    }
    case 'burn': {
      const n = Math.min(parseInt(m[1], 10), 3000)
      s.burned += n
      note = 'Burned ' + fmt(n) + ' extra kcal'
      line = '\n> You work out.\n'
      break
    }
    case 'train': {
      const r = m[1].toLowerCase(), e = m[2] ? parseInt(m[2], 10) : 2
      s.train[r] = Math.min(4, s.train[r] + e)
      note = 'Trained ' + RWORD[r] + ' (effort ' + e + ')'
      line = '\n> You train your ' + RWORD[r] + '.\n'
      break
    }
    case 'day': {
      const n = m[1] ? parseInt(m[1], 10) : 1
      note = dayAll(n)
      state.bt_touched = [''].concat(npcKeys())
      line = n > 1 ? '\n> You rest while ' + clampN(n, 1, 30) + ' days pass.\n' : '\n> You go to sleep and wake up the next morning.\n'
      break
    }
    case 'gland': {
      const n = parseInt(m[1], 10)
      note = applyOp(s, 'gland', '+', n)
      break
    }
    case 'potential': note = applyOp(s, 'potential', '+', parseInt(m[1], 10)); break
    case 'lactate': s.lact.on = m[1].toLowerCase() === 'on'; note = 'Lactation ' + (s.lact.on ? 'on' : 'off'); break
    case 'milk': {
      const req = Math.min(parseInt(m[1], 10), 3000), got = drainMilk(s, req)
      note = 'Drained ' + Math.round(got) + ' ml'
      line = '\n> You drain some milk.\n'
      break
    }
    case 'mana': {
      note = doMana(s, m[1], parseFloat(m[2]), m[3] ? m[3].toLowerCase() : 'all')
      line = m[1] === '+' ? '\n> You channel mana into your body.\n' : '\n> You spend some mana.\n'
      break
    }
    case 'curse': {
      note = setCurse(s, m[1].toLowerCase(), m[2].toLowerCase(), m[3] ? m[3].toLowerCase() : '')
      line = m[1].toLowerCase() === 'add' ? '\n> You feel a curse take hold.\n' : '\n> You feel a curse lift.\n'
      break
    }
    case 'inspect': {
      const part = m[1] ? PARTS[m[1].toLowerCase()] : 'all'   // :scan on its own inspects everything
      state.bt_inspect = part
      state.bt_inspectWho = key
      note = 'Inspecting ' + part
      line = part === 'all' ? '\n> You step into the scanner.\n' : '\n> You inspect your ' + (part === 'core' ? 'midsection' : part) + ' closely.\n'
      break
    }
    case 'support': s.support = m[1].toLowerCase() === 'on'; note = 'Support ' + (s.support ? 'on' : 'off'); break
    case 'look': s.look = m[1].toLowerCase(); note = 'Look: ' + s.look; break
    case 'pace': s.pace = clampN(parseFloat(m[1]), 0.5, 10); s.paceSet = true; note = 'Growth pace ' + s.pace; break
    case 'reset': state.bt = newPlayer(); note = 'Tracker reset'; break
    case 'sheetadd': {
      const name = m[1], k = name.toLowerCase()
      const parsed = parseSheetOpts(m[2])
      const st = parsed.st, o = parsed.o
      o.name = name
      state.npcs[k] = newBT(st, o)
      note = 'Added a sheet for ' + name + (Object.keys(st).length ? ' (' + Object.keys(st).map((x) => x + ' ' + st[x]).join(', ') + ')' : '')
      line = '\n> You take a moment to think about ' + name + '.\n'
      state.bt_touched = [k]
      break
    }
    case 'sheetremove': {
      const k = m[1].toLowerCase()
      if (state.npcs[k]) { note = 'Removed the sheet for ' + state.npcs[k].name; delete state.npcs[k] } else note = 'No sheet for ' + m[1]
      state.bt_touched = ['']
      break
    }
    case 'sheetlist': note = 'Sheets: You' + npcKeys().map((k) => ', ' + state.npcs[k].name).join('') + (state.bt_hideYou ? ' (your own sheet is hidden)' : ''); state.bt_touched = ['']; break
    case 'sheetyou': state.bt_hideYou = m[1].toLowerCase() === 'off'; note = 'Your own sheet is ' + (state.bt_hideYou ? 'hidden' : 'shown'); state.bt_touched = ['']; break
    case 'probe': {   // changes no sheet: only writes the "probe" story card
      note = probeCard()
      line = '\n> You take a long look around.\n'
      break
    }
    case 'help': state.bt_help = true; break
    default: break   // body
  }
  const HANDLED = { eat: 'ate', burn: 'burn', train: 'train', day: 'day', milk: 'milk', mana: 'mana', lactate: 'lact', curse: 'curse' }
  if (HANDLED[cmd.name] && s && s.auto) s.auto[HANDLED[cmd.name]] = true   // so the AI's own tag for it is not counted twice
  return { line: line, note: (key && note && cmd.name.indexOf('sheet') !== 0 && cmd.name !== 'undomeal' ? labelOf(key) : '') + note, matched: m[0] }
}

