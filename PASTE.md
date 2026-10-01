# What to paste into AI Dungeon

Input and Output are the same for both scenarios. Only the Library tab differs.

| Tab | Scenario 1: you are Rue | Scenario 2: you are anyone else |
|---|---|---|
| **Library** | `bt_library_whitney.js` | `bt_library_whitney_custom.js` |
| **Input** | `bt_input.js` | `bt_input.js` |
| **Output** | `bt_output.js` | `bt_output.js` |
| Context | leave the default | leave the default |

Paste each file's whole contents into its tab. The Library files are generated (`node build.js`), so never edit them by hand.

## Scenario 1 (Rue)
Whitney is a tracked character and you are Rue (168 cm, 54 kg, DEX 13), seeded on the first turn. Unnamed turns, "You order ..." and "Rue ..." all go to Rue. Game pace (silly preset) is on.

## Scenario 2 (custom player)
Whitney is tracked, and you get a plain default player sheet (165 cm, 60 kg) with no name. Fill it in yourself, for example:
`:set height 170`, `:set weight 60`, `:set bodyfat 22` (or `:sheet add Name ...` for other characters). Unnamed turns and "You order ..." go to your sheet. Game pace (silly preset) is on.

## Notes
- The sheets are seeded on the first turn of an adventure. To switch scenario in an adventure that already started, begin a new adventure (or `:reset confirm`, which re-seeds only your own sheet).
- Whenever the source changes: `node build.js`, then `node bt_test.js`, then paste the changed files again. `git diff --stat` shows which of `bt_library_whitney.js`, `bt_library_whitney_custom.js`, `bt_input.js`, `bt_output.js` changed.
