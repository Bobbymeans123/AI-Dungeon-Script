// ---------- text for the AI, the card and the status line ----------
function aiLine(s) {
  const notes = []
  REGIONS.forEach((r) => {
    const mr = s.mus[r] / s.mus0[r], fr = s.fat[r] / s.fat0[r], w = RWORD[r]
    if (mr >= 1.12) notes.push([mr - 1, 'muscular ' + w])
    else if (mr >= 1.04) notes.push([mr - 1, 'toned ' + w])
    if (fr >= 1.25) notes.push([fr - 1, 'softer ' + w])
    else if (fr >= 1.08) notes.push([fr - 1, 'slightly fuller ' + w])
    else if (fr <= 0.75) notes.push([1 - fr, 'leaner ' + w])
    else if (fr <= 0.92) notes.push([1 - fr, 'slightly slimmer ' + w])
  })
  notes.sort((a, b) => b[0] - a[0])
  const txt = notes.slice(0, 4).map((n) => n[1]).join(', ')
  return txt ? txt.charAt(0).toUpperCase() + txt.slice(1) : 'No notable changes yet'
}
