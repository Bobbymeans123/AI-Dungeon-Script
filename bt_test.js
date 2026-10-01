// Test harness: node bt_test.js   (loads the Library + Input/Output like AI Dungeon does)
const fs = require('fs')
const rd = (f) => fs.readFileSync(__dirname + '/' + f, 'utf8')
const lib = rd(process.env.BT_LIB || 'bt_library_whitney.js')
const hooks = { in: rd('bt_input.js'), out: rd('bt_output.js') }
const patch = process.env.BT_CFG ? ';' + process.env.BT_CFG : ''   // e.g. "CFG.LAZY=true", appended after the Library

function run(kind, text, env) {
  const src = lib + patch + (/PRESET/.test(env.cfg) ? '' : ';CFG.HIDE_PLAYER = true;CFG.PLAYER = null;CFG.YOU_NAME = "";CFG.SILLY = false;CFG.LAZY = false') + (env.cfg ? ';' + env.cfg : '') + '\n' + hooks[kind].replace(/modifier\(text\)\s*$/, '') + '\nreturn modifier(text)'
  const cards = env.cards, add = (k, e, t) => cards.push({ keys: k, entry: e, type: t })
  const upd = (i, k, e, t) => { cards[i] = { keys: k, entry: e, type: t } }
  const rem = (i) => cards.splice(i, 1)
  return new Function('text', 'state', 'info', 'history', 'storyCards', 'addStoryCard', 'updateStoryCard', 'removeStoryCard', 'log', src)(
    text, env.state, { actionCount: env.count }, env.history.slice(), cards, add, upd, rem, () => {}).text
}
const mk = (cfg) => ({ state: {}, history: [], cards: [], count: 0, cfg: cfg || '' })
const fx = (n) => fs.readFileSync(__dirname + '/tests/fixtures/' + n + '.txt', 'utf8').trim()
const W = (env) => env.state.npcs.whitney

// one full turn: player input -> hooks -> AI reply -> hooks. Returns { inp, out }.
function turn(env, input, ai) {
  env.count++
  const inp = run('in', input, env)
  env.history.push({ text: inp, type: 'do' })
  const out = run('out', ai, env)
  env.history.push({ text: out, type: 'story' })
  return { inp, out }
}
// retry: same input, new AI reply for the same slot
function retry(env, ai) {
  env.history.pop()
  const out = run('out', ai, env)
  env.history.push({ text: out, type: 'story' })
  return out
}
// undo: step back one action, then play the same input again
function undo(env, input, ai) {
  env.history.pop(); env.history.pop(); env.count--
  return turn(env, input, ai)
}

module.exports = { mk, turn, retry, undo, run, W }

