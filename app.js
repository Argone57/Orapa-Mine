// --- Config grille ---
const letters = "ABCDEFGHIJKLMNOPQR".split(""); // A à R
const maxCols = 18;

// --- État global ---
let gameStarted = false;
let pieces = [];
let activeDrag = null;
let longPressTimer = null;

// --- Initialisation ---
document.addEventListener("DOMContentLoaded", () => {
  buildGrid();
  buildLabels();
  buildPieces();
  setupButtons();
});

// --- Construction de la grille ---
function buildGrid() {
  const grid = document.getElementById("grid");
  letters.forEach((letter, rowIndex) => {
    for (let col = 1; col <= maxCols; col++) {
      const cell = document.createElement("div");
      cell.classList.add("cell");
      cell.dataset.coord = `${letter}${col}`;
      grid.appendChild(cell);
    }
  });
}

// --- Labels lignes / colonnes ---
function buildLabels() {
  const colLabels = document.getElementById("colLabels");
  const rowLabels = document.getElementById("rowLabels");

  for (let c = 1; c <= maxCols; c++) {
    const label = document.createElement("div");
    label.classList.add("col-label", "touchable");
    label.textContent = c;
    label.dataset.col = c;
    label.addEventListener("click", () => onColumnClick(c));
    label.addEventListener("touchend", () => onColumnClick(c));
    colLabels.appendChild(label);
  }

  letters.forEach((letter) => {
    const label = document.createElement("div");
    label.classList.add("row-label", "touchable");
    label.textContent = letter;
    label.dataset.row = letter;
    label.addEventListener("click", () => onRowClick(letter));
    label.addEventListener("touchend", () => onRowClick(letter));
    rowLabels.appendChild(label);
  });
}

// --- Création des pièces (exemple) ---
function buildPieces() {
  const pool = document.getElementById("piecesPool");

  const basePieces = [
    { id: "red", label: "R", color: "red" },
    { id: "blue1", label: "B1", color: "blue" },
    { id: "blue2", label: "B2", color: "blue" },
    { id: "green", label: "G", color: "green" },
    { id: "yellow", label: "Y", color: "yellow" }
  ];

  basePieces.forEach((p, index) => {
    const pieceEl = document.createElement("div");
    pieceEl.classList.add("piece");
    if (p.color === "blue") pieceEl.classList.add("blue");
    if (p.color === "green") pieceEl.classList.add("green");
    if (p.color === "yellow") pieceEl.classList.add("yellow");

    const label = document.createElement("span");
    label.classList.add("piece-label");
    label.textContent = p.label;
    pieceEl.appendChild(label);

    pieceEl.dataset.id = p.id;
    pieceEl.style.position = "absolute";
    pieceEl.style.left = `${10 + (index % 3) * 40}px`;
    pieceEl.style.top = `${40 + Math.floor(index / 3) * 40}px`;

    pool.appendChild(pieceEl);

    const pieceState = {
      id: p.id,
      color: p.color,
      rotation: 0,
      flipped: false,
      position: null,
      element: pieceEl
    };
    pieces.push(pieceState);

    setupPieceInteractions(pieceState);
  });
}

// --- Interactions tactiles / souris sur les pièces ---
function setupPieceInteractions(piece) {
  const el = piece.element;

  // Rotation simple (tap / click)
  const rotate = () => {
    if (gameStarted) return;
    piece.rotation = (piece.rotation + 45) % 360;
    applyTransform(piece);
  };

  el.addEventListener("click", rotate);
  el.addEventListener("touchend", (e) => {
    // si pas de drag, on considère comme tap
    if (!activeDrag) rotate();
  });

  // Long press pour flip miroir
  const startLongPress = () => {
    if (gameStarted) return;
    longPressTimer = setTimeout(() => {
      piece.flipped = !piece.flipped;
      applyTransform(piece);
    }, 500);
  };

  const cancelLongPress = () => {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  };

  // Drag tactile
  el.addEventListener("touchstart", (e) => {
    if (gameStarted) return;
    e.preventDefault();
    activeDrag = { piece, startX: getTouchX(e), startY: getTouchY(e) };
    startLongPress();
  });

  el.addEventListener("touchmove", (e) => {
    if (!activeDrag) return;
    cancelLongPress();
    e.preventDefault();
    const x = getTouchX(e);
    const y = getTouchY(e);
    movePieceToScreen(activeDrag.piece, x, y);
  });

  el.addEventListener("touchend", (e) => {
    if (!activeDrag) {
      cancelLongPress();
      return;
    }
    e.preventDefault();
    cancelLongPress();
    magnetize(activeDrag.piece);
    activeDrag = null;
  });

  // Drag souris (optionnel pour desktop)
  el.addEventListener("mousedown", (e) => {
    if (gameStarted) return;
    e.preventDefault();
    activeDrag = { piece, startX: e.clientX, startY: e.clientY };
    startLongPress();
  });

  document.addEventListener("mousemove", (e) => {
    if (!activeDrag) return;
    cancelLongPress();
    movePieceToScreen(activeDrag.piece, e.clientX, e.clientY);
  });

  document.addEventListener("mouseup", (e) => {
    if (!activeDrag) return;
    cancelLongPress();
    magnetize(activeDrag.piece);
    activeDrag = null;
  });
}

