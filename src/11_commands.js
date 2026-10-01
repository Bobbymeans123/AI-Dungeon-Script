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
  ['help', /:help\b/i]
]
function parseCommand(text) {
  for (let i = 0; i < CMD_RE.length; i++) {
    const m = text.match(CMD_RE[i][1])
    if (m) return { name: CMD_RE[i][0], m: m, who: CMD_RE[i][0].indexOf('sheet') === 0 ? [] : namesIn(text) }
  }
  return null
}
const HELP = 'Other characters: :sheet add Name [weight=68 bodyfat=30 ...], :sheet remove Name, :sheet list, :sheet you off|on. Put a name on any command to target them, like :eat 600 Name. Commands: :set stat value, :eat kcal, :undo meal, :burn kcal, :train area [1-3], :day [n], :gland +/-cc, :potential +/-cc, :lactate on/off, :milk ml, :mana +/-n [area], :curse add/remove hunger|leech|forced|bias [area], :support on/off, :look curvy/athletic/soft/off, :pace n, :inspect [chest|arms|core|glutes|legs|body], :scan, :body, :help. Stats: ' + STAT_KEYS.join(' ')
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
      if (s.lastAuto) { s.eaten = Math.max(0, (s.eaten || 0) - s.lastAuto.kcal); note = 'Removed ' + s.lastAuto.label + ' (' + fmt(s.lastAuto.kcal) + ' kcal)'; s.lastAuto = null }
      else note = 'No auto-counted meal to remove'
      line = '\n> You think back over what you ate.\n'
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
      const st = {}, o = {}
      String(m[2] || '').trim().split(/\s+/).filter(Boolean).forEach((p) => {
        const kv = p.split('=')
        const key2 = kv[0].toLowerCase(), val = kv[1]
        if (key2 === 'pattern' && PATTERNS[val]) o.pattern = val
        else if (key2 === 'look' && LOOKS.indexOf(val) >= 0) o.look = val
        else if (CFG.START[key2] !== undefined && !isNaN(parseFloat(val))) st[key2] = parseFloat(val)
      })
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
    case 'help': state.bt_help = true; break
    default: break   // body
  }
  const HANDLED = { eat: 'ate', burn: 'burn', train: 'train', day: 'day', milk: 'milk', mana: 'mana', lactate: 'lact', curse: 'curse' }
  if (HANDLED[cmd.name] && s && s.auto) s.auto[HANDLED[cmd.name]] = true   // so the AI's own tag for it is not counted twice
  return { line: line, note: (key && note && cmd.name.indexOf('sheet') !== 0 ? labelOf(key) : '') + note, matched: m[0] }
}