if (require.main === module) {
  let fail = 0
  const eq = (name, got, want) => { const ok = got === want; if (!ok) fail++; console.log((ok ? 'PASS ' : 'FAIL ') + name + ': ' + got + (ok ? '' : ' (want ' + want + ')')) }
  const fresh = (cfg) => { const e = mk(cfg); turn(e, 'You look around.', 'The room is quiet.'); return e }   // seeds sheets
  const kcal = (e) => W(e).eaten || 0

  let e = fresh()
  turn(e, 'You look around again.', 'Nothing happens.')
  eq('plain turn counts nothing', kcal(e), 0)

  e = fresh(); turn(e, 'Whitney eats a cake.', 'She finishes it. [ate 600]')
  eq('typed meal + AI tag counts once', kcal(e), 600)

  e = fresh(); turn(e, 'Whitney eats a cake.', 'She finishes it. [ate 600]'); retry(e, 'She licks her fingers. [ate 600]')
  eq('retry does not double', kcal(e), 600)

  e = fresh(); turn(e, 'Whitney eats a cake.', 'ok'); undo(e, 'Whitney eats a cake.', 'ok')
  eq('undo does not double', kcal(e), 600)

  e = fresh(); turn(e, ':eat 600 Whitney', 'She eats a big cake. [ate 600]')
  eq(':eat + AI tag counts once', kcal(e), 600)

  e = fresh(); turn(e, 'You look around.', 'She eats. [ate 600] and later [ate 600]')
  eq('AI-only: repeated identical tag counts once', kcal(e), 600)

  e = fresh(); turn(e, 'You look around.', 'She eats a cake [ate 600] and a pizza [ate 285].')
  eq('AI-only: two different foods both count', kcal(e), 885)

  e = fresh(); turn(e, 'You look around.', 'Whitney eats a cake. [ate 600]'); retry(e, 'Whitney eats a cake. [ate 600]')
  eq('AI-only: retry does not double', kcal(e), 600)

  e = fresh(); turn(e, 'Whitney eats a cake.', 'Whitney eats a cake and grabs a cake slice.')
  eq('typed meal + narrated meal counts once', kcal(e), 600)

  e = fresh(); turn(e, ':eat 700 Whitney', 'Whitney orders a big dinner and eats a burger.')
  eq(':eat + narrated meal counts once', kcal(e), 700)

  e = fresh(); turn(e, 'Whitney eats a cake.', 'She eats. [ate 600]'); turn(e, 'Whitney eats a pizza.', 'She eats. [ate 285]')
  eq('two separate turns both count', kcal(e), 885)

  e = fresh(); turn(e, 'You look around.', 'Whitney eats a pizza. [ate 285]')
  eq('AI-tag-only meal counts', kcal(e), 285)

  e = fresh(); turn(e, ':sheet add Rue weight=54', 'ok'); turn(e, 'Rue eats a pizza.', 'She eats. [ate 285 Rue]')
  eq('multi: Rue counts once, Whitney untouched', e.state.npcs.rue.eaten + '/' + kcal(e), '285/0')
  turn(e, 'You share a cake with Whitney and Rue.', 'ok')
  eq('multi: sharing reaches both (HIDE_PLAYER: no You sheet)', e.state.npcs.rue.eaten + '/' + kcal(e), '885/600')

  e = fresh(); const r = turn(e, 'Whitney eats a cake.', 'Fine.')
  eq('typed meal shows a status line', /\[Whitney \|/.test(r.out) ? 1 : 0, 1)
  // ---- step 2: meals narrated by the AI ----
  const note = (r) => (r.out.match(/Counted: [^\]|]*/) || [''])[0]
  e = fresh(); const r2 = turn(e, 'You look around.', 'Whitney orders a burger.')
  eq('narrated: counted, status says what and :undo meal', kcal(e) + ' ' + (note(r2) === 'Counted: Whitney ate a burger (~550 kcal). Type :undo meal to remove.'), '550 true')
  e = fresh(); turn(e, 'You look around.', 'She orders a burger.')
  eq('narrated: she/they with no name counts nothing', kcal(e), 0)
  e = fresh(); turn(e, 'You look around.', 'Whitney takes another bite of her burger, chews, savors it and finishes the fries.')
  eq('narrated: continuation wording counts nothing', kcal(e), 0)
  e = fresh(); turn(e, 'You look around.', 'Whitney orders a burger.'); retry(e, 'Whitney orders a burger.')
  eq('narrated: retry does not double', kcal(e), 550)
  e = fresh(); turn(e, 'You look around.', 'Whitney orders a burger.'); undo(e, 'You look around.', 'Whitney orders a burger.')
  eq('narrated: undo + replay does not double', kcal(e), 550)
  e = fresh(); turn(e, 'You look around.', 'Whitney orders a burger.'); turn(e, ':undo meal', 'ok'); const after1 = kcal(e)
  turn(e, ':undo meal', 'ok')
  eq(':undo meal removes it, a second one does nothing', after1 + '/' + kcal(e), '0/0')
  e = fresh(); turn(e, 'Whitney eats a burger.', 'Whitney grabs the burger and digs into it.')
  eq('typed + AI narrates same burger counts once', kcal(e), 550)

  e = fresh(); turn(e, 'You look around.', fx('burger_scene'))
  eq('burger_scene: Whitney once (burger + fries), no sheet for Rue', kcal(e) + '/' + Object.keys(e.state.npcs).join(','), '950/whitney')
  e = fresh("CFG.YOU_NAME = 'Rue'"); turn(e, ':sheet add Rue weight=54', 'ok'); turn(e, 'You look around.', fx('burger_scene'))
  eq('burger_scene with a Rue sheet: Whitney once, Rue once', kcal(e) + '/' + e.state.npcs.rue.eaten, '950/950')
  e = fresh(); turn(e, 'You look around.', fx('ice_cream_scene'))
  eq('ice_cream_scene: looking, wanting, proposing count nothing', kcal(e), 0)
  e = fresh(); turn(e, 'You look around.', fx('burger_1_order')); const t1 = kcal(e)
  turn(e, 'You keep eating.', fx('burger_2_bites')); const t2 = kcal(e)
  turn(e, 'You keep eating.', fx('burger_3_devour'))
  eq('burger over 3 replies: once in total (after each reply)', t1 + '/' + t2 + '/' + kcal(e), '950/950/950')
  e = fresh("CFG.YOU_NAME = 'Rue'"); turn(e, ':sheet add Rue weight=54', 'ok')
  for (const f of ['burger_1_order', 'burger_2_bites', 'burger_3_devour']) turn(e, 'You keep eating.', fx(f))
  eq('burger over 3 replies with a Rue sheet: Whitney once, Rue once', kcal(e) + '/' + e.state.npcs.rue.eaten, '950/950')
  e = fresh(); turn(e, 'You look around.', fx('burger_1_order'))
  for (let i = 0; i < 4; i++) turn(e, 'You wait.', 'Nothing.')
  turn(e, 'You wait.', 'Whitney orders another burger.')
  eq('same food after the cooldown counts again', kcal(e), 950 + 550)

  // ---- step 3: lazy mode (meal 700, snack 300, sweet 400, size words) ----
  const LZ = 'CFG.LAZY = true'
  const typed = (txt, cfg) => { const x = fresh(cfg || LZ); turn(x, txt, 'Fine.'); return kcal(x) }
  eq('lazy: plain "a burger" = 700', typed('Whitney eats a burger.'), 700)
  eq('lazy: massive double burger = 1,050', typed('Whitney eats a massive double burger.'), 1050)
  eq('lazy: small scoop of ice cream = 200', typed('Whitney eats a small scoop of ice cream.'), 200)
  eq('lazy: half a sundae = 200', typed('Whitney eats half a sundae.'), 200)
  eq('lazy: just a taste of cake = 200', typed('Whitney has just a taste of cake.'), 200)
  eq('lazy: fries alone = snack 300', typed('Whitney eats some fries.'), 300)
  eq('lazy: mountain of fries alone = 450', typed('Whitney eats a mountain of fries.'), 450)
  eq('lazy: two massive burgers capped at x2 = 1,400', typed('Whitney eats two massive burgers.'), 1400)
  eq('lazy: burger and a sundae = meal + sweet', typed('Whitney eats a burger and a sundae.'), 1100)
  eq('lazy: :eat 600 stays exact', typed(':eat 600 Whitney'), 600)
  eq('lazy OFF: massive double burger = step 2 number (550)', typed('Whitney eats a massive double burger.', 'CFG.LAZY = false'), 550)
  eq('Whitney preset: lazy mode is on (via SILLY)', typed('Whitney eats a burger.', '/*PRESET*/'), 700)
  e = fresh(LZ); const rl = turn(e, 'You look around.', fx('burger_scene'))
  eq('lazy: burger_scene = 1,050 once, status shows amount', kcal(e) + ' ' + /Whitney ate a double burger and fries \(~1,050 kcal\)\. Type :undo meal/.test(note(rl)), '1050 true')
  e = fresh(LZ + ";CFG.YOU_NAME = 'Rue'"); turn(e, ':sheet add Rue weight=54', 'ok'); turn(e, 'You look around.', fx('burger_scene'))
  eq('lazy: burger_scene with Rue: Whitney 1,050, Rue 700', kcal(e) + '/' + e.state.npcs.rue.eaten, '1050/700')
  e = fresh(LZ)
  for (const f of ['burger_1_order', 'burger_2_bites', 'burger_3_devour']) turn(e, 'You keep eating.', fx(f))
  eq('lazy: burger over 3 replies counts once', kcal(e), 1050)
  e = fresh(LZ); turn(e, 'You look around.', fx('ice_cream_scene'))
  eq('lazy: ice_cream_scene still counts nothing', kcal(e), 0)
  e = fresh(LZ); turn(e, 'You look around.', fx('burger_scene')); turn(e, ':undo meal', 'ok')
  eq('lazy: :undo meal removes the 1,050', kcal(e), 0)
  e = fresh(LZ); turn(e, 'You look around.', 'Whitney orders a massive double burger.'); retry(e, 'Whitney orders a massive double burger.')
  eq('lazy: retry of a narrated meal does not double', kcal(e), 1050)

  // ---- step 3b: food list expansion (lazy mode unless noted) ----
  const narr = (txt, cfg) => { const x = fresh(cfg || LZ); const r = turn(x, 'You look around.', txt); return { kcal: kcal(x), out: r.out } }
  const both = (name, item, want, narrVerb) => {   // typed "Whitney eats X." and narrated "Whitney orders X."
    eq(name + ' typed', typed('Whitney eats ' + item + '.'), want)
    eq(name + ' narrated', narr('Whitney ' + (narrVerb || 'orders') + ' ' + item + '.').kcal, want)
  }
  ;['steak', 'ribeye', 'sirloin', 'ribs', 'a pork chop', 'lamb chops', 'brisket', 'roast', 'meatballs', 'a kebab', 'a hot dog', 'sausage', 'wings', 'nuggets', 'fried chicken', 'bbq'].forEach((f) => both('meal ' + f, f, 700))
  ;['cotton candy', 'candy floss', 'candy', 'a donut', 'a doughnut', 'a churro', 'a funnel cake', 'a brownie', 'a cookie', 'pie', 'a waffle', 'a pancake', 'a caramel apple', 'fudge', "s'mores"].forEach((f) => both('sweet ' + f, f, 400))
  ;['popcorn', 'a pretzel', 'nachos', 'a corn dog'].forEach((f) => both('snack ' + f, f, 300))
  eq('steak and fries = one meal (700, not 700 + 450)', typed('Whitney eats steak and fries.'), 700)
  eq('steak and fries narrated = one meal', narr('Whitney orders steak and fries.').kcal, 700)
  eq('steak with meat and fries: "meat" not counted separately', narr('Whitney orders a steak, thick slabs of meat, with fries.').kcal, 700)
  eq('hot dog and fries = one meal', typed('Whitney eats a hot dog and fries.'), 700)
  // drinks keep real kcal, containers set the amount
  const dr = (txt) => typed('Whitney drinks ' + txt + '.')
  eq('can of soda = 150', dr('a can of soda'), 150)
  eq('glass of lemonade = 200', dr('a glass of lemonade'), 200)
  eq('cup of juice = 200', dr('a cup of juice'), 200)
  eq('bottle of cola = 210', dr('a bottle of cola'), 210)
  eq('1 L jug of soda = 420', dr('a 1 L jug of soda'), 420)
  eq('2-liter of soda = 840', dr('a 2-liter of soda'), 840)
  eq('2-liter bottle of soda = 840 (not 210)', dr('a 2-liter bottle of soda'), 840)
  eq('64 oz big gulp of soda = 800', dr('a 64 oz big gulp of soda'), 800)
  eq('big gulp of cola = 800', dr('a big gulp of cola'), 800)
  eq('glass of sweet tea = 200', dr('a glass of sweet tea'), 200)
  eq('can of energy drink = 150', dr('a can of energy drink'), 150)
  eq('giant cup of soda = 200 x 1.5 = 300', dr('a giant cup of soda'), 300)
  eq('two huge 2-liters of soda capped at x2 = 1,680', dr('two huge 2-liters of soda'), 1680)
  eq('narrated can of soda = 150', narr('Whitney orders a can of soda.').kcal, 150)
  eq('narrated 2-liter of soda = 840', narr('Whitney grabs a 2-liter of soda.').kcal, 840)
  eq('narrated: Whitney drinks a glass of lemonade = 200', narr('Whitney drinks a glass of lemonade.').kcal, 200)
  eq('LAZY off: can of soda = 150, plain soda still 140', typed('Whitney drinks a can of soda.', 'CFG.LAZY = false') + '/' + typed('Whitney drinks soda.', 'CFG.LAZY = false'), '150/140')
  // zero-kcal gag drinks: 0, never also plain soda, light status line
  ;['a diet soda', 'a diet coke', 'a coke zero', 'a zero sugar soda', 'a sugar-free soda', 'a club soda', 'a sparkling water'].forEach((d) => {
    const x = fresh(LZ); const r = turn(x, 'Whitney drinks ' + d + '.', 'Fine.')
    eq('gag typed ' + d + ' = 0 + line', kcal(x) + ' ' + /sipped .* \(0 kcal, very virtuous\)/.test(r.out), '0 true')
    const n = narr('Whitney grabs ' + d + '.')
    eq('gag narrated ' + d + ' = 0 + line', n.kcal + ' ' + /sipped .* \(0 kcal, very virtuous\)/.test(n.out), '0 true')
  })
  { const x = fresh(LZ); const r = turn(x, 'Whitney drinks water.', 'Fine.'); const n = narr('Whitney grabs water.')
    eq('plain water: 0 and NO status line (typed + narrated)', kcal(x) + ' ' + /sipped|virtuous|\[Whitney/.test(r.out) + ' ' + n.kcal + ' ' + /sipped|virtuous|\[Whitney/.test(n.out), '0 false 0 false') }
  eq('diet soda line text', (turn(fresh(LZ), 'Whitney drinks a diet soda.', 'Fine.').out.match(/Whitney sipped[^)]*\)/) || [''])[0], 'Whitney sipped a diet soda (0 kcal, very virtuous)')
  eq('diet soda LAZY off = 0 too', typed('Whitney drinks a diet soda.', 'CFG.LAZY = false'), 0)
  eq('diet soda with a burger: burger only', typed('Whitney eats a burger and drinks a diet soda.'), 700)
  eq('plain soda next to a diet soda still counts the plain one', typed('Whitney drinks a can of soda and a diet soda.'), 150)
  // look-alikes and typos count nothing
  ;[['baking soda', 'Whitney grabs baking soda.'], ['on a diet', 'Whitney is on a diet and grabs her bag.'], ['candy-colored', 'Whitney grabs her candy-colored bag.'],
    ['cookie-cutter', 'Whitney grabs a cookie-cutter.'], ['pie chart', 'Whitney grabs a pie chart.'], ['stake', 'Whitney grabs a stake.'], ['steal', 'Whitney grabs a steal.'], ['church', 'Whitney orders at the church.']].forEach(([n, t]) => {
    eq('false positive: ' + n + ' typed', typed(t), 0)
    eq('false positive: ' + n + ' narrated', narr(t.replace('grabs', 'orders')).kcal, 0)
  })
  eq('typo "steack" still reads as steak', typed('Whitney eats a steack.'), 700)
  // LAZY off numbers unchanged and fixtures
  eq('LAZY off: steak and fries = 450 + 400', typed('Whitney eats steak and fries.', 'CFG.LAZY = false'), 850)
  eq('LAZY off: pancake = 150 (unchanged)', typed('Whitney eats a pancake.', 'CFG.LAZY = false'), 150)
  e = fresh(LZ); turn(e, 'You look around.', fx('burger_scene')); const bs = kcal(e)
  e = fresh(LZ); turn(e, 'You look around.', fx('ice_cream_scene'))
  eq('fixtures still: burger_scene 1,050 and ice_cream_scene 0', bs + '/' + kcal(e), '1050/0')

  // ---- step 4: silly preset (3 days at +1,000 kcal for Whitney and Rue) ----
  const RUE = ':sheet add Rue height=168 weight=54 bodyfat=18 underbust=72 bust=87 waist=60 hips=88 arm=24 thigh=49 gland=90 potential=200 pattern=even look=athletic'
  const stats = (x, who) => {   // weight, fat %, bra from the status line of :body
    const line = turn(x, ':body ' + who, 'ok').out.split('\n').filter((l) => l.indexOf(who) >= 0 && /kcal/.test(l)).pop() || ''
    const m = line.match(/([\d.]+) cm, ([\d.]+) kg, ([\d.]+)% fat \| bra (\w+)/)
    return { kg: +m[2], fat: +m[3], bra: m[4], need: +(line.match(/\/([\d,]+) kcal/)[1].replace(/,/g, '')) }
  }
  const sim = (cfg, pre, flip) => {   // returns the weights after each day plus the end stats
    const x = fresh(cfg); turn(x, RUE, 'ok'); if (pre) turn(x, pre, 'ok')
    const kg = { Whitney: [stats(x, 'Whitney').kg], Rue: [stats(x, 'Rue').kg] }
    for (let d = 1; d <= 3; d++) {
      if (flip && d === 2) x.cfg = flip
      ;['Whitney', 'Rue'].forEach((w) => turn(x, ':eat ' + (stats(x, w).need + 1000) + ' ' + w, 'ok'))
      turn(x, ':day', 'ok')
      ;['Whitney', 'Rue'].forEach((w) => kg[w].push(stats(x, w).kg))
    }
    return { kg: kg, w: stats(x, 'Whitney'), r: stats(x, 'Rue') }
  }
  const off = sim('CFG.SILLY = false'), on = sim('CFG.SILLY = true')
  const desc = (o) => 'W ' + o.w.kg + 'kg ' + o.w.fat + '% ' + o.w.bra + ' | R ' + o.r.kg + 'kg ' + o.r.fat + '% ' + o.r.bra
  eq('SILLY off: old numbers unchanged', desc(off), 'W 105.4kg 34.2% 95D | R 54.4kg 18.4% 70B')
  eq('SILLY on: visible after 3 days', desc(on), 'W 107.3kg 35.2% 95D | R 56.3kg 21% 75B')
  const steps = (a) => a.slice(1).map((v, i) => +(v - a[i]).toFixed(1))
  eq('SILLY on is gradual: each day +0.5..1.0 kg', [].concat(steps(on.kg.Whitney), steps(on.kg.Rue)).every((d) => d >= 0.5 && d <= 1.0), true)
  eq('SILLY on: Whitney per-day steps', steps(on.kg.Whitney).join(','), '0.8,0.8,0.7')
  const p2 = sim('CFG.SILLY = true', ':pace 2 Whitney')
  eq(':pace 2 under SILLY overrides (Whitney less, Rue unchanged)', (p2.w.kg - 105).toFixed(1) + ' < ' + (on.w.kg - 105).toFixed(1) + ' / Rue ' + p2.r.kg, '0.8 < 2.3 / Rue 56.3')
  const fl = sim('CFG.SILLY = true', '', 'CFG.SILLY = false')
  eq('turning SILLY off mid-way restores the old rate (day 1 silly, days 2-3 normal)', steps(fl.kg.Whitney).join(','), '0.8,0.1,0.1')
  // the real Whitney preset: Rue is your sheet
  e = fresh('/*PRESET*/'); const rs = turn(e, ':body', 'ok').out
  eq('preset: Rue shows her own stats (168 cm, 54 kg, 18% fat, 70B, DEX 13), not 165/60', /168 cm, 54 kg, 18% fat \| bra 70B[^|]*\| [^|]*DEX 13/.test(rs) && !/165 cm|60 kg/.test(rs), true)
  e = fresh('/*PRESET*/'); turn(e, 'You go to sleep for the night.', 'Morning comes.')
  eq('sleep advances both characters together', e.state.bt.day + '/' + e.state.npcs.whitney.day, '2/2')
  e = fresh('/*PRESET*/'); turn(e, 'You look around.', fx('burger_scene'))
  eq('preset: burger_scene Whitney 1,050, Rue (player sheet) 700', e.state.npcs.whitney.eaten + '/' + e.state.bt.eaten, '1050/700')
  e = fresh('/*PRESET*/'); turn(e, 'You eat a burger.', 'Fine.')
  eq('preset: unnamed typed meal goes to Rue', e.state.bt.eaten + '/' + (e.state.npcs.whitney.eaten || 0), '700/0')

  // ---- step 4b: named status lines, sharing, :undo meal by name (the real preset: Rue is you, Whitney is a character) ----
  const P = '/*PRESET*/'
  const both2 = (x) => (x.state.bt.eaten || 0) + '/' + (x.state.npcs.whitney.eaten || 0)   // Rue/Whitney
  const lines = (r) => r.out.split('\n').filter((l) => l.charAt(0) === '[')
  e = fresh(P)
  eq('status line names Rue ("[Rue |") for an unnamed :body', /^\[Rue \| Day/.test(lines(turn(e, ':body', 'ok'))[0]), true)
  eq('status line names Whitney ("[Whitney |")', /^\[Whitney \| Day/.test(lines(turn(e, ':body Whitney', 'ok'))[0]), true)
  eq('status line names Rue when she is named', /^\[Rue \| Day/.test(lines(turn(e, ':body Rue', 'ok'))[0]), true)
  eq('a meal by both: two named lines', lines(turn(e, 'Rue and Whitney share cake.', 'ok')).map((l) => l.split(' |')[0]).sort().join(','), '[Rue,[Whitney')
  eq('label stays short (name + one bar only)', lines(turn(fresh(P), ':body', 'ok'))[0].length - lines(turn(fresh('CFG.HIDE_PLAYER = false;CFG.PLAYER = null;CFG.YOU_NAME = ""'), ':body', 'ok'))[0].length < 12, true)
  // sharing: typed and narrated, each gets a share, not the whole meal twice
  ;[['Rue and Whitney share cake.', '200/200'], ['Whitney and Rue split a sundae.', '200/200'], ['We share fries.', '150/150'], ['Whitney and I share a sundae.', '200/200'], ['Whitney and Rue each eat a burger.', '700/700']].forEach(([txt, want]) => {
    e = fresh(P); turn(e, txt, 'Fine.')
    eq('share typed "' + txt + '" (Rue/Whitney)', both2(e), want)
    e = fresh(P); turn(e, 'You look around.', txt)
    eq('share narrated "' + txt + '"', both2(e), want)
  })
  e = fresh(P); turn(e, 'Rue eats a burger.', 'Fine.')
  eq("Rue's own name targets her sheet (Rue 700, Whitney 0)", both2(e), '700/0')
  e = fresh(P); turn(e, ':eat 500 Rue', 'Fine.')
  eq(':eat 500 Rue goes to Rue', both2(e), '500/0')
  e = fresh(P); turn(e, 'You look around.', 'Rue orders a burger.')
  eq('narrated "Rue orders a burger" goes to Rue', both2(e), '700/0')
  eq('normal mode (not lazy): sharing still gives each the full amount', (() => { const x = fresh(P + ';CFG.SILLY = false'); turn(x, 'Rue and Whitney share cake.', 'ok'); return both2(x) })(), '600/600')
  // :undo meal by name
  e = fresh(P); turn(e, 'Rue eats a burger.', 'ok'); turn(e, 'Whitney eats a pizza.', 'ok')
  turn(e, ':undo meal Rue', 'ok'); const u1 = both2(e)
  turn(e, ':undo meal Rue', 'ok'); const u2 = both2(e)
  turn(e, ':undo meal Whitney', 'ok')
  eq(':undo meal Rue removes only Rue; again does nothing; then Whitney', u1 + ' ' + u2 + ' ' + both2(e), '0/700 0/700 0/0')
  e = fresh(P); turn(e, 'Whitney eats a pizza.', 'ok'); turn(e, 'Rue eats a burger.', 'ok')
  turn(e, ':undo meal Whitney', 'ok')
  eq(':undo meal Whitney removes only Whitney (Rue was more recent)', both2(e), '700/0')
  e = fresh(P); turn(e, 'Whitney eats a pizza.', 'ok'); turn(e, 'Rue eats a burger.', 'ok')
  turn(e, ':undo meal', 'ok'); const n1 = both2(e)
  turn(e, ':undo meal', 'ok'); const n2 = both2(e)
  turn(e, ':undo meal', 'ok')
  eq(':undo meal with no name: most recent first (Rue), then Whitney, then nothing', n1 + ' ' + n2 + ' ' + both2(e), '0/700 0/0 0/0')
  e = fresh(P); turn(e, 'You look around.', 'Whitney orders a burger.'); turn(e, 'You look around.', 'Rue orders a pizza.'); turn(e, ':undo meal Whitney', 'ok')
  eq('undo by name works on narrated meals too', both2(e), '700/0')
  e = fresh(P); turn(e, 'Rue and Whitney share cake.', 'ok'); turn(e, ':undo meal', 'ok')
  eq(':undo meal with no name takes a shared meal back from both', both2(e), '0/0')
  e = fresh(P); turn(e, 'Rue and Whitney share cake.', 'ok'); turn(e, ':undo meal Whitney', 'ok')
  eq(':undo meal Whitney leaves Rue her share', both2(e), '200/0')

  console.log(fail ? fail + ' FAILED' : 'all passed')
  process.exit(fail ? 1 : 0)
}