// --- Utilitaires touch ---
function getTouchX(e) {
  return e.touches[0].clientX;
}

function getTouchY(e) {
  return e.touches[0].clientY;
}

// --- Déplacement visuel d'une pièce ---
function movePieceToScreen(piece, x, y) {
  const rect = piece.element.parentElement.getBoundingClientRect();
  piece.element.style.left = `${x - rect.left - piece.element.offsetWidth / 2}px`;
  piece.element.style.top = `${y - rect.top - piece.element.offsetHeight / 2}px`;
}

// --- Appliquer rotation + flip ---
function applyTransform(piece) {
  const scaleX = piece.flipped ? -1 : 1;
  piece.element.style.transform = `rotate(${piece.rotation}deg) scaleX(${scaleX})`;
}

// --- Magnétisme sur la grille ---
function magnetize(piece) {
  const grid = document.getElementById("grid");
  const cells = Array.from(grid.querySelectorAll(".cell"));
  const pieceRect = piece.element.getBoundingClientRect();

  let closest = null;
  let minDist = Infinity;

  cells.forEach((cell) => {
    const rect = cell.getBoundingClientRect();
    const dist = Math.hypot(
      rect.left + rect.width / 2 - (pieceRect.left + pieceRect.width / 2),
      rect.top + rect.height / 2 - (pieceRect.top + pieceRect.height / 2)
    );
    if (dist < minDist) {
      minDist = dist;
      closest = cell;
    }
  });

  if (closest) {
    const gridRect = grid.getBoundingClientRect();
    const cellRect = closest.getBoundingClientRect();
    piece.element.style.left = `${cellRect.left - gridRect.left}px`;
    piece.element.style.top = `${cellRect.top - gridRect.top}px`;
    piece.position = closest.dataset.coord;
  }
}

// --- Boutons ---
function setupButtons() {
  const startBtn = document.getElementById("startBtn");
  const resetBtn = document.getElementById("resetBtn");

  startBtn.addEventListener("click", () => {
    gameStarted = true;
    document.body.classList.add("locked");
  });

  resetBtn.addEventListener("click", () => {
    gameStarted = false;
    document.body.classList.remove("locked");
    resetBoard();
  });
}

// --- Reset complet ---
function resetBoard() {
  const grid = document.getElementById("grid");
  const gridRect = grid.getBoundingClientRect();

  pieces.forEach((piece, index) => {
    piece.rotation = 0;
    piece.flipped = false;
    piece.position = null;
    applyTransform(piece);
    piece.element.style.left = `${10 + (index % 3) * 40}px`;
    piece.element.style.top = `${40 + Math.floor(index / 3) * 40}px`;
  });

  const history = document.getElementById("history");
  history.innerHTML = "";
}

// --- Click sur colonne / ligne ---
function onColumnClick(col) {
  if (!gameStarted) return;
  const result = computeRayFromColumn(col);
  addHistory(`Col ${col}`, result.exit, result.color);
}

function onRowClick(row) {
  if (!gameStarted) return;
  const result = computeRayFromRow(row);
  addHistory(`Ligne ${row}`, result.exit, result.color);
}

// --- Exemple de calcul de rayon (stub à adapter aux vraies règles) ---
function computeRayFromColumn(col) {
  // TODO: implémenter la vraie logique du jeu
  // Pour l'instant, on renvoie un exemple
  return { exit: 3, color: "blue" };
}

function computeRayFromRow(row) {
  // TODO: implémenter la vraie logique du jeu
  return { exit: 5, color: "red" };
}

// --- Historique ---
function addHistory(entry, exit, color) {
  const history = document.getElementById("history");
  const div = document.createElement("div");
  div.classList.add("history-entry");

  const entrySpan = document.createElement("span");
  entrySpan.textContent = entry;
  entrySpan.classList.add(color);

  const exitSpan = document.createElement("span");
  exitSpan.textContent = exit;
  exitSpan.classList.add(color);

  const colorSpan = document.createElement("span");
  colorSpan.textContent = color;

  div.appendChild(entrySpan);
  div.appendChild(document.createTextNode(" - "));
  div.appendChild(exitSpan);
  div.appendChild(document.createTextNode(" - "));
  div.appendChild(colorSpan);

  history.appendChild(div);
}
