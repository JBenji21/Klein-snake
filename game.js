(() => {
  // ===== Config =====
// ===== Sizes =====
    const SIZE_PRESETS = {
    large: { W: 31, H: 31 },
    small: { W: 21, H: 21 },
    };

    // You can keep CELL constant, or optionally scale it per preset.
    // Keeping it constant is simplest:
    let CELL = 18;

    let W = SIZE_PRESETS.large.W;
    let H = SIZE_PRESETS.large.H;

    let halfW = Math.floor(W / 2);
    let halfH = Math.floor(H / 2);
  const START_LEN = 20;
  const TICK_MS = 95; // speed (lower = faster)
  // ===== Canvas =====
  const canvas = document.getElementById("game");
  let ctx = canvas.getContext("2d");
  const COLORS = {
    bg: "rgba(255,255,255,0.02)",      // canvas already has this via CSS, but fine
    border: "rgba(232,238,247,0.25)",
    snake: "#e8eef7",
    food: "#ffd166",
    headDot: "#06d6a0",
    pauseOverlay: "rgba(0,0,0,0.55)",
    text: "#e8eef7",
};
  function applyCanvasSize() {
  canvas.width = W * CELL;
    canvas.height = H * CELL;

    // Re-acquire context after resize (prevents “blank canvas” issues)
    ctx = canvas.getContext("2d");

    // Optional: crisp pixels
    ctx.imageSmoothingEnabled = false;
    }
  applyCanvasSize();

  const scoreEl = document.getElementById("score");

  // ===== Utilities =====
  const keyDir = new Map([
    ["ArrowUp",    { x: 0,  y: -1 }],
    ["ArrowDown",  { x: 0,  y: 1 }],
    ["ArrowLeft",  { x: -1, y: 0 }],
    ["ArrowRight", { x: 1,  y: 0 }],
    ["w",          { x: 0,  y: -1 }],
    ["s",          { x: 0,  y: 1 }],
    ["a",          { x: -1, y: 0 }],
    ["d",          { x: 1,  y: 0 }],
    ["W",          { x: 0,  y: -1 }],
    ["S",          { x: 0,  y: 1 }],
    ["A",          { x: -1, y: 0 }],
    ["D",          { x: 1,  y: 0 }],
  ]);

  function samePos(a, b) { return a.x === b.x && a.y === b.y; }

  // Keep coordinates in canonical head-centred range:
  // x in [-halfW..halfW], y in [-halfH..halfH]
//   function wrapTorus(p) {
//     if (p.x > halfW)  p.x -= W;
//     if (p.x < -halfW) p.x += W;
//     if (p.y > halfH)  p.y -= H;
//     if (p.y < -halfH) p.y += H;
//   }

  function normSym(v, mod, half) {
  // reduce to [-half..half] without implying any portal crossing
  v = ((v % mod) + mod) % mod; // now in [0..mod-1]
  if (v > half) v -= mod;      // now in [-half..half]
  return v;
  }

  function wrapTopology(p) {
    // 1) Detect actual seam crossings (based only on position after worldShift)
    let crossedX = false;
    let crossedY = false;

    if (p.x > halfW) { p.x -= W; crossedX = true; }
    else if (p.x < -halfW) { p.x += W; crossedX = true; }

    if (p.y > halfH) { p.y -= H; crossedY = true; }
    else if (p.y < -halfH) { p.y += H; crossedY = true; }

    // 2) Apply twists ONLY for seams actually crossed
    if (crossedY) {
        p.x = 2 * mirrorX - p.x;
        if (p.dir) p.dir.x *= -1;
        if (p.flip) p.flip *= -1;
    }

    if (topoMode === "proj" && crossedX) {
        p.y = 2 * mirrorY - p.y;
        if (p.dir) p.dir.y *= -1;
        if (p.flip) p.flip *= -1;
    }

    // 3) Now just normalise into our visible range (no more twisting!)
    p.x = normSym(p.x, W, halfW);
    p.y = normSym(p.y, H, halfH);
    }

  function randInt(min, max) {
    // inclusive
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randomFreeCell(occupiedSet) {
    // occupiedSet stores "x,y"
    // Avoid (0,0) so food doesn't spawn under head.
    for (let tries = 0; tries < 5000; tries++) {
      const x = randInt(-halfW, halfW);
      const y = randInt(-halfH, halfH);
      if (x === 0 && y === 0) continue;
      const k = `${x},${y}`;
      if (!occupiedSet.has(k)) return { x, y };
    }
    // fallback (should never happen unless board is full)
    return { x: halfW, y: halfH };
  }

  function buildOccupiedSet(snake) {
    const s = new Set();
    for (const seg of snake) s.add(`${seg.x},${seg.y}`);
    return s;
  }

  // ===== Game State (head-fixed coordinates) =====
  let snake;     // array of {x,y} offsets relative to head; snake[0] is always (0,0)
  let food;      // {x,y} offset relative to head
  let dir;       // current direction (in world-space sense)
  let nextDir;   // buffered input
  let score = 0;
  let paused = false;
  let gameOver = false;
  let mirrorX = 0; // where the Klein reflection happens in head coords
  let topoMode = "klein"; // "klein" | "proj"
  let mirrorY = 0;        // where the left/right reflection happens in head coords (proj mode only)

  function setSizePreset(name) {
    const p = SIZE_PRESETS[name];
    if (!p) return;

    W = p.W;
    H = p.H;
    halfW = Math.floor(W / 2);
    halfH = Math.floor(H / 2);

    applyCanvasSize();
    reset();
    }

  function reset() {
    score = 0;
    paused = false;
    gameOver = false;
    mirrorX = 0;
    mirrorY = 0;;

    // Start with head at origin, body trailing "down" (relative to head)
    snake = [];
    for (let i = 0; i < START_LEN; i++) {
    snake.push({
        x: -i,
        y: 0,
        dir: { x: 1, y: 0 }, // tangent/heading stored per segment
        flip: 1,             // +1 normal, -1 mirrored
    });
    }

    dir = { x: 1, y: 0 };
    nextDir = { x: 1, y: 0 };

    const occ = buildOccupiedSet(snake);
    food = randomFreeCell(occ);

    updateHUD();
  }

  function updateHUD() {
    scoreEl.textContent = gameOver ? `Score: ${score} — GAME OVER (R to restart)` : `Score: ${score}`;
  }

  // Head is fixed; the *world* moves opposite to direction.
  // So we translate everything by (-dir).
  function step() {
    if (paused || gameOver) return;

    // Apply buffered direction if it's not a direct reversal
    if (!(nextDir.x === -dir.x && nextDir.y === -dir.y)) {
      dir = nextDir;
      snake[0].dir = { x: dir.x, y: dir.y };
    }

    const worldShift = { x: -dir.x, y: -dir.y };
    
    mirrorX += worldShift.x;
    if (mirrorX > halfW) mirrorX -= W;
    if (mirrorX < -halfW) mirrorX += W;

    mirrorY += worldShift.y;
    if (mirrorY > halfH) mirrorY -= H;
    if (mirrorY < -halfH) mirrorY += H;

    // Shift body segments (including the current head at 0,0 -> becomes behind head)
    for (const seg of snake) {
      seg.x += worldShift.x;
      seg.y += worldShift.y;
      wrapTopology(seg);
    //   wrapTorus(seg);
    }

    // Shift food the same way
    food.x += worldShift.x;
    food.y += worldShift.y;
    // wrapTorus(food);
    wrapTopology(food);

    // Insert new head at origin
    snake.unshift({ x: 0, y: 0, dir: { x: dir.x, y: dir.y }, flip: 1 });

    // Collision: if any other segment is now at origin, head hit the body
    for (let i = 1; i < snake.length; i++) {
      if (snake[i].x === 0 && snake[i].y === 0) {
        gameOver = true;
        updateHUD();
        return;
      }
    }

    // Eat if food is at origin
    if (food.x === 0 && food.y === 0) {
      score += 1;
      const occ = buildOccupiedSet(snake);
      food = randomFreeCell(occ);
      updateHUD();
      // no tail pop => growth
    } else {
      // normal move: remove tail
      snake.pop();
    }
  }

  // ===== Rendering =====
  function cellToScreen(p) {
    const cx = Math.floor(canvas.width / 2);
    const cy = Math.floor(canvas.height / 2);
    // Draw cell centre aligned so (0,0) is central cell.
    const sx = cx + p.x * CELL - Math.floor(CELL / 2);
    const sy = cy + p.y * CELL - Math.floor(CELL / 2);
    return { x: sx, y: sy };
  }

  function drawGrid() {
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;

    // vertical lines
    for (let gx = -halfW; gx <= halfW; gx++) {
      const p = cellToScreen({ x: gx, y: -halfH });
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x, p.y + (H - 1) * CELL);
      ctx.stroke();
    }

    // horizontal lines
    for (let gy = -halfH; gy <= halfH; gy++) {
      const p = cellToScreen({ x: -halfW, y: gy });
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + (W - 1) * CELL, p.y);
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawBorders() {
    // Draw a faint rectangle marking the fundamental domain
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = COLORS.border;
    ctx.strokeRect(
      (canvas.width - (W * CELL)) / 2,
      (canvas.height - (H * CELL)) / 2,
      W * CELL,
      H * CELL
    );
    ctx.restore();
    
  }

  function drawFood() {
    const s = cellToScreen(food);
    ctx.save();
    ctx.fillStyle = COLORS.food;
    ctx.fillRect(s.x + 3, s.y + 3, CELL - 6, CELL - 6);
    ctx.restore();
  }

  function edgesFromDir(d) {
  // geometric left/right edges given screen coords (y increases downward)
  if (d.x === 1)  return { left: "top",    right: "bottom" }; // moving right
  if (d.x === -1) return { left: "bottom", right: "top"    }; // moving left
  if (d.y === 1)  return { left: "right",  right: "left"   }; // moving down
  return           { left: "left",   right: "right"  };       // moving up (d.y === -1)
}

  function leftRightEdgesFromDir(d) {
    // Screen coords: +y is downward.
    // "Left" is the geometric left when moving in direction d.
    if (d.x === 1)  return { left: "top",    right: "bottom" }; // moving right
    if (d.x === -1) return { left: "bottom", right: "top"    }; // moving left
    if (d.y === -1) return { left: "left",   right: "right"  }; // moving up
    return            { left: "right",  right: "left"   };      // moving down
    }

    function fillHalf(x0, y0, size, edge, color) {
    ctx.save();
    ctx.fillStyle = color;

    if (edge === "top") {
        ctx.fillRect(x0, y0, size, size / 2);
    } else if (edge === "bottom") {
        ctx.fillRect(x0, y0 + size / 2, size, size / 2);
    } else if (edge === "left") {
        ctx.fillRect(x0, y0, size / 2, size);
    } else { // "right"
        ctx.fillRect(x0 + size / 2, y0, size / 2, size);
    }

    ctx.restore();
    }

  function drawSnake() {
    for (let i = snake.length - 1; i >= 0; i--) {
        const seg = snake[i];
        const s = cellToScreen(seg);

        const pad = (i === 0) ? 2 : 3;
        const x0 = s.x + pad;
        const y0 = s.y + pad;
        const size = CELL - 2 * pad;

        // Base (slightly transparent so the flank colours read clearly)
        ctx.fillStyle = "rgba(232,238,247,0.12)";
        ctx.fillRect(x0, y0, size, size);

        const d = seg.dir ?? dir;
        const { left, right } = leftRightEdgesFromDir(d);

        const red   = "rgba(255,80,80,0.90)";
        const green = "rgba(80,255,140,0.90)";

        // If mirrored, swap which colour is "left" vs "right"
        const leftCol  = (seg.flip === -1) ? green : red;
        const rightCol = (seg.flip === -1) ? red   : green;

        fillHalf(x0, y0, size, left, leftCol);
        fillHalf(x0, y0, size, right, rightCol);

        // Optional: tiny forward notch so direction is also visually obvious
        // (keeps it “triangle-ish” without breaking semantics)
        if (i === 0) {
        ctx.save();
        ctx.fillStyle = "rgba(255,255,255,0.55)";
        const cx = x0 + size / 2, cy = y0 + size / 2;
        const tip = size * 0.30;

        ctx.beginPath();
        if (d.x === 1) {        // right
            ctx.moveTo(x0 + size, cy);
            ctx.lineTo(x0 + size - tip, cy - tip / 2);
            ctx.lineTo(x0 + size - tip, cy + tip / 2);
        } else if (d.x === -1) { // left
            ctx.moveTo(x0, cy);
            ctx.lineTo(x0 + tip, cy - tip / 2);
            ctx.lineTo(x0 + tip, cy + tip / 2);
        } else if (d.y === -1) { // up
            ctx.moveTo(cx, y0);
            ctx.lineTo(cx - tip / 2, y0 + tip);
            ctx.lineTo(cx + tip / 2, y0 + tip);
        } else {                 // down
            ctx.moveTo(cx, y0 + size);
            ctx.lineTo(cx - tip / 2, y0 + size - tip);
            ctx.lineTo(cx + tip / 2, y0 + size - tip);
        }
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        }
    }
    }

    function drawMirrorMarker() {
    // x-position of the X-mirror axis in pixels
    const sx = cellToScreen({ x: mirrorX, y: 0 }).x + CELL / 2;

    // y-position of the Y-mirror axis in pixels
    const sy = cellToScreen({ x: 0, y: mirrorY }).y + CELL / 2;

    // ---------- tick marks ----------
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    ctx.lineWidth = 2;

    // top/bottom ticks for mirrorX (always)
    ctx.beginPath();
    ctx.moveTo(sx, 1);
    ctx.lineTo(sx, 14);
    ctx.moveTo(sx, canvas.height - 2);
    ctx.lineTo(sx, canvas.height - 15);

    // left/right ticks for mirrorY (projective plane only)
    if (topoMode === "proj") {
        ctx.moveTo(1, sy);
        ctx.lineTo(14, sy);
        ctx.moveTo(canvas.width - 2, sy);
        ctx.lineTo(canvas.width - 15, sy);
    }

    ctx.stroke();
    ctx.restore();

    // ---------- wrapped fade bands ----------
    const fadeLenX = Math.min(220, canvas.width * 0.35);
    const fadeLenY = Math.min(220, canvas.height * 0.35);
    const bandH = 10; // thickness for top/bottom bands
    const bandW = 10; // thickness for left/right bands
    const topY = 2;
    const botY = canvas.height - bandH - 2;
    const leftX = 2;
    const rightX = canvas.width - bandW - 2;

    const RED = "rgba(255,80,80,0.85)";
    const GREEN = "rgba(80,255,140,0.85)";
    const CLEAR = "rgba(0,0,0,0)";

    function drawLeftFadeWrappedX(x, y, color) {
        // interval [x - fadeLenX, x], wrapping in X
        const start = x - fadeLenX;

        // main part
        let g = ctx.createLinearGradient(x, 0, start, 0);
        g.addColorStop(0, color);
        g.addColorStop(1, CLEAR);
        ctx.fillStyle = g;

        const a = Math.max(0, start);
        const b = Math.min(canvas.width, x);
        if (b > a) ctx.fillRect(a, y, b - a, bandH);

        // wrap overflow to right edge
        if (start < 0) {
        g = ctx.createLinearGradient(x + canvas.width, 0, start + canvas.width, 0);
        g.addColorStop(0, color);
        g.addColorStop(1, CLEAR);
        ctx.fillStyle = g;

        const overflowW = -start;
        ctx.fillRect(canvas.width - overflowW, y, overflowW, bandH);
        }
    }

    function drawRightFadeWrappedX(x, y, color) {
        // interval [x, x + fadeLenX], wrapping in X
        const end = x + fadeLenX;

        // main part
        let g = ctx.createLinearGradient(x, 0, end, 0);
        g.addColorStop(0, color);
        g.addColorStop(1, CLEAR);
        ctx.fillStyle = g;

        const a = Math.max(0, x);
        const b = Math.min(canvas.width, end);
        if (b > a) ctx.fillRect(a, y, b - a, bandH);

        // wrap overflow to left edge
        if (end > canvas.width) {
        g = ctx.createLinearGradient(x - canvas.width, 0, end - canvas.width, 0);
        g.addColorStop(0, color);
        g.addColorStop(1, CLEAR);
        ctx.fillStyle = g;

        const overflowW = end - canvas.width;
        ctx.fillRect(0, y, overflowW, bandH);
        }
    }

    function drawUpFadeWrappedY(x, y, color) {
        // interval [y - fadeLenY, y], wrapping in Y
        const start = y - fadeLenY;

        // main part
        let g = ctx.createLinearGradient(0, y, 0, start);
        g.addColorStop(0, color);
        g.addColorStop(1, CLEAR);
        ctx.fillStyle = g;

        const a = Math.max(0, start);
        const b = Math.min(canvas.height, y);
        if (b > a) ctx.fillRect(x, a, bandW, b - a);

        // wrap overflow to bottom edge
        if (start < 0) {
        g = ctx.createLinearGradient(0, y + canvas.height, 0, start + canvas.height);
        g.addColorStop(0, color);
        g.addColorStop(1, CLEAR);
        ctx.fillStyle = g;

        const overflowH = -start;
        ctx.fillRect(x, canvas.height - overflowH, bandW, overflowH);
        }
    }

    function drawDownFadeWrappedY(x, y, color) {
        // interval [y, y + fadeLenY], wrapping in Y
        const end = y + fadeLenY;

        // main part
        let g = ctx.createLinearGradient(0, y, 0, end);
        g.addColorStop(0, color);
        g.addColorStop(1, CLEAR);
        ctx.fillStyle = g;

        const a = Math.max(0, y);
        const b = Math.min(canvas.height, end);
        if (b > a) ctx.fillRect(x, a, bandW, b - a);

        // wrap overflow to top edge
        if (end > canvas.height) {
        g = ctx.createLinearGradient(0, y - canvas.height, 0, end - canvas.height);
        g.addColorStop(0, color);
        g.addColorStop(1, CLEAR);
        ctx.fillStyle = g;

        const overflowH = end - canvas.height;
        ctx.fillRect(x, 0, bandW, overflowH);
        }
    }

    ctx.save();
    ctx.globalAlpha = 0.85;

    // --- Top/bottom bands for mirrorX (always)
    // Top: red LEFT, green RIGHT
    drawLeftFadeWrappedX(sx, topY, RED);
    drawRightFadeWrappedX(sx, topY, GREEN);

    // Bottom: opposite
    drawLeftFadeWrappedX(sx, botY, GREEN);
    drawRightFadeWrappedX(sx, botY, RED);

    // --- Left/right bands for mirrorY (projective plane only)
    if (topoMode === "proj") {
        // Left edge: red ABOVE, green BELOW
        drawUpFadeWrappedY(leftX, sy, RED);
        drawDownFadeWrappedY(leftX, sy, GREEN);

        // Right edge: opposite
        drawUpFadeWrappedY(rightX, sy, GREEN);
        drawDownFadeWrappedY(rightX, sy, RED);
    }

    ctx.restore();
    }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawBorders();
    drawMirrorMarker();
    // (Optional) grid is nice for debugging
    // drawGrid();

    // Food
    ctx.save();
    ctx.globalAlpha = 0.9;
    drawFood();
    ctx.restore();

    // Snake
    ctx.save();
    ctx.globalAlpha = 0.95;
    drawSnake();
    ctx.restore();

    // Head marker (tiny dot)
    ctx.save();
    const headScreen = cellToScreen({ x: 0, y: 0 });
    ctx.globalAlpha = 1;
    ctx.fillStyle = COLORS.headDot;
    ctx.beginPath();
    ctx.arc(headScreen.x + CELL / 2, headScreen.y + CELL / 2, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Pause overlay
    if (paused) {
      ctx.save();
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = COLORS.pauseOverlay;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.globalAlpha = 1;
      ctx.textAlign = "center";
      ctx.font = "bold 20px system-ui";
      ctx.fillStyle = COLORS.text;
      ctx.fillText("Paused", canvas.width / 2, canvas.height / 2);
      ctx.restore();
    }
  }

  // ===== Input =====
  window.addEventListener("keydown", (e) => {
    if (e.code === "Space") {
      paused = !paused;
      return;
    }
    if (e.key === "r" || e.key === "R") {
      reset();
      return;
    }
    const d = keyDir.get(e.key);
    if (d) nextDir = d;
  });

  const sizeSelect = document.getElementById("sizeSelect");
    if (sizeSelect) {
    sizeSelect.addEventListener("change", () => {
        setSizePreset(sizeSelect.value);
    });
    }

  const topoSelect = document.getElementById("topoSelect");
    if (topoSelect) {
    topoSelect.addEventListener("change", () => {
        topoMode = topoSelect.value; // "klein" or "proj"
        reset();
    });
    }

  // ===== Main Loop =====
  let last = performance.now();
  let acc = 0;

  function loop(now) {
    const dt = now - last;
    last = now;
    acc += dt;

    while (acc >= TICK_MS) {
      step();
      acc -= TICK_MS;
    }

    render();
    requestAnimationFrame(loop);
  }

  // Start
  reset();
  requestAnimationFrame(loop);
})();