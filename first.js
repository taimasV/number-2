const symbols = {
	w: { k: "♔", q: "♕", r: "♖", b: "♗", n: "♘", p: "♙" },
	b: { k: "♚", q: "♛", r: "♜", b: "♝", n: "♞", p: "♟" }
};
const names = { k: "King", q: "Queen", r: "Rook", b: "Bishop", n: "Knight", p: "Pawn" };
const files = "abcdefgh";

let board = createStartingBoard();
let turn = "w";
let selected = null;
let legalTargets = [];
let history = [];
let captured = { w: [], b: [] };
let gameOver = false;

const boardElement = document.querySelector("#board");
const moveListElement = document.querySelector("#moveList");
const turnBadge = document.querySelector("#turnBadge");
const gameStatus = document.querySelector("#gameStatus");
const undoButton = document.querySelector("#undoButton");

function createStartingBoard() {
	const backRank = ["r", "n", "b", "q", "k", "b", "n", "r"];
	return [
		backRank.map((type) => ({ color: "b", type })),
		Array(8).fill(null).map(() => ({ color: "b", type: "p" })),
		...Array(4).fill(null).map(() => Array(8).fill(null)),
		Array(8).fill(null).map(() => ({ color: "w", type: "p" })),
		backRank.map((type) => ({ color: "w", type }))
	];
}

function render() {
	boardElement.innerHTML = "";
	const lastMove = history.at(-1);
	for (let row = 0; row < 8; row += 1) {
		for (let col = 0; col < 8; col += 1) {
			const square = document.createElement("button");
			const piece = board[row][col];
			const isDark = (row + col) % 2 === 1;
			square.className = `square ${isDark ? "dark" : "light"}`;
			square.setAttribute("role", "gridcell");
			square.setAttribute("aria-label", `${files[col]}${8 - row}${piece ? `, ${piece.color === "w" ? "white" : "black"} ${names[piece.type]}` : "empty"}`);
			if (selected && selected.row === row && selected.col === col) square.classList.add("selected");
			if (lastMove && ((lastMove.from.row === row && lastMove.from.col === col) || (lastMove.to.row === row && lastMove.to.col === col))) square.classList.add("last-move");
			const target = legalTargets.find((move) => move.row === row && move.col === col);
			if (target) {
				square.classList.add("legal");
				if (piece) square.classList.add("capture");
			}
			if (piece) {
				const pieceElement = document.createElement("span");
				pieceElement.className = `piece ${piece.color === "w" ? "white" : "black"}`;
				pieceElement.textContent = symbols[piece.color][piece.type];
				square.append(pieceElement);
			}
			square.addEventListener("click", () => handleSquareClick(row, col));
			boardElement.append(square);
		}
	}
	updatePanel();
}

function handleSquareClick(row, col) {
	if (gameOver) return;
	const piece = board[row][col];
	const target = legalTargets.find((move) => move.row === row && move.col === col);
	if (selected && target) {
		makeMove(selected, { row, col });
		return;
	}
	if (piece && piece.color === turn) {
		selected = { row, col };
		legalTargets = getLegalMoves(row, col);
	} else {
		selected = null;
		legalTargets = [];
	}
	render();
}

function makeMove(from, to) {
	const movingPiece = board[from.row][from.col];
	const capturedPiece = board[to.row][to.col];
	const notation = getNotation(from, to, movingPiece, capturedPiece);
	history.push({ from, to, piece: { ...movingPiece }, captured: capturedPiece ? { ...capturedPiece } : null, notation });
	board[to.row][to.col] = movingPiece;
	board[from.row][from.col] = null;
	if (capturedPiece) captured[movingPiece.color].push(capturedPiece);
	turn = turn === "w" ? "b" : "w";
	selected = null;
	legalTargets = [];
	updateGameState();
	render();
}

function getLegalMoves(row, col) {
	const piece = board[row][col];
	if (!piece) return [];
	return getPseudoMoves(row, col).filter((move) => {
		const testBoard = cloneBoard(board);
		testBoard[move.row][move.col] = testBoard[row][col];
		testBoard[row][col] = null;
		return !isInCheck(piece.color, testBoard);
	});
}

