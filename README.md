# Body tracker for AI Dungeon

A private script that tracks body changes for the characters in an AI Dungeon scenario, so the story stays consistent with real numbers.

- **[COMMANDS.md](COMMANDS.md)**: every command, the Player setup card, the placeholder questions, and what is detected from typed text and AI replies.
- **[PASTE.md](PASTE.md)**: which file goes in which AI Dungeon tab.
- **[CLAUDE.md](CLAUDE.md)**: project notes for development (model, layout, how to build and test).

Quick start: paste the files as PASTE.md says, type `:help`, then `:body`.

Developers: edit `src/`, run `node build.js` then `node bt_test.js`. The Library files are generated.
