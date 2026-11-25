<!-- Alex 202384014054 -->

# Capsid Lockdown

**Version:** v0.1 (Nov 17, 2026)<br>
**Author:** Alex (Student ID: 202384014054)<br>
**AI use:** most of the code was written with Claude Code. See [AI_USE.md](../AI_USE.md).<br>
**Credits:** see [CREDITS.md](CREDITS.md).

Capsid Lockdown is Minesweeper played on the outer shell (the capsid) of a
virus. There are twelve viruses, each with a different shape. Each shell is
made of 32 to 144 protein blocks, and a few of them are resistant to the
drug: those are the mines. You dose the normal proteins to lock them, read
the numbers, work out where the resistant proteins are, and flag them for
the antibodies.

Every level can be solved by logic alone, without guessing. A solver in the
code checks this for every layout.

The game runs in the browser. It is plain JavaScript, WebGL, Canvas and Web
Audio, with no libraries and no install step. It starts in English; the
**中文** button in the top bar switches to Chinese.

## How to Run It

There are three ways. To play, you do not need to install anything.
Chrome is recommended, because the game was tested in Chrome.

### 1. Play online

Open
<https://zyun20041026.github.io/Senior-Capstone-Project/Alex-202384014054/capsid-lockdown/>.
It is hosted with GitHub Pages and shows the version on the `main` branch
of my repository, so it updates each time I push.

### 2. Download it and open the file

1. On the GitHub page of the repository, click **Code → Download ZIP** and
   unzip it. (Or clone it:
   `git clone https://github.com/Zyun20041026/Senior-Capstone-Project.git`)
2. Open the folder `Alex-202384014054/capsid-lockdown/`.
3. Double-click `index.html`. The game opens in your browser.

### 3. Use the local server (needs Node.js)

