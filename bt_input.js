// ============================================================
// BODY TRACKER for AI Dungeon: INPUT tab
// Commands: :set stat value, :eat 600, :burn 300, :train legs 2, :day, :day 3,
//           :gland +20, :support on/off, :look curvy/athletic/soft/off, :pace 3, :body, :help
// ============================================================
const modifier = (text) => {
  initBT()
  // undo: if we have been at this exact moment before, go back to how the tracker was then
  takeSlot('bt_in')
  state.bt_dbg = { count: typeof info !== 'undefined' ? info.actionCount : null, history: typeof history !== 'undefined' && history ? history.length : null }

  resetAuto()
  state.bt_touched = []
  state.bt_inspectWho = ''
  readCard()

  state.bt_flag = false
  state.bt_inspect = ''
  state.bt_help = false
  state.bt_note = ''
  const cmd = parseCommand(text)
  if (cmd) {
    const res = runCommand(cmd)
    // keep what the player wrote around the command; use a plain line if nothing else is left
    const rest = text.replace(res.matched, '')
    const meaningful = rest.replace(/[\s>."]|You( say)?/gi, '')
    text = meaningful.length > 2 ? rest.replace(/[ \t]+(?=[\n.,!?"]|$)/g, '') : res.line
    state.bt_note = res.note
    state.bt_flag = true
    state.message = res.note
  } else {
    delete state.message
    // no command: look for eating, exercise or sleep in what the player wrote
    const part = CFG.AUTO ? detectInspect(text) : ''
    if (part) { state.bt_inspect = part; state.bt_inspectWho = namesIn(text)[0] || defKey(); state.bt_flag = true; state.bt_touched = [state.bt_inspectWho] }
    const spotted = autoDetectAll(text)
    if (spotted.notes.length) {
      if (spotted.touched.length) state.bt_touched = spotted.touched
      state.bt_note = spotted.notes.join(' | ')
      state.bt_flag = true
      state.message = state.bt_note
    }
  }

  if (state.bt_cardNote) {   // the Player setup card was applied (or had a bad value): say so in the status line
    state.bt_note = (state.bt_note ? state.bt_note + ' | ' : '') + state.bt_cardNote
    state.bt_flag = true
    state.bt_cardNote = ''
  }
  refreshMemory(recentText(text))
  return { text }
}

// Don't modify this part
modifier(text)
