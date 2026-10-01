// ============================================================
// BODY TRACKER for AI Dungeon: OUTPUT tab
// Reads the tags the AI writes ([ate 600] [burn 300] [train legs 2] [day] [gland +20] ...),
// updates the tracker, removes the tags from the visible text, and refreshes the story card.
// ============================================================
const modifier = (text) => {
  initBT()
  // retry: if this exact output slot was already processed, start again from the state before it
  takeSlot('bt_out')

  const parsed = parseTags(text)
  const notes = applyAll(parsed.events, true)   // skip what the input already counted
  resetAuto()
  let out = parsed.clean.trim() ? parsed.clean : text   // never return an empty reply
  if (notes.length) {
    state.message = notes.join(' | ')
    console.log(state.message)
  }

  refreshMemory(recentText(out))   // takes effect from the next action
  try { writeCard() } catch (e) { console.log('Body sheet card error: ' + e) }

  if (CFG.STATUS === 'always' || (CFG.STATUS === 'commands' && state.bt_flag)) {
    out = out.replace(/\s+$/, '') + '\n\n' + statusLine(notes)
  }
  if (state.bt_inspect) {
    const who = state.bt_inspectWho || '', t = sheetOf(who)
    if (t) out = out.replace(/\s+$/, '') + '\n\n[' + (who ? t.name + ' - ' : '') + inspectPart(t, state.bt_inspect) + ']'
  }
  return { text: out }
}

// Don't modify this part
modifier(text)
