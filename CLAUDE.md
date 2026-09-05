# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the Game

No build step needed. Start a local server:

```bash
python3 -m http.server 8000
# or: npx serve .
```

Then open `http://localhost:8000` in a browser. The game is fully playable immediately.

## Architecture

**Vanilla JS Tetris** with three tight files:

- **index.html**: DOM structure. Two `<canvas>` elements (main board, next-piece preview) and UI panels (score, lines, level, controls).
- **style.css**: Dark/retro arcade styling. Flexbox layout, CSS variables for colors, `backdrop-filter` on overlays.
- **game.js**: All game logic (~400 lines). No external dependencies.

### Game Loop & Rendering

- **`requestAnimationFrame`-based loop** in `loop()`: accumulates elapsed time, drops pieces at intervals, calls `draw()` every frame.
- **Canvas 2D rendering**: grid, board state, current piece, ghost piece (faint preview), next piece on secondary canvas.
- **Game state**: `board` (matrix of color indices 0–7), `current` and `next` (piece objects with shape/position), `score`, `lines`, `level`, `paused`, `gameOver`.

### Key Logic

- **Collision detection** (`collide`): checks bounds and overlaps with board.
- **Rotation** (`rotateCW`, `tryRotate`): clockwise rotation with wall-kick offsets `[0, ±1, ±2]` to handle edge cases.
- **Line clearing** (`clearLines`): scans from bottom up, removes full rows, adds empty rows at top.
- **Scoring**: classic table `[0, 100, 300, 500, 800]` for 1–4 line clears, multiplied by level. Hard drop adds 2 pts/cell, soft drop 1 pt/row.
- **Piece spawning** (`spawn`): checks collision immediately—if blocked, triggers `endGame()`.

### Customization Points

All tuneable constants at the top of `game.js`:

| Constant    | Default | Notes                                  |
|-------------|---------|----------------------------------------|
| `COLS`      | 10      | Board width; update canvas width too   |
| `ROWS`      | 20      | Board height; update canvas height too |
| `BLOCK`     | 30      | Pixel size per cell                    |
| `COLORS`    | Array   | Color hex strings for each piece type  |
| `LINE_SCORES` | [0,100,300,500,800] | Points per N lines cleared |

Changing `COLS`/`ROWS`/`BLOCK` requires matching `<canvas width>` and `<canvas height>` in `index.html` (formula: `width = COLS × BLOCK`, `height = ROWS × BLOCK`).

## Controls & Game States

- **Arrow keys** (←/→): move left/right. **↑ or X**: rotate. **↓**: soft drop. **Space**: hard drop. **P**: pause.
- **States**: playing, paused (overlay hides board), game over (shows score + restart button).

## Testing Locally

Open the browser's developer console to inspect `board`, `current`, `score`, etc., or add temporary `console.log()` calls in the game loop.
