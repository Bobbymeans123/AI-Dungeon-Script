// Test harness: node bt_test.js   (loads the Library + Input/Output like AI Dungeon does)
const fs = require('fs')
const rd = (f) => fs.readFileSync(__dirname + '/' + f, 'utf8')
const lib = rd(process.env.BT_LIB || 'bt_library_whitney.js')
const hooks = { in: rd('bt_input.js'), out: rd('bt_output.js') }
const patch = process.env.BT_CFG ? ';' + process.env.BT_CFG : ''   // e.g. "CFG.LAZY=true", appended after the Library

function run(kind, text, env) {
  const src = lib + patch + (env.cfg ? ';' + env.cfg : '') + '\n' + hooks[kind].replace(/modifier\(text\)\s*$/, '') + '\nreturn modifier(text)'
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

  console.log(fail ? fail + ' FAILED' : 'all passed')
  process.exit(fail ? 1 : 0)
}