function getPseudoMoves(row, col, position = board, attackOnly = false) {
	const piece = position[row][col];
	if (!piece) return [];
	const moves = [];
	const add = (targetRow, targetCol) => {
		if (targetRow < 0 || targetRow > 7 || targetCol < 0 || targetCol > 7) return false;
		const target = position[targetRow][targetCol];
		if (!target) { moves.push({ row: targetRow, col: targetCol }); return true; }
		if (target.color !== piece.color && (target.type !== "k" || attackOnly)) moves.push({ row: targetRow, col: targetCol });
		return false;
	};
	if (piece.type === "p") {
		const direction = piece.color === "w" ? -1 : 1;
		const startRow = piece.color === "w" ? 6 : 1;
		if (position[row + direction]?.[col] === null) {
			moves.push({ row: row + direction, col });
			if (row === startRow && position[row + direction * 2][col] === null) moves.push({ row: row + direction * 2, col });
		}
		for (const offset of [-1, 1]) {
			const target = position[row + direction]?.[col + offset];
			if (target && target.color !== piece.color && target.type !== "k") moves.push({ row: row + direction, col: col + offset });
		}
	}
	if (piece.type === "n") [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]].forEach(([r, c]) => add(row + r, col + c));
	if (piece.type === "k") for (let r = -1; r <= 1; r += 1) for (let c = -1; c <= 1; c += 1) if (r || c) add(row + r, col + c);
	const directions = [];
	if (["r", "q"].includes(piece.type)) directions.push([-1, 0], [1, 0], [0, -1], [0, 1]);
	if (["b", "q"].includes(piece.type)) directions.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
	directions.forEach(([r, c]) => { let targetRow = row + r; let targetCol = col + c; while (add(targetRow, targetCol)) { targetRow += r; targetCol += c; } });
	return moves.filter((move) => move.row >= 0 && move.row < 8 && move.col >= 0 && move.col < 8);
}

function isInCheck(color, position = board) {
	let king;
	for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) if (position[row][col]?.color === color && position[row][col].type === "k") king = { row, col };
	if (!king) return true;
	const enemy = color === "w" ? "b" : "w";
	for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) if (position[row][col]?.color === enemy) {
		if (getPseudoMoves(row, col, position, true).some((move) => move.row === king.row && move.col === king.col)) return true;
		if (position[row][col].type === "p" && Math.abs(col - king.col) === 1 && movePawnAttacks(row, col, king, position)) return true;
	}
	return false;
}

function movePawnAttacks(row, col, king, position) {
	const direction = position[row][col].color === "w" ? -1 : 1;
	return row + direction === king.row;
}

function hasLegalMoves(color) {
	for (let row = 0; row < 8; row += 1) for (let col = 0; col < 8; col += 1) if (board[row][col]?.color === color && getLegalMoves(row, col).length) return true;
	return false;
}

function updateGameState() {
	const checked = isInCheck(turn);
	if (!hasLegalMoves(turn)) {
		gameOver = true;
		gameStatus.textContent = checked ? `${turn === "w" ? "Black" : "White"} wins by checkmate` : "Draw by stalemate";
	} else {
		gameOver = false;
		gameStatus.textContent = checked ? `${turn === "w" ? "White" : "Black"} is in check` : `${turn === "w" ? "White" : "Black"} is thinking`;
	}
}

function updatePanel() {
	const turnName = turn === "w" ? "White" : "Black";
	turnBadge.innerHTML = `<span class="turn-piece ${turn === "b" ? "black" : ""}"></span> ${gameOver ? "Game over" : `${turnName} to move`}`;
	document.querySelector("#whitePlayer").classList.toggle("active", turn === "w" && !gameOver);
	document.querySelector("#blackPlayer").classList.toggle("active", turn === "b" && !gameOver);
	document.querySelector("#moveCount").textContent = history.length;
	undoButton.disabled = history.length === 0;
	moveListElement.innerHTML = history.length ? history.reduce((html, move, index) => index % 2 === 0 ? `${html}<div class="move-row"><span class="move-number">${Math.floor(index / 2) + 1}.</span><span>${move.notation}</span>` : `${html}<span>${move.notation}</span></div>`, "") : `<p class="empty-moves">Make the first move.</p>`;
	document.querySelector("#whiteCaptured").textContent = captured.b.map((piece) => symbols.b[piece.type]).join("");
	document.querySelector("#blackCaptured").textContent = captured.w.map((piece) => symbols.w[piece.type]).join("");
}

function getNotation(from, to, piece, capturedPiece) {
	const prefix = piece.type === "p" ? (capturedPiece ? files[from.col] : "") : piece.type.toUpperCase();
	return `${prefix}${capturedPiece ? "x" : "-"}${files[to.col]}${8 - to.row}`;
}

function cloneBoard(position) { return position.map((row) => row.map((piece) => piece ? { ...piece } : null)); }

function undoMove() {
	const lastMove = history.pop();
	if (!lastMove) return;
	board[lastMove.from.row][lastMove.from.col] = lastMove.piece;
	board[lastMove.to.row][lastMove.to.col] = lastMove.captured;
	if (lastMove.captured) captured[lastMove.piece.color].pop();
	turn = lastMove.piece.color;
	selected = null;
	legalTargets = [];
	gameOver = false;
	updateGameState();
	render();
}

function resetGame() {
	board = createStartingBoard(); turn = "w"; selected = null; legalTargets = []; history = []; captured = { w: [], b: [] }; gameOver = false;
	gameStatus.textContent = "White is thinking";
	render();
}

undoButton.addEventListener("click", undoMove);
document.querySelector("#resetButton").addEventListener("click", resetGame);
document.addEventListener("keydown", (event) => { if (event.key.toLowerCase() === "r") resetGame(); });
render();
