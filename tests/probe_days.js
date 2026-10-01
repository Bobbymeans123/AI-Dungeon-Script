// node tests/probe_days.js [cfg]  : 3 days at +1000 kcal for Whitney and Rue (a second sheet), prints weight, fat %, bra, look
const t = require('../bt_test.js')
const cfg = process.argv[2] || ''
const e = t.mk(cfg)
t.turn(e, ':sheet add Rue height=168 weight=54 bodyfat=18 underbust=72 bust=87 waist=60 hips=88 arm=24 thigh=49 gland=90 potential=200 pattern=even look=athletic', 'ok')
const grab = (who) => {
  const out = t.turn(e, ':body ' + who, 'ok').out
  const line = out.split('\n').filter((l) => l.indexOf(who) >= 0 && /kcal/.test(l)).pop() || ''
  const m = line.match(/([\d.]+) cm, ([\d.]+) kg, ([\d.]+)% fat \| bra (\S+)/)
  const need = Number((line.match(/\/([\d,]+) kcal/) || [0, '0'])[1].replace(/,/g, ''))
  return { kg: m && +m[2], fat: m && +m[3], bra: m && m[4], need: need }
}
const show = (tag) => { const w = grab('Whitney'), r = grab('Rue'); console.log(tag, 'Whitney', w.kg + ' kg', w.fat + '%', w.bra, '| Rue', r.kg + ' kg', r.fat + '%', r.bra) }
show('day 0')
for (let d = 1; d <= 3; d++) {
  for (const who of ['Whitney', 'Rue']) { const g = grab(who); t.turn(e, ':eat ' + (g.need + 1000) + ' ' + who, 'ok') }
  t.turn(e, ':day', 'ok')
  show('day ' + d)
}
const note = (e.state.memory && e.state.memory.authorsNote) || ''
console.log('Look lines:', (note.match(/Look:[^\]\n]*/g) || []).join(' || '))