You need [Node.js](https://nodejs.org/) 22 or newer. Open a terminal in the
top folder of the repository (the folder you unzipped or cloned) and run:

```bash
node Alex-202384014054/capsid-lockdown/tools/serve.js
```

When it prints `Capsid Lockdown is running.`, open
<http://127.0.0.1:8765/> in Chrome. Stop the server with `Ctrl + C`.

- If you are already inside the `capsid-lockdown` folder,
  `node tools/serve.js` does the same.
- If port 8765 is already in use, put another port number at the end, for
  example `node tools/serve.js 9000`, and open <http://127.0.0.1:9000/>.

The server is useful while changing the code: it turns off caching, so the
browser always loads the newest files.

### Useful Addresses

These work with all three ways. Add one to the end of the address:

| Add | What it opens |
| --- | --- |
| `?level=6` | straight into virus 6 |
| `?duel=noro` | the experimental real-time mode |
| `?lang=zh` | the game in Chinese |

For example:
<https://zyun20041026.github.io/Senior-Capstone-Project/Alex-202384014054/capsid-lockdown/?level=6>

## How to Play

The rules are the same as Minesweeper. There are four words to know:

| Word | Meaning |
| --- | --- |
| Normal protein | Safe to dose. When the drug reaches it, it locks and stops moving. |
| Resistant protein | The "mine". A dose on it bounces off and counts as a miss. Three misses and the virus escapes. |
| Dose | Click a protein. If none of its neighbours is resistant, the drug spreads out on its own. |
| Reading | The number on a locked protein: how many of its neighbours (sharing an edge or a corner) are resistant. |

Lock every normal protein to win. The flagged resistant proteins are then
cleared by antibodies and the virus breaks apart.

| Action | Mouse and keyboard | Touch screen |
| --- | --- | --- |
| Dose | left click | tap once to preview, tap again to confirm |
| Flag / unflag | right click, or press `F` and left click | long press |
| Clear around a reading | click a reading whose flags are complete | tap the reading |
| Turn the virus | drag, or arrow keys | drag |
| Zoom | scroll wheel or pinch | pinch |
| Hint (shows the reasoning) | `H` | Hint button |
| Restart with a new layout | `R` | Restart button |
| Focus on one protein | `V` turns it on or off | Focus button |
| Back to the virus list | `Esc` | Strains button |

Stars: ★★★ no misses and no hints, ★★ one miss or a hint, ★ locked.

The first virus starts with a four-step tutorial on the real board. It can
be skipped.

## The Campaign

The whole campaign treats one made-up host, "Eco-Pod 7". Its viral load
starts at 7.2 log and drops each time a virus is locked. Each virus unlocks
a short dossier with plain facts about it.

| # | Virus | Shape | Blocks | Resistant |
| --- | --- | --- | --- | --- |
| 1 | Norovirus | small icosahedron | 32 | 5 |
| 2 | Tobacco mosaic virus | rigid rod, helical | 50 | 9 |
| 3 | Human papillomavirus | icosahedron | 42 | 9 |
| 4 | Rabies virus | bullet | 54 | 12 |
| 5 | Rotavirus | wheel (8 neighbours per block) | 60 | 11 |
| 6 | Influenza virus | enveloped sphere, two kinds of spikes | 72 | 16 |
| 7 | Adenovirus | icosahedron with fibres | 92 | 21 |
| 8 | Bacteriophage T4 | head, tail sheath and tail fibres | 77 | 17 |
| 9 | Ebola virus | long bent filament | 93 | 21 |
| 10 | Vaccinia virus | brick | 96 | 23 |
| 11 | Coronavirus | enveloped sphere with a crown of spikes | 116 | 28 |
| 12 | Herpes simplex virus | large enveloped sphere | 144 | 36 |

**The game data is made up.** The shapes follow the textbook look of each
virus, but the number of blocks, the sizes and where the resistant proteins
are, are all generated by the game. The resistant strains are made up too.
The game has no real mutation sites, disease mechanisms, lab methods, gene
sequences or drugs.

## Experimental Mode: Hold the Cell Cluster

Norovirus has a **Duel** button (or open `?duel=noro`). It is a short
real-time round of about two minutes. It does not touch the stars or the
save of the main game.

You play the immune system. In the middle is a cluster of 32 cells, and
norovirus particles drift in from all sides.

- **A virus particle** lands on a cell, binds three receptors and gets
  inside. The infected cell bursts after about 12 seconds and releases 3
  new particles. Lose 8 cells and you lose; hold out for three waves and
  you win.
- **The macrophage** (mint green): drag from it to a cell and it crawls
  there. It eats the viruses on its own cell and the ring around it. Each
  virus it eats leaves a point of light; move the pointer over it to
  collect it.
- **Three kinds of cells:** ordinary cells (pink), goblet cells (blue)
  whose mucus slows viruses down, and stem cells (purple) that regrow a
  burst neighbour every 15 seconds.
- **Antibody cloud** (from wave 2): press the Antibody cloud button, then
  click above the cluster. Viruses inside the cloud cannot bind, and the
  macrophage eats them twice as fast.
- **Three waves** of 3, 8 and 16 particles. The third comes from behind.
  After wave 2 you pick one upgrade.

The rules are in `js/duel.js`. They use a seeded random number generator
and a fixed 60 Hz step, so the same seed and the same moves always replay
the same round. `node tools/duel-sim.js` plays many rounds with simple bots
and prints win rates, which is how the numbers were tuned.

The numbers in this mode are made up for play, not taken from real
infections. The viruses are drawn about 100 times bigger than real scale.

## No Level Needs a Guess

The solver in `js/rules.js` only uses what the player can see. It has three
levels of reasoning:

1. One reading is enough on its own.
2. Two readings together (what they share), or counting how many resistant
   proteins are left in total.
3. Three or more readings together (a small local search).

`tools/generate.js` keeps only layouts that the solver can solve from the
first dose to the end, and picks them by how deep the reasoning has to go:
viruses 1–2 need level 1, viruses 3–6 need level 2, and from virus 7 on
level 3. The hints and the "you could have known this" message after a miss
use the same solver, so they can point to the exact readings behind each
step.

## Files

| File | What it does |
| --- | --- |
| `index.html`, `css/style.css` | page layout and styles |
| `js/i18n.js` | English / Chinese switch |
| `js/core.js` | icosahedron geometry, vectors, random numbers |
| `js/boards.js` | the twelve shells: cuts each shape into blocks and finds the neighbours |
| `js/rules.js` | rules, game session, solver, hints |
| `js/viruses.js` | the twelve viruses: shape, number of resistant proteins, difficulty, dossier text |
| `js/levels.js` | **generated** by `tools/generate.js`: neighbour tables and five proven layouts per virus |
| `js/duel.js` | rules of the experimental real-time mode |
| `js/render.js` | drawing: 2D background, WebGL shell, 2D overlay |
| `js/audio.js` | all sounds, made with Web Audio (no sound files) |
| `js/game.js` | screens, input, tutorial, hints, win and loss, saving |
| `tools/serve.js` | small local web server |
| `tools/generate.js` | rebuilds `js/levels.js` (about 40 seconds) |
| `tools/validate.js` | checks all 60 layouts again and prints a difficulty table |
| `tools/duel-sim.js` | plays the real-time mode with bots and prints win rates |
| `tests/` | automated tests (`node:test`) |

Progress is saved in the browser (`localStorage`), under
`capsid-lockdown-v1` for the main game and `capsid-duel-v1` for the
real-time mode. The language choice is saved under `capsid-lang`.

## Tests

The tests need [Node.js](https://nodejs.org/) 22 or newer. From the top
folder of the repository:

```bash
node --test Alex-202384014054/capsid-lockdown/tests/*.test.js
node Alex-202384014054/capsid-lockdown/tools/validate.js
```

Inside the `capsid-lockdown` folder, `node --test tests/*.test.js` and
`node tools/validate.js` do the same.

The tests cover the rules, the solver (checked against brute force on small
boards), all 60 layouts, the hints, the dossier text, the real-time mode
(replay, waves, cells, macrophage, antibody cloud) and the language switch.

## Not Done Yet

- No timer or leaderboard, no custom boards, no endless random mode.
- Not yet tested on a real phone or tablet. In English on a small phone
  screen, the button bar at the bottom is wider than the screen and scrolls
  sideways.
