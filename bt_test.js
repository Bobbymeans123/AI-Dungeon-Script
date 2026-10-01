// Test harness: node bt_test.js   (loads the Library + Input/Output like AI Dungeon does)
const fs = require('fs')
const rd = (f) => fs.readFileSync(__dirname + '/' + f, 'utf8')
const libs = {}   // the built Library to test: the Rue build (default) or build 'custom' (bt_library_whitney_custom.js)
const libOf = (build) => libs[build || ''] || (libs[build || ''] = rd(build === 'custom' ? 'bt_library_whitney_custom.js' : (process.env.BT_LIB || 'bt_library_whitney.js')))
const hooks = { in: rd('bt_input.js'), out: rd('bt_output.js') }
const patch = process.env.BT_CFG ? ';' + process.env.BT_CFG : ''   // e.g. "CFG.LAZY=true", appended after the Library

function run(kind, text, env) {
  const src = libOf(env.build) + patch + (/PRESET/.test(env.cfg) ? '' : ';CFG.HIDE_PLAYER = true;CFG.PLAYER = null;CFG.YOU_NAME = "";CFG.SILLY = false;CFG.LAZY = false') + (env.cfg ? ';' + env.cfg : '') + '\n' + hooks[kind].replace(/modifier\(text\)\s*$/, '') + '\nreturn modifier(text)'
  const cards = env.cards, add = (k, e, t) => cards.push({ keys: k, entry: e, type: t })
  const upd = (i, k, e, t) => { cards[i] = { keys: k, entry: e, type: t } }
  const rem = (i) => cards.splice(i, 1)
  return new Function('text', 'state', 'info', 'history', 'storyCards', 'addStoryCard', 'updateStoryCard', 'removeStoryCard', 'log', src)(
    text, env.state, Object.assign({ actionCount: env.count }, env.info || {}), env.history.slice(), cards, add, upd, rem, () => {}).text
}
const mk = (cfg, build) => ({ state: {}, history: [], cards: [], count: 0, cfg: cfg || '', build: build || '' })
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
  const fresh = (cfg, build) => { const e = mk(cfg, build); turn(e, 'You look around.', 'The room is quiet.'); return e }   // seeds sheets
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

  // ---- second preset: build "custom" (Whitney + a default player sheet, no Rue) ----
  const C = (cfg) => fresh('/*PRESET*/' + (cfg || ''), 'custom')
  const pw = (x) => (x.state.bt.eaten || 0) + '/' + (x.state.npcs.whitney.eaten || 0)   // player/Whitney
  e = C()
  eq('custom: only Whitney is a named sheet, no Rue', Object.keys(e.state.npcs).join(','), 'whitney')
  eq('custom: a default player sheet exists (165 cm, 60 kg, no name)', /165 cm, 60 kg/.test(turn(e, ':body', 'ok').out) && e.state.bt.name === '', true)
  const customSrc = rd('bt_library_whitney_custom.js'), rueSrc = rd('bt_library_whitney.js')
  eq("custom build has none of Rue's stats (name, bust 87, underbust 72, dex 13, CFG.PLAYER)", !/name: 'Rue'|bust: 87|underbust: 72|dex: 13|CFG\.PLAYER = \{|YOU_NAME = '/.test(customSrc), true)
  eq('(sanity) the Rue build does have them', /name: 'Rue'/.test(rueSrc) && /bust: 87/.test(rueSrc), true)
  e = C(); turn(e, 'You eat a burger.', 'Fine.')
  eq('custom: "You eat a burger" counts for the player only', pw(e), '700/0')
  e = C(); turn(e, 'Whitney eats a burger.', 'Fine.')
  eq('custom: "Whitney eats a burger" counts only for Whitney', pw(e), '0/700')
  e = C(); const cn = turn(e, 'You look around.', 'You order a burger and settle in.')
  eq('custom: narrated "You order ..." goes to the player, status says You', pw(e) + ' ' + /Counted: You ate a burger \(~700 kcal\)\. Type :undo meal/.test(cn.out), '700/0 true')
  e = C(); turn(e, 'You look around.', 'Whitney orders a burger.')
  eq('custom: narrated "Whitney orders ..." goes only to Whitney', pw(e), '0/700')
  ;[['We share fries.', '150/150'], ['Whitney and I share a sundae.', '200/200']].forEach(([txt, want]) => {
    e = C(); turn(e, txt, 'Fine.'); eq('custom: share typed "' + txt + '" (player/Whitney)', pw(e), want)
    e = C(); turn(e, 'You look around.', txt); eq('custom: share narrated "' + txt + '"', pw(e), want)
  })
  e = C(); turn(e, 'You eat a burger.', 'ok'); turn(e, 'Whitney eats a pizza.', 'ok'); turn(e, ':undo meal Whitney', 'ok')
  eq('custom: :undo meal Whitney removes only Whitney', pw(e), '700/0')
  e = C(); turn(e, 'You eat a burger.', 'ok'); turn(e, 'Whitney eats a pizza.', 'ok'); turn(e, ':undo meal', 'ok'); const cu1 = pw(e)
  turn(e, ':undo meal', 'ok')
  eq('custom: :undo meal with no name removes the most recent first, then the player', cu1 + ' ' + pw(e), '700/0 0/0')
  e = C(); turn(e, ':set height 170', 'ok'); turn(e, ':set weight 60', 'ok')
  eq(':set fills in the player sheet (170 cm, 60 kg), Whitney untouched', /170 cm, 60 kg/.test(turn(e, ':body', 'ok').out) && /196 cm, 105 kg/.test(turn(e, ':body Whitney', 'ok').out), true)
  e = C(); turn(e, 'You go to sleep for the night.', 'Morning comes.')
  eq('custom: sleep advances both', e.state.bt.day + '/' + e.state.npcs.whitney.day, '2/2')
  e = C(); turn(e, ':body', 'ok'); const seeded = JSON.stringify(Object.keys(e.state.npcs)) + e.state.bt_hideYou
  eq('custom: your sheet is shown (HIDE_PLAYER false), SILLY is on (burger = 700)', seeded + ' ' + (() => { const x = C(); turn(x, 'You eat a burger.', 'ok'); return x.state.bt.eaten })(), '["whitney"]undefined 700')
  e = C(); turn(e, 'You look around.', fx('burger_scene'))
  eq('custom: burger_scene: Whitney 1,050, "You order ..." goes to the player (700)', pw(e), '700/1050')
  e = C(); turn(e, 'You look around.', fx('ice_cream_scene'))
  eq('custom: ice_cream_scene counts nothing', pw(e), '0/0')

  // ---- :probe (custom build only) ----
  const sheets = (x) => JSON.stringify([x.state.bt, x.state.npcs], (k, v) => (k === 'auto' ? undefined : v))
  const probes = (x) => x.cards.filter((c) => c.keys === 'probe')
  e = C(); const before = sheets(e); const pr = turn(e, ':probe', 'ok')
  const card = (probes(e)[0] || {}).entry || ''
  eq('probe: writes one story card with keys "probe", type "Probe"', probes(e).length + ' ' + (probes(e)[0] || {}).type, '1 Probe')
  eq('probe: card lists info, state keys, history[0] and the last entries', /PROBE written/.test(card) && /actionCount = \d/.test(card) && /state keys \(names only\)/.test(card) && /history\[0\] type=do, length=\d+/.test(card) && /You look around\./.test(card) && /--- story cards:/.test(card), true)
  eq('probe: says state.character / state.player are absent', /state\.character: absent/.test(card) && /state\.player: absent/.test(card), true)
  eq('probe: changes no sheet', sheets(e) === before, true)
  eq('probe: the command is replaced by an in-story line and the status says so', /Probe card written/.test(pr.out) && pr.inp.indexOf(':probe') < 0, true)
  e = C(); e.state.character = { name: 'Zed', class: 'rogue' }; e.state.playerName = 'Zed'; turn(e, ':probe', 'ok')
  const card2 = (probes(e)[0] || {}).entry || ''
  eq('probe: shows state.character and a state key found by name when they exist', /state\.character: PRESENT = \{"name":"Zed","class":"rogue"\}/.test(card2) && /state\.playerName \(found by name\)|state\.playerName: PRESENT/.test(card2), true)
  e = C(); turn(e, ':probe', 'ok'); turn(e, ':probe', 'ok')
  eq('probe: running it again updates the same card (still one)', probes(e).length, 1)
  e = C(); for (let i = 0; i < 4; i++) turn(e, 'You wait.', 'Time passes.'); turn(e, ':probe', 'ok')
  eq('probe: shows history[0] and the last two entries (no more)', ((probes(e)[0] || {}).entry.match(/^history\[\d+\] type=/gm) || []).length, 3)
  e = fresh(); const rp = turn(e, ':probe', 'ok')
  eq('probe: the Rue build ignores :probe (no card, text left alone)', probes(e).length + ' ' + (rp.inp === ':probe'), '0 true')

  // ---- Player setup card (custom build only) ----
  const setupCard = (x) => x.cards.find((c) => c.type === 'Player setup')
  const TPL = 'name= height= weight= bodyfat= underbust= bust= waist= hips= pattern=even look=athletic gland= potential='
  const stat = (x) => { const o = turn(x, ':body', 'Time passes.').out; const l = lines({ out: o })[0] || ''; return { out: o, line: l, cm: (l.match(/([\d.]+) cm/) || [])[1], kg: (l.match(/([\d.]+) kg/) || [])[1], fat: (l.match(/([\d.]+)% fat/) || [])[1], head: (l.match(/^\[([^|]*)\|/) || [])[1] } }
  e = C()
  eq('card: created once on the first turn, type "Player setup", keys "playersetup", one-line template', e.cards.filter((c) => c.type === 'Player setup').length + ' ' + setupCard(e).keys + ' ' + (setupCard(e).entry === TPL) + ' ' + (setupCard(e).entry.indexOf('\n') < 0), '1 playersetup true true')
  turn(e, 'You wait.', 'ok'); turn(e, 'You wait.', 'ok')
  eq('card: not created again on later turns', e.cards.filter((c) => c.type === 'Player setup').length, 1)
  e = C(); const sNo = turn(e, 'You wait.', 'Time passes.').out
  eq('card: untouched template changes nothing visible (165 cm, 60 kg, no status noise)', /Player setup/.test(sNo) + ' ' + (e.state.bt.height || e.state.bt.start.height) + ' ' + e.state.bt.start.weight + ' ' + e.state.bt.pattern + ' ' + e.state.bt.look, 'false 165 60 even athletic')
  e = C(); const w0 = JSON.stringify(e.state.npcs.whitney, (k, v) => (k === 'auto' ? undefined : v))
  setupCard(e).entry = 'name=Zed height=170 weight=60 bodyfat=22 underbust=74 bust=90 waist=70 hips=96 pattern=even look=athletic gland=100 potential=180'
  let sc = stat(e)
  eq('card values reach the player sheet (170 cm, 60 kg, 22% fat, named Zed in the status line)', [sc.cm, sc.kg, sc.fat, (sc.head || '').trim()].join(' '), '170 60 22 Zed')
  eq('card: the edit is announced once in the status line', /Player setup applied: 12 values/.test(sc.out) + ' ' + /Player setup/.test(stat(e).out), 'true false')
  eq('card: Whitney is untouched', JSON.stringify(e.state.npcs.whitney, (k, v) => (k === 'auto' ? undefined : v)) === w0, true)
  eq('card: gland and potential applied', e.state.bt.gland + '/' + e.state.bt.glandMax, '100/180')
  turn(e, ':set weight 65', 'ok'); sc = stat(e)
  eq('card unchanged: it is NOT re-applied (a later :set weight 65 stays)', sc.kg, '65')
  setupCard(e).entry = setupCard(e).entry.replace('weight=60', 'weight=70'); sc = stat(e)
  eq('card edited: applied once (weight 70, height kept at 170)', sc.kg + ' ' + sc.cm, '70 170')
  turn(e, ':set weight 66', 'ok'); sc = stat(e)
  eq('card: after that edit, later :set changes stay (66)', sc.kg, '66')
  e = C(); setupCard(e).entry = 'weight=abc height=170 hight=180 bust=900 look=weird name=9bad'
  sc = stat(e)
  eq('bad values are skipped and named, good ones still apply', sc.cm + ' ' + sc.kg + ' ' + /Player setup skipped: weight=abc hight=180 bust=900 look=weird name=9bad/.test(sc.out) + ' ' + /Player setup applied: height/.test(sc.out), '170 60 true true')
  e = C(); setupCard(e).entry = 'weight 60'; sc = stat(e)
  eq('a part without "=" is skipped ("weight 60")', /Player setup skipped: weight/.test(sc.out) + ' ' + sc.kg, 'true 60')
  e = C(); setupCard(e).entry = TPL.replace('height=', 'height=185'); turn(e, 'You eat a burger.', 'ok'); const eatenBefore = e.state.bt.eaten
  setupCard(e).entry = 'weight=80'; sc = stat(e)
  eq('card edit mid-story applies like :set and keeps what happened (eaten kept, weight 80)', eatenBefore + ' ' + e.state.bt.eaten + ' ' + sc.kg + ' ' + sc.cm, '700 700 80 185')
  e = C(); setupCard(e).entry = 'name=Zed weight=60'; turn(e, 'You wait.', 'ok'); turn(e, 'Zed eats a burger.', 'ok'); turn(e, 'You look around.', 'You order a pizza and wait.')
  eq('a named player (Zed): typed "Zed eats" and narrated "You order" both go to the player (700 + 700)', pw(e), '1400/0')
  e = C(); setupCard(e).entry = 'weight=60 height=170'; turn(e, 'You wait.', 'ok')
  const undone = undo(e, 'You wait.', 'ok')
  eq('card applied in a turn that is then undone and replayed: still applied once', (e.state.bt.start.height) + ' ' + /Player setup/.test(undone.out), '170 true')
  e = C(); e.cards.splice(e.cards.indexOf(setupCard(e)), 1); turn(e, 'You wait.', 'ok'); turn(e, 'You wait.', 'ok')
  eq('card deleted by the player: not made again', e.cards.filter((c) => c.type === 'Player setup').length, 0)
  e = fresh(); turn(e, 'You wait.', 'ok')
  eq('Rue build: no Player setup card, Rue unchanged', e.cards.filter((c) => c.type === 'Player setup').length + ' ' + /168 cm, 54 kg, 18% fat/.test(turn(e, ':body', 'ok').out || ''), '0 false')
  e = fresh('/*PRESET*/'); turn(e, 'You wait.', 'ok')
  eq('Rue preset build: no Player setup card, Rue keeps 168 cm, 54 kg', e.cards.filter((c) => c.type === 'Player setup').length + ' ' + /168 cm, 54 kg, 18% fat/.test(turn(e, ':body', 'ok').out), '0 true')

  // ---- tag reminder: shorter, in the Author's Note, echo stripped ----
  const OLD_REMINDER_CHARS = 484   // the old reminder, ~121 tokens (characters / 4)
  e = fresh(P); const mem = e.state.memory
  const remind = mem.authorsNote.slice(mem.authorsNote.indexOf('[Hidden tags'))
  eq('reminder: lives in the Author\'s Note, frontMemory is empty', mem.authorsNote.indexOf('[Hidden tags') >= 0 && mem.frontMemory === '', true)
  eq('reminder: much shorter than the old 484 chars (now <= 230)', remind.length <= 230 && remind.length < OLD_REMINDER_CHARS / 2, true)
  eq('reminder: still teaches ate/burn/train/day/gland/milk/mana/curse and "name last"', /\[ate 600\].*\[burn 300\].*\[train legs 2\].*\[day\].*\[gland \+20\].*\[milk -300\].*\[mana \+30 arms\].*\[curse add hunger\].*name last, \[ate 300 Whitney\]/.test(remind), true)
  e = fresh(P + ';CFG.TAG_PLACE = "front"')
  eq('reminder: TAG_PLACE "front" puts it back in frontMemory only', e.state.memory.frontMemory.indexOf('[Hidden tags') === 0 && e.state.memory.authorsNote.indexOf('[Hidden tags') < 0, true)
  e = fresh(P + ';CFG.TAG_HELP = false')
  eq('reminder: TAG_HELP off = no reminder anywhere', e.state.memory.authorsNote.indexOf('[Hidden tags') < 0 && e.state.memory.frontMemory === '', true)
  // if the AI echoes the reminder, it is removed and its example tags are not counted
  const echo = remind
  e = fresh(P); const ec = turn(e, 'You wait.', 'The room is quiet.\n\n' + echo + '\n\nWhitney sits down.')
  eq('echo: the echoed reminder is removed from the reply, the story stays', /Hidden tags|\[ate 600\]/.test(ec.out) + ' ' + /The room is quiet\./.test(ec.out) + ' ' + /Whitney sits down\./.test(ec.out), 'false true true')
  eq('echo: its example tags count nothing ([ate 600] [burn 300] ...)', pw(e), '0/0')
  e = fresh(P); const ec2 = turn(e, 'You wait.', 'Whitney orders a burger. [ate 700 Whitney]\n\n' + echo)
  eq('echo: a real tag next to an echo still counts once (700)', pw(e) + ' ' + /Hidden tags/.test(ec2.out), '0/700 false')
  e = fresh(P); const ec3 = turn(e, 'You wait.', 'Story line one.\n[Hidden tags, never mention: after eating end with: [ate 600\nStory line two continues.')
  eq('echo: an unfinished echo drops only its own line', /Hidden tags/.test(ec3.out) + ' ' + /Story line one\./.test(ec3.out) + ' ' + /Story line two continues\./.test(ec3.out), 'false true true')
  e = fresh(P); const ec4 = turn(e, 'You wait.', 'She smiles [hidden TAGS: ate [ate 5] ] and waves.')
  eq('echo: matched without caring about case', /hidden tags|\[ate/i.test(ec4.out) + ' ' + /She smiles/.test(ec4.out) + ' ' + /and waves\./.test(ec4.out), 'false true true')

  // ---- state.placeholders seeding (custom build only) ----
  const QS = { name: 'character.name', gender: 'character.gender', height: 'Height in cm?', weight: 'Weight in kg?', build: 'Build? slim, average, curvy or athletic', activity: 'Activity? couch, active or runner', chest: 'Chest? small, average or large' }
  const asPH = (o) => Object.keys(o).map((k) => ({ question: QS[k], answer: o[k] }))
  const mkPH = (answers, build, cfg) => {   // a new adventure whose hooks see state.placeholders on the first turn
    const x = mk('/*PRESET*/' + (cfg || ''), build === undefined ? 'custom' : build)
    if (answers !== undefined) x.state.placeholders = Array.isArray(answers) || answers === null || typeof answers === 'string' ? answers : asPH(answers)
    x.firstOut = turn(x, 'You look around.', 'The room is quiet.').out
    return x
  }
  const FULL = { name: 'Zed', gender: 'female', height: '170', weight: '60', build: 'curvy', activity: 'runner', chest: 'large' }
  const ONE_LINE = 'Player sheet set from your answers: 170 cm, 60 kg, curvy, runner, large chest.'
  const kc = (x) => +(turn(x, ':body', 'ok').out.match(/\/([\d,]+) kcal/) || [0, '0'])[1].replace(/,/g, '')
  const wj = (x) => JSON.stringify(x.state.npcs.whitney, (k, v) => (k === 'auto' ? undefined : v))
  const base = mkPH(undefined)
  e = mkPH(FULL); sc = stat(e)
  eq('placeholders: full answer set reaches the player sheet (170 cm, 60 kg, 32% fat, named Zed)', [sc.cm, sc.kg, sc.fat, (sc.head || '').trim()].join(' '), '170 60 32 Zed')
  eq('placeholders: build curvy = pear + curvy, chest large = gland 130 / potential 300, gender remembered', [e.state.bt.pattern, e.state.bt.look, e.state.bt.gland, e.state.bt.glandMax, e.state.bt.gender].join(' '), 'pear curvy 130 300 female')
  eq('placeholders: runner = activity 1.5 and starting muscle x1.1', e.state.bt.activity + ' ' + e.state.bt.muscleMul, '1.5 1.1')
  eq('placeholders: one-line status after seeding (first turn)', e.firstOut.indexOf(ONE_LINE) >= 0, true)
  eq('placeholders: the line is not repeated on later turns', /Player sheet set/.test(turn(e, ':body', 'ok').out), false)
  eq('placeholders: Whitney is untouched', wj(e) === wj(base), true)
  eq('placeholders: YOU_NAME follows the name: "Zed eats" and narrated "You order" both go to the player', (() => { turn(e, 'Zed eats a burger.', 'ok'); turn(e, 'You look around.', 'You order a pizza.'); return pw(e) })(), '1400/0')
  const needs = {}, mus = {}
  ;['couch', 'active', 'runner'].forEach((a) => { const x = mkPH({ activity: a }); needs[a] = kc(x); mus[a] = x.state.bt.mus.legs })
  eq('activity: runner needs x1.111 of active, couch x0.889', (needs.runner / needs.active).toFixed(2) + ' ' + (needs.couch / needs.active).toFixed(2), '1.11 0.89')
  eq('activity: muscle low for couch (x0.85), default for active, a bit higher for runner (x1.1)', (mus.couch / mus.active).toFixed(2) + ' ' + (mus.runner / mus.active).toFixed(2), '0.85 1.10')
  eq('build words: slim 18% even athletic | average 24% even off | curvy 32% pear curvy | athletic 16% even athletic',
    ['slim', 'average', 'curvy', 'athletic'].map((b) => { const x = mkPH({ build: b }); return stat(x).fat + x.state.bt.pattern + x.state.bt.look }).join(' | '), '18evenathletic | 24evenoff | 32pearcurvy | 16evenathletic')
  eq('chest words: small 60/150, average 90/200, large 130/300 (gland/potential)', ['small', 'average', 'large'].map((c) => { const x = mkPH({ chest: c }); return x.state.bt.gland + '/' + x.state.bt.glandMax }).join(' '), '60/150 90/200 130/300')
  // partial answers
  e = mkPH({ height: '172' }); sc = stat(e)
  eq('partial: only height (172 cm), weight and everything else stay default, line says what was set', [sc.cm, sc.kg, e.state.bt.pattern, e.state.bt.gland].join(' ') + ' ' + (e.firstOut.indexOf('Player sheet set from your answers: 172 cm.') >= 0), '172 60 pear 90 true')
  e = mkPH({ build: 'athletic', chest: 'small' })
  eq('partial: build and chest only (no height/weight given: 165 cm, 60 kg)', stat(e).cm + ' ' + stat(e).kg + ' ' + (e.firstOut.indexOf('Player sheet set from your answers: athletic, small chest.') >= 0), '165 60 true')
  // units
  const ht = (a) => stat(mkPH({ height: a })).cm
  eq('height units', ['170', '170cm', '170 cm', '1.70 m', '1.7', "5'7", '5\'7"', '5 ft 7 in', '5ft7', '67 in', '5.7', 'tall', ''].map(ht).join(' '), '170 170 170 170 170 170.2 170.2 170.2 170.2 170.2 173.7 165 165')
  const wt = (a) => stat(mkPH({ weight: a })).kg
  eq('weight units', ['60', '60 kg', '60kg', '130 lb', '130lbs', '9 st 7', '9 stone 7 lb', 'abc', ''].map(wt).join(' '), '60 60 60 59 59 60.3 60.3 60 60')
  eq('clamps: height 300 -> 230, 50 -> 120, 0 -> default; weight 500 -> 250, 10 -> 30, 0 -> default', [ht('300'), ht('50'), ht('0'), wt('500'), wt('10'), wt('0')].join(' '), '230 120 165 250 30 60')
  // typos and wording
  eq('typos in build: curvey, atheltic, avrage, slimm, skinny', ['curvey', 'atheltic', 'avrage', 'slimm', 'skinny'].map((b) => stat(mkPH({ build: b })).fat).join(' '), '32 16 24 18 18')
  eq('typos in activity: runer, couchh, acitve', ['runer', 'couchh', 'acitve'].map((a) => { const x = mkPH({ activity: a }); return (x.state.bt.activity || 'default') }).join(' '), '1.5 1.2 default')
  eq('typos in chest: smal, larg, averge', ['smal', 'larg', 'averge'].map((c) => mkPH({ chest: c }).state.bt.gland).join(' '), '60 130 90')
  eq('question wording: case and extra spaces ignored', (() => { const x = mkPH([{ question: '  HEIGHT   in CM?', answer: ' 175 ' }, { question: 'CHARACTER.NAME', answer: 'zed' }]); return stat(x).cm + ' ' + x.state.bt.name })(), '175 zed')
  eq('name: one word only ("Mary Ann" -> Mary), and not an existing character ("Whitney" ignored)', mkPH({ name: 'Mary Ann' }).state.bt.name + ' ' + JSON.stringify(mkPH({ name: 'Whitney' }).state.bt.name), 'Mary ""')
  // nonsense and nothing
  e = mkPH({ height: 'banana', weight: 'lots', build: 'zzz', activity: 'qwerty', chest: 'wow' }); sc = stat(e)
  eq('nonsense answers: nothing changes (165 cm, 60 kg, no seeded mark, no status line, card is the plain template)', [sc.cm, sc.kg, String(e.state.bt.seeded), /Player sheet set/.test(e.firstOut), e.state.bt.pattern, (e.cards.find((c) => c.type === 'Player setup') || {}).entry === TPL].join(' '), '165 60 undefined false even true')
  ;[[undefined, 'none set'], [[], 'empty array'], [null, 'null'], ['oops', 'a string']].forEach(([ph, nm]) => {
    const x = mkPH(ph); const y = stat(x)
    eq('no usable placeholders (' + nm + '): nothing happens, build still works', y.cm + ' ' + y.kg + ' ' + /Player sheet set/.test(x.firstOut) + ' ' + x.state.bt.seeded, '165 60 false undefined')
  })
  e = mkPH({ gender: 'male' })
  eq('gender alone: remembered, no stat changes, no status line', [e.state.bt.gender, stat(e).cm, stat(e).kg, stat(e).fat, /Player sheet set/.test(e.firstOut)].join(' '), 'male 165 60 26 false')
  // once only: retry, undo, later :set, later placeholders
  e = mkPH(FULL); retry(e, 'The room is quiet.')
  eq('retry does not re-apply (still 170 cm, 60 kg, seeded once)', stat(e).cm + ' ' + stat(e).kg + ' ' + e.state.bt.seeded, '170 60 true')
  e = mkPH(FULL); const ud = undo(e, 'You look around.', 'The room is quiet.')
  eq('undo of the first turn and replay seeds exactly once (same sheet, line shown again)', stat(e).cm + ' ' + stat(e).kg + ' ' + (ud.out.indexOf(ONE_LINE) >= 0), '170 60 true')
  e = mkPH(FULL); turn(e, ':set weight 65', 'ok'); turn(e, 'You wait.', 'ok'); turn(e, 'You wait.', 'ok')
  eq('later :set changes are never overwritten by the answers', stat(e).kg, '65')
  turn(e, ':set height 175', 'ok'); const ud2 = undo(e, ':set height 175', 'ok')
  eq('undoing a later turn does not re-seed (65 kg stays, no seeding line)', stat(e).kg + ' ' + /Player sheet set/.test(ud2.out), '65 false')
  e = mkPH(undefined); turn(e, 'You eat a burger.', 'ok'); e.state.placeholders = asPH(FULL); turn(e, 'You wait.', 'ok')
  eq('placeholders that show up after the story has started are ignored (nothing to overwrite)', stat(e).cm + ' ' + stat(e).kg + ' ' + e.state.bt.eaten, '165 60 700')
  // card interplay
  e = mkPH(FULL)
  eq('Player setup card shows the seeded values and is not re-applied', (e.cards.find((c) => c.type === 'Player setup') || {}).entry + ' ' + /Player setup applied/.test(e.firstOut), 'name=Zed height=170 weight=60 bodyfat=32 underbust= bust= waist= hips= pattern=pear look=curvy gland=130 potential=300 false')
  e.cards.find((c) => c.type === 'Player setup').entry = e.cards.find((c) => c.type === 'Player setup').entry.replace('height=170', 'height=180'); sc = stat(e)
  eq('editing that card afterwards works and keeps the seeded build, activity and muscle', [sc.cm, sc.kg, e.state.bt.pattern, e.state.bt.activity, e.state.bt.muscleMul, e.state.bt.name].join(' '), '180 60 pear 1.5 1.1 Zed')
  // other builds
  e = mkPH(FULL, '')
  eq('Rue build ignores the placeholders (Rue stays 168 cm, 54 kg, no seeded mark)', stat(e).cm + ' ' + stat(e).kg + ' ' + e.state.bt.seeded + ' ' + e.state.bt.name, '168 54 undefined Rue')
  // :probe shows the placeholders, :sheet add takes muscle= and activity=
  e = mkPH(FULL); turn(e, ':probe', 'ok'); const pc = (probes(e)[0] || {}).entry || ''
  eq(':probe card lists the full state.placeholders (array of 7, every question and answer)', /--- state\.placeholders \(full\) ---/.test(pc) && /array of 7:/.test(pc) && /Height in cm\?/.test(pc) && /Build\? slim, average, curvy or athletic/.test(pc) && /"answer":"runner"/.test(pc), true)
  e = mkPH(undefined); turn(e, ':probe', 'ok')
  eq(':probe card says "none" without placeholders', /--- state\.placeholders \(full\) ---\nnone/.test((probes(e)[0] || {}).entry || ''), true)
  e = fresh(); turn(e, ':sheet add Bo muscle=1.2 activity=1.5', 'ok'); turn(e, ':sheet add Cy muscle=3 activity=9', 'ok'); turn(e, ':sheet add Di', 'ok')
  eq(':sheet add options: muscle= and activity= work, out-of-range ignored, plain :sheet add unchanged', [e.state.npcs.bo.muscleMul, e.state.npcs.bo.activity, e.state.npcs.cy.muscleMul, e.state.npcs.cy.activity, e.state.npcs.di.muscleMul, e.state.npcs.di.activity].map(String).join(' '), '1.2 1.5 1 undefined 1 undefined')

  // ---- player name lookup: (1) character.name, (2) "Your name?", (3) name= on the Player setup card ----
  const PHN = (a) => a.map(([q, v]) => ({ question: q, answer: v }))
  const CN = 'character.name', YN = 'Your name?'
  const mkName = (ph, cardName, build, info) => {   // a new adventure: placeholders, and optionally a Player setup card that already exists on turn 1
    const x = mk('/*PRESET*/', build === undefined ? 'custom' : build)
    if (ph !== undefined) x.state.placeholders = PHN(ph)
    if (info) x.info = info
    if (cardName !== undefined) x.cards.push({ keys: 'playersetup', entry: 'name=' + cardName + ' height= weight= bodyfat= underbust= bust= waist= hips= pattern=even look=athletic gland= potential=', type: 'Player setup' })
    x.firstOut = turn(x, 'You look around.', 'The room is quiet.').out
    return x
  }
  const nameOf1 = (x) => x.state.bt.name
  eq('name sources alone: character.name | "Your name?" | card name=', [mkName([[CN, 'Zed']]), mkName([[YN, 'Kay']]), mkName(undefined, 'Mo')].map(nameOf1).join(' '), 'Zed Kay Mo')
  e = mkName(undefined); e.cards.find((c) => c.type === 'Player setup').entry = 'name=Mo'; turn(e, ':body', 'ok')
  eq('card name= typed into the card later also names the player (card edit path)', nameOf1(e), 'Mo')
  eq('priority: all three -> character.name; "Your name?" + card -> Your name?; character.name + card -> character.name',
    [mkName([[CN, 'Zed'], [YN, 'Kay']], 'Mo'), mkName([[YN, 'Kay']], 'Mo'), mkName([[CN, 'Zed']], 'Mo'), mkName([[YN, 'Kay'], [CN, 'Zed']])].map(nameOf1).join(' '), 'Zed Kay Zed Zed')
  eq('an empty answer falls through to the next source (empty, spaces only, or nothing but punctuation)',
    [mkName([[CN, ''], [YN, 'Kay']]), mkName([[CN, '   '], [YN, 'Kay']]), mkName([[CN, '!!!'], [YN, 'Kay']]), mkName([[CN, ''], [YN, '']], 'Mo'), mkName([[CN, ''], [YN, '']])].map(nameOf1).join('|'), 'Kay|Kay|Kay|Mo|')
  eq('a name of Whitney (any case) is ignored and the next source is tried',
    [mkName([[CN, 'Whitney']]), mkName([[CN, 'whitney']]), mkName([[CN, 'Whitney'], [YN, 'Kay']]), mkName([[CN, 'Whitney'], [YN, 'WHITNEY']], 'Mo'), mkName(undefined, 'Whitney')].map(nameOf1).join('|'), '||Kay|Mo|')
  e = mkName(undefined, 'Whitney'); const wn = turn(e, ':body', 'ok').out
  eq('a card with name=Whitney is skipped and says so; later card edits to Whitney too', (/Player setup skipped: name=Whitney/.test(e.firstOut) ? 'told' : 'silent') + ' ' + JSON.stringify(nameOf1(e)), 'told ""')
  e = mkName(undefined); e.cards.find((c) => c.type === 'Player setup').entry = 'name=Whitney height=170'; const wn2 = turn(e, ':body', 'ok').out
  eq('editing the card to name=Whitney: skipped and reported, the rest still applies', /Player setup skipped: name=Whitney/.test(wn2) + ' ' + JSON.stringify(nameOf1(e)) + ' ' + stat(e).cm, 'true "" 170')
  eq('one-word cleanup: "Mary Ann" -> Mary, " zed!! " -> zed, "Kay Lee" (Your name?) -> Kay', [mkName([[CN, 'Mary Ann']]), mkName([[CN, ' zed!! ']]), mkName([[YN, 'Kay Lee']])].map(nameOf1).join(' '), 'Mary zed Kay')
  eq('question wording: case and extra spaces ignored ("  YOUR   NAME?  ", "character.NAME")', [mkName([['  YOUR   NAME?  ', 'Kay']]), mkName([['character.NAME', 'Zed']])].map(nameOf1).join(' '), 'Kay Zed')
  eq('info is not used: info.characters = [""] and info.characterNames = ["Kay"] give no name', JSON.stringify(nameOf1(mkName(undefined, undefined, undefined, { characters: [''], characterNames: ['Kay'] }))), '""')
  // the name is used everywhere
  ;[[[[CN, 'Zed']], undefined], [[[YN, 'Zed']], undefined], [undefined, 'Zed']].forEach(([ph, card], i) => {
    e = mkName(ph, card)
    turn(e, 'Zed eats a cake.', 'ok'); const typed1 = pw(e)
    turn(e, 'You look around.', 'Zed orders a burger.')
    eq('source ' + (i + 1) + ': typed "Zed eats a cake" and narrated "Zed orders a burger" target the player (400 + 700), not Whitney', typed1 + ' ' + pw(e), '400/0 1100/0')
    eq('source ' + (i + 1) + ': the status line is labelled "Zed" and the sheet is still the default body (165 cm, 60 kg)', (lines(turn(e, ':body', 'ok'))[0] || '').indexOf('[Zed |') === 0 && /165 cm, 60 kg/.test(turn(e, ':body', 'ok').out) && !/Player sheet set/.test(e.firstOut), true)
  })
  // never applied twice
  e = mkName([[CN, 'Zed']]); retry(e, 'The room is quiet.')
  eq('retry does not re-apply the name (Zed, seeded once)', nameOf1(e) + ' ' + e.state.bt.seeded, 'Zed true')
  e = mkName([[CN, 'Zed']]); undo(e, 'You look around.', 'The room is quiet.')
  eq('undo of the first turn and replay names the player exactly once', nameOf1(e) + ' ' + e.state.bt.seeded, 'Zed true')
  e = mkName([[CN, 'Zed']]); turn(e, 'You wait.', 'ok'); undo(e, 'You wait.', 'ok')
  eq('undoing a later turn keeps the name (no re-seed)', nameOf1(e), 'Zed')
  e = mkName([[CN, 'Zed']]); e.state.placeholders = PHN([[CN, 'Kay']]); turn(e, 'You wait.', 'ok'); turn(e, 'You wait.', 'ok')
  eq('changing the placeholders later does not rename the player (applied once)', nameOf1(e), 'Zed')
  e = mkName([[CN, 'Zed']]); e.cards.find((c) => c.type === 'Player setup').entry = e.cards.find((c) => c.type === 'Player setup').entry.replace('name=Zed', 'name=Mo'); turn(e, 'You wait.', 'ok'); turn(e, 'You wait.', 'ok')
  eq('an explicit card edit renames once and then stays (not reverted to the answer)', nameOf1(e), 'Mo')
  e = mkName(undefined, 'Mo')
  eq('card-name source on turn 1: the name is not announced as a separate change', /applied:[^|\]]*name/.test(e.firstOut) + ' ' + nameOf1(e), 'false Mo')
  // the Rue build is unchanged
  e = mkName([[CN, 'Zed'], [YN, 'Kay']], 'Mo', '')
  eq('Rue build ignores all of it (still Rue, no seeded mark)', nameOf1(e) + ' ' + e.state.bt.seeded, 'Rue undefined')

  // ---- COMMANDS.md: every documented example is run, and the doc must match the parser both ways ----
  const DOC = fs.readFileSync(__dirname + '/COMMANDS.md', 'utf8')
  const README = fs.existsSync(__dirname + '/README.md') ? fs.readFileSync(__dirname + '/README.md', 'utf8') : ''
  eq('README.md exists and links COMMANDS.md and PASTE.md', /\(COMMANDS\.md\)/.test(README) && /\(PASTE\.md\)/.test(README), true)
  // [setup turns [[typed, AI reply]], what to type, regexes the reply must match, text COMMANDS.md must contain, which build ('' = Rue build)]
  const EX = [
    [[], ':eat 600', [/Ate 600 kcal/]],
    [[['Whitney eats a burger.']], ':undo meal Whitney', [/Removed Whitney: a burger \(700 kcal\)/]],
    [[], ':undo meal', [/No auto-counted meal to remove/]],
    [[], ':burn 300', [/Burned 300 extra kcal/]],
    [[], ':train legs 2', [/Trained legs \(effort 2\)/]],
    [[], ':set weight 70', [/Weight 60 to 70 kg/]],
    [[], ':gland +20', [/Glandular tissue 90 to 110 cc each/]],
    [[], ':potential +50', [/Glandular potential 150 to 200 cc each/]],
    [[], ':lactate on', [/Lactation on/]],
    [[], ':milk 300', [/Drained 0 ml/]],
    [[], ':mana +30 arms', [/Mana \+\d+ arms/]],
    [[], ':curse add hunger', [/Cursed: hunger/]],
    [[], ':support off', [/Support off/]],
    [[], ':look athletic', [/Look: athletic/]],
    [[], ':pace 2', [/Growth pace 2/]],
    [[], ':sheet add Rue height=168 weight=54 bodyfat=18 pattern=even look=athletic', [/Added a sheet for Rue \(height 168, weight 54, bodyfat 18\)/]],
    [[], ':sheet add Bo muscle=1.2 activity=1.5', [/Added a sheet for Bo/]],
    [[[':sheet add Rue weight=54']], ':sheet remove Rue', [/Removed the sheet for Rue/]],
    [[], ':sheet list', [/Sheets: You, Whitney/]],
    [[], ':sheet you off', [/Your own sheet is hidden/]],
    [[], ':day', [/Day 1: nothing logged, assumed maintenance/]],
    [[], ':inspect chest', [/Inspecting chest/, /Chest inspection:/]],
    [[], ':scan', [/Inspecting all/, /Full inspection:/]],
    [[], ':body', [/^\[Day 1 \| 165 cm, 60 kg/m]],
    [[], ':help', [/Commands: :set stat value, :eat kcal/]],
    [[[':set weight 70']], ':reset confirm', [/Tracker reset/]],
    [[], ':probe', [/Probe card written \(story card "probe"\)/]],
    // detection examples: [setup, typed text, regexes, a phrase COMMANDS.md must contain]
    [[], 'You eat a burger.', [/\+700 kcal/], 'a burger and a sundae'],
    [[], 'You eat a massive double burger.', [/\+1,050 kcal/], 'A massive double burger is 1,050'],
    [[], 'You eat a small scoop of ice cream.', [/\+200 kcal/], 'a small scoop of ice cream is 200'],
    [[], 'You eat half a sundae.', [/\+200 kcal/], 'half a sundae is 200'],
    [[], 'You eat a burger and a sundae.', [/\+1,100 kcal/], 'a meal plus a sweet (1,100)'],
    [[], 'You eat steak and fries.', [/\+700 kcal/], 'steak and fries is one 700 meal'],
    [[], 'You drink a can of soda.', [/\+150 kcal/], 'a can of soda'],
    [[], 'You drink a 2-liter of soda.', [/\+840 kcal/], 'a 2-liter of soda'],
    [[], 'Whitney drinks a diet soda.', [/Whitney sipped a diet soda \(0 kcal, very virtuous\)/], 'Whitney sipped a diet soda (0 kcal, very virtuous)'],
    [[], 'You do squats.', [/Burned 300 kcal/, /Trained legs/], 'Burn is 150, 300 or 450 kcal'],
    [[], 'You do hard squats.', [/Burned 450 kcal/], 'hard, heavy, intense, brutal'],
    [[], 'You do light squats.', [/Burned 150 kcal/], 'light, easy, gentle, quick'],
    [[], 'You go to sleep for the night.', [/Day 1: nothing logged/], 'go to bed'],
    [[], 'You examine your chest.', [/Chest inspection:/], 'examine your chest'],
    [[], 'Whitney eats cake.', [/Whitney: \+400 kcal/], 'Whitney eats cake'],
    [[], 'We share fries.', [/\+150 kcal/], 'We share fries.'],
    [[], 'You wait.', [/Counted: Whitney ate a burger \(~700 kcal\)\. Type :undo meal to remove\./], 'Counted: Whitney ate a burger (~700 kcal). Type :undo meal to remove.', 'Whitney orders a burger.'],
    [[], 'name=Zed height=170 weight=60 bodyfat=22', [/Player setup applied: height, weight, bodyfat, name/], 'Player setup applied: height, weight, bodyfat, name', null, 'card']
  ]
  EX.forEach(([setup, input, res, mention, ai, mode]) => {
    const x = C(); setup.forEach((s) => turn(x, s[0], s[1] || 'Fine.'))
    let out
    if (mode === 'card') { x.cards.find((c) => c.type === 'Player setup').entry = input; out = turn(x, 'You wait.', 'ok').out }
    else out = turn(x, input, ai || 'Fine.').out
    const ok = res.every((r) => r.test(out)), inDoc = DOC.indexOf(mention || input) >= 0
    eq('COMMANDS.md example "' + input + (ai ? ' / AI: ' + ai : '') + '"' + (ok ? '' : '  reply was: ' + out.replace(/\n+/g, ' // ').slice(-200)) + (inDoc ? '' : '  NOT IN COMMANDS.md'), ok && inDoc, true)
  })
  e = fresh('/*PRESET*/', ''); turn(e, 'Rue and Whitney share cake.', 'ok')
  eq('COMMANDS.md sharing example: "Rue and Whitney share cake" gives 200 each (Rue build)', both2(e) + ' ' + (DOC.indexOf('"Rue and Whitney share cake" gives a 400 sweet as 200 each') >= 0), '200/200 true')
  e = mkPH({ height: '170', weight: '60', build: 'curvy', activity: 'runner' })
  eq('COMMANDS.md placeholder example line: "Player sheet set from your answers: 170 cm, 60 kg, curvy, runner."', (e.firstOut.indexOf('Player sheet set from your answers: 170 cm, 60 kg, curvy, runner.') >= 0) + ' ' + (DOC.indexOf('Player sheet set from your answers: 170 cm, 60 kg, curvy, runner.') >= 0), 'true true')
  e = C(); const tg = turn(e, 'You wait.', 'He eats. [ate 600] [burn 100]'); const tg2 = turn(e, 'You wait.', 'She eats. [ate 300 Whitney]')
  eq('COMMANDS.md tags: [ate 600] counts for your sheet, [ate 300 Whitney] for Whitney, and both are silent (no status line, tags removed)', pw(e) + ' ' + /\[Day/.test(tg.out + tg2.out) + ' ' + /\[ate|\[burn/.test(tg.out + tg2.out) + ' ' + (DOC.indexOf('applied silently') >= 0), '600/300 false false true')
  e = fresh('/*PRESET*/', ''); turn(e, 'You wait.', 'She orders a burger.')
  eq('COMMANDS.md: "she" with no name counts nothing', pw(e), '0/0')
  // the parser and the doc agree both ways
  const parserSrc = new Function('state', 'info', 'history', 'storyCards', 'addStoryCard', 'updateStoryCard', 'removeStoryCard', libOf('custom') + ';return CMD_RE.map(function (e) { return e[1].source })')({}, {}, [], [], () => {}, () => {}, () => {})
  const tokensOfSrc = (src) => {
    let m = src.match(new RegExp('^:\\(\\?:([a-z|]+)\\)'))   // ":(?:inspect|scan)..." has two names
    if (m) return m[1].split('|').map((w) => ':' + w)
    m = src.match(new RegExp('^:([a-z]+)\\[ \\\\t\\]\\+([a-z]+)\\b'))   // ":sheet[ \t]+add" has a literal second word
    if (m) return [':' + m[1] + ' ' + m[2]]
    return [':' + src.match(new RegExp('^:([a-z]+)'))[1]]
  }
  const handled = [].concat.apply([], parserSrc.map(tokensOfSrc))
  const missing = handled.filter((t) => DOC.indexOf(t) < 0)
  eq('every command the parser handles is in COMMANDS.md (' + handled.length + ' of them: ' + handled.join(' ') + ')' + (missing.length ? '  MISSING: ' + missing.join(' ') : ''), missing.length, 0)
  const headingCmds = [].concat.apply([], DOC.split('\n').filter((l) => /^### `:/.test(l)).map((l) => (l.match(/`(:[a-z]+)/g) || []).map((s) => s.slice(1))))
  const invented = headingCmds.filter((c) => handled.indexOf(c) < 0 && !handled.some((t) => t.indexOf(c + ' ') === 0))
  eq('COMMANDS.md documents no command the parser does not handle (' + headingCmds.length + ' headings)' + (invented.length ? '  INVENTED: ' + invented.join(' ') : ''), invented.length, 0)

  console.log(fail ? fail + ' FAILED' : 'all passed')
  process.exit(fail ? 1 : 0)
}
