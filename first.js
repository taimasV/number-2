import { Chess } from "chess.js";
import { createClient } from "@supabase/supabase-js";

const symbols = {
  w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
  b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
};
const pieceNames = { k: "King", q: "Queen", r: "Rook", b: "Bishop", n: "Knight", p: "Pawn" };
const files = "abcdefgh";
const game = new Chess();
let selectedSquare = null;
let legalMoves = [];
let gameOver = false;

const boardElement = document.querySelector("#board");
const moveListElement = document.querySelector("#moveList");
const turnBadge = document.querySelector("#turnBadge");
const gameStatus = document.querySelector("#gameStatus");
const undoButton = document.querySelector("#undoButton");
const saveButton = document.querySelector("#saveButton");
const cloudStatus = document.querySelector("#cloudStatus");
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;
const gameId = crypto.randomUUID();

if (supabase) cloudStatus.textContent = "Supabase connected";

function render() {
  boardElement.innerHTML = "";
  const lastMove = game.history({ verbose: true }).at(-1);
  const position = game.board();
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const squareName = `${files[col]}${8 - row}`;
      const piece = position[row][col];
      const square = document.createElement("button");
      square.className = `square ${(row + col) % 2 ? "dark" : "light"}`;
      square.type = "button";
      square.setAttribute("role", "gridcell");
      square.setAttribute("aria-label", `${squareName}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${pieceNames[piece.type]}` : ", empty"}`);
      if (selectedSquare === squareName) square.classList.add("selected");
      if (lastMove && (lastMove.from === squareName || lastMove.to === squareName)) square.classList.add("last-move");
      const target = legalMoves.find((move) => move.to === squareName);
      if (target) {
        square.classList.add("legal");
        if (target.captured) square.classList.add("capture");
      }
      if (piece) {
        const pieceElement = document.createElement("span");
        pieceElement.className = `piece ${piece.color === "w" ? "white" : "black"}`;
        pieceElement.textContent = symbols[piece.color][piece.type];
        square.append(pieceElement);
      }
      square.addEventListener("click", () => handleSquareClick(squareName));
      boardElement.append(square);
    }
  }
  updatePanel();
}

function handleSquareClick(squareName) {
  if (gameOver) return;
  const target = legalMoves.find((move) => move.to === squareName);
  if (selectedSquare && target) {
    try {
      game.move({ from: selectedSquare, to: squareName, promotion: "q" });
      selectedSquare = null;
      legalMoves = [];
      updateGameState();
      render();
    } catch {
      selectedSquare = null;
      legalMoves = [];
      render();
    }
    return;
  }
  const piece = game.get(squareName);
  if (piece && piece.color === game.turn()) {
    selectedSquare = squareName;
    legalMoves = game.moves({ square: squareName, verbose: true });
  } else {
    selectedSquare = null;
    legalMoves = [];
  }
  render();
}

function updateGameState() {
  if (game.isCheckmate()) {
    gameOver = true;
    gameStatus.textContent = `${game.turn() === "w" ? "Black" : "White"} wins by checkmate`;
  } else if (game.isStalemate() || game.isDraw()) {
    gameOver = true;
    gameStatus.textContent = "Draw game";
  } else {
    gameOver = false;
    gameStatus.textContent = game.isCheck() ? `${game.turn() === "w" ? "White" : "Black"} is in check` : `${game.turn() === "w" ? "White" : "Black"} is thinking`;
  }
}

function updatePanel() {
  const isWhiteTurn = game.turn() === "w";
  turnBadge.innerHTML = `<span class="turn-piece ${isWhiteTurn ? "" : "black"}"></span> ${gameOver ? "Game over" : `${isWhiteTurn ? "White" : "Black"} to move`}`;
  document.querySelector("#whitePlayer").classList.toggle("active", isWhiteTurn && !gameOver);
  document.querySelector("#blackPlayer").classList.toggle("active", !isWhiteTurn && !gameOver);
  const history = game.history({ verbose: true });
  document.querySelector("#moveCount").textContent = history.length;
  undoButton.disabled = history.length === 0;
  moveListElement.innerHTML = history.length ? history.reduce((html, move, index) => {
    const moveNumber = Math.floor(index / 2) + 1;
    return index % 2 === 0 ? `${html}<div class="move-row"><span class="move-number">${moveNumber}.</span><span>${move.san}</span>` : `${html}<span>${move.san}</span></div>`;
  }, "") : `<p class="empty-moves">Make the first move.</p>`;
  const whiteCaptured = history.filter((move) => move.color === "w" && move.captured).map((move) => symbols.b[move.captured]).join("");
  const blackCaptured = history.filter((move) => move.color === "b" && move.captured).map((move) => symbols.w[move.captured]).join("");
  document.querySelector("#whiteCaptured").textContent = whiteCaptured;
  document.querySelector("#blackCaptured").textContent = blackCaptured;
}

function undoMove() {
  if (!game.history().length) return;
  game.undo();
  gameOver = false;
  selectedSquare = null;
  legalMoves = [];
  updateGameState();
  render();
}

function resetGame() {
  game.reset();
  gameOver = false;
  selectedSquare = null;
  legalMoves = [];
  gameStatus.textContent = "White is thinking";
  render();
}

async function saveOnline() {
  if (!supabase) {
    cloudStatus.textContent = "Add Supabase keys to .env";
    return;
  }
  saveButton.disabled = true;
  cloudStatus.textContent = "Saving...";
  const { error } = await supabase.from("games").upsert({
    id: gameId,
    fen: game.fen(),
    moves: game.history(),
    status: gameOver ? gameStatus.textContent : "in_progress"
  });
  saveButton.disabled = false;
  cloudStatus.textContent = error ? "Could not save game" : `Saved ${gameId.slice(0, 8)}`;
}

undoButton.addEventListener("click", undoMove);
document.querySelector("#resetButton").addEventListener("click", resetGame);
saveButton.addEventListener("click", saveOnline);
document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() === "r") resetGame();
});

render();
