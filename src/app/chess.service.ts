import { Injectable } from "@angular/core";
import { ChessBoard } from "./checkerBoard";
import { chessSpace } from "./space";
import {
    chessPiece,
    chessPawn,
    Rook,
    Knight,
    Bishop,
    chessKing,
    Queen
} from "./pieces/piece";
import { BehaviorSubject } from "rxjs/BehaviorSubject";

@Injectable()
export class ChessService {
    public board: any;
    private _selectedPiece: chessPiece = null;
    private _checkPiece: chessPiece = null;
    private _whiteTurn: boolean = true;

    // Behavior Subjects
    private _whiteTurnBeh: BehaviorSubject<boolean>;
    private _resetGame: BehaviorSubject<boolean>;
    private _isWinner: BehaviorSubject<string>;

    constructor() {
        this._whiteTurnBeh = <BehaviorSubject<boolean>>new BehaviorSubject(
            true
        );
        this._resetGame = <BehaviorSubject<boolean>>new BehaviorSubject(true);
        this._isWinner = <BehaviorSubject<string>>new BehaviorSubject("none");
        this._resetGame.subscribe(reset => {
            if (reset) {
                this.resetGame();
            }
        });
    }

    // Resets game back to beginning
    resetGame() {
        this.board = new ChessBoard().board;
        this._whiteTurn = true;
        this.loadResetGame(false);
        this.loadIsWinner("none");
        // Adding pawns
        for (let j = 0; j < 8; j++) {
            this.board[1][j].addPiece(new chessPawn("white", 1, j));
            this.board[6][j].addPiece(new chessPawn("black", 1, j));
        }
        // Adding rooks
        this.board[0][0].addPiece(new Rook("white", 0, 0));
        this.board[0][7].addPiece(new Rook("white", 0, 7));
        this.board[7][0].addPiece(new Rook("black", 7, 0));
        this.board[7][7].addPiece(new Rook("black", 7, 7));
        // Adding knights
        this.board[0][1].addPiece(new Knight("white", 0, 1));
        this.board[0][6].addPiece(new Knight("white", 0, 6));
        this.board[7][1].addPiece(new Knight("black", 7, 1));
        this.board[7][6].addPiece(new Knight("black", 7, 6));
        // Adding bishops
        this.board[0][2].addPiece(new Bishop("white", 0, 2));
        this.board[0][5].addPiece(new Bishop("white", 0, 5));
        this.board[7][2].addPiece(new Bishop("black", 7, 2));
        this.board[7][5].addPiece(new Bishop("black", 7, 5));
        // Adding kings
        this.board[0][3].addPiece(new chessKing("white", 0, 3));
        this.board[7][3].addPiece(new chessKing("black", 7, 3));
        // Adding queens
        this.board[0][4].addPiece(new Queen("white", 0, 4));
        this.board[7][4].addPiece(new Queen("black", 7, 4));

        this._whiteTurnBeh.subscribe(turn => {
            this.highlightKingSpace(this.check());
            if (this.check()) {
                this.checkmate();
            }
        });
    }

    // When we're playing checkers we want to delete the chessboard
    deleteBoard() {
        delete this.board;
    }

    // Observables and Behavioral Subjects

    loadWhiteTurn(turn: boolean) {
        this._whiteTurnBeh.next(turn);
    }

    loadResetGame(reset: boolean) {
        this._resetGame.next(reset);
    }

    loadIsWinner(winner: string) {
        this._isWinner.next(winner);
    }

    get whiteTurnObs() {
        return this._whiteTurnBeh.asObservable();
    }

    // For Game Console
    get resetGameBeh() {
        return this._resetGame;
    }

    // For Game Board
    get resetGameObs() {
        return this._resetGame.asObservable();
    }

    // For Game Board
    get isWinnerObs() {
        return this._isWinner.asObservable();
    }

    // Click events for pieces and spaces

    // Click on a piece on the board
    clickAPiece(p: chessPiece) {
        if (this._selectedPiece === null) {
            // Piece is being selected not taken
            this.selectAPiece(p);
        } else if (
            this._selectedPiece !== null &&
            p.isWhite === !this._selectedPiece.isWhite
        ) {
            // Evaluating if piece can be taken by selected piece
            let type = this._selectedPiece.type;
            let sp = this.findPiece(p);
            this.moveSelected(sp);
        } else {
            // piece is same color as selected piece so select the new piece
            this.selectAPiece(p);
        }
    }

    // Click on an empty space on the board
    clickEmptySpace(sp: chessSpace) {
        if (
            this._selectedPiece !== null &&
            this._selectedPiece.type === "chessKing"
        ) {
            this.castle(sp);
        } else if (this._selectedPiece !== null) {
            this.moveSelected(sp);
        }
    }

    // Selecting a piece to move
    selectAPiece(p: chessPiece) {
        if (p.isWhite === this._whiteTurn) {
            this.clearSelections();
            this._selectedPiece = p;
            this.findPiece(this._selectedPiece).highlight = true;
        }
    }

    /* Function that will determine whether the king can escape check.  Runs every time the king is in check.*/
    checkmate() {
        let checkmate = true;

        // Moves every piece for the current team still on the board and tests whether it will get the king out of check.  If it does, then there's no winner.  If none of the pieces get the king out of check, even the king himself, then someone won.
        let pieceArray = this.getPieceArray(this._whiteTurn);
        if (checkmate) {
            pieceArray.forEach(piece => {
                this.getMoveSpaces(piece).forEach(space => {
                    if (!this.testMove(piece, space)) {
                        console.log("piece: ", piece, "space: ", space);
                        checkmate = false;
                    }
                });
            });
        }

        if (checkmate) {
            this.loadIsWinner(this._whiteTurn ? "Black" : "White");
        }
    }

    // Given a piece on the board, return an array of all the possible spaces it could move to, including those where it would be capturing another piece
    getMoveSpaces(p: chessPiece) {
        let spaceArray = new Array();

        this.board.forEach(row =>
            row.forEach(space => {
                if (this.canMovePiece(p, space)) {
                    spaceArray.push(space);
                }
            })
        );

        return spaceArray;
    }

    /* For a given piece, test if moving it to the given space will leave the king in check.  Then move it back leaving the board the same as it was before the test. */
    testMove(p: chessPiece, sp: chessSpace): boolean {
        let check: boolean = false; // Flag that we return saying whether the move removes the check from the king

        if (sp.piece === null) {
            // move to empty space
            check = this.movePieceToEmptySpTest(p, sp);
        } else if (sp.piece !== null && sp.piece.isWhite === !p.isWhite) {
            // piece to take here
            check = this.movePieceToTakeTest(p, sp.piece);
        } else {
            // can't move here, so king would still be in check
            check = true;
        }

        return check;
    }

    // Move the given piece to take a piece
    movePieceToTakeTest(p: chessPiece, take: chessPiece): boolean {
        let sp = this.findPiece(take);
        let check = false;

        sp.clearPiece(); // clear out the taken piece from the space

        if (this.movePieceToEmptySpTest(p, sp)) {
            // If the king was in check from the move
            check = true;
        }

        sp.addPiece(take);

        return check;
    }

    // Move any piece to an empty space.  For testing if king is in check
    movePieceToEmptySpTest(p: chessPiece, sp: chessSpace): boolean {
        let space_old = this.findPiece(p); // storing piece old space in case king is in check
        let check = false;

        space_old.clearPiece();
        sp.addPiece(p);

        if (this.check()) {
            check = true;
        }

        sp.clearPiece();
        space_old.addPiece(p);

        return check;
    }

    /* Check function will see if the king of the team of the current turn is in check.  If it is, the current team will only be able to move pieces that get the king out of check. */
    check(): boolean {
        // Get other team pieces
        let pieceArray = this.getPieceArray(!this._whiteTurn);

        // Get the King space of the current team
        let kingSp: chessSpace = this.findKingSpace();

        // Check if the pieces from the other team could take the king
        let check: boolean = false;
        pieceArray.forEach(piece => {
            if (this.canMovePiece(piece, kingSp)) {
                this._checkPiece = piece;
                check = true;
            }
        });

        return check;
    }

    /* Highlights the King space of the current team */
    highlightKingSpace(check: boolean) {
        this.board.forEach(row => row.forEach(space => (space.check = false))); // First remove highlight from all old squares
        let king: chessSpace = this.findKingSpace();
        king.check = check;
    }

    /* Find the king space for the current team's turn */
    findKingSpace(): chessSpace {
        let king: chessSpace = null;
        this.board.forEach(row => {
            row.forEach(space => {
                if (
                    space.piece !== null &&
                    space.piece.isWhite === this._whiteTurn &&
                    space.piece.type === "chessKing"
                ) {
                    king = space;
                }
            });
        });
        return king;
    }

    /* For a piece on the board, check if it can move to the specified space, or take the piece in the space (if there is a piece there)*/
    canMovePiece(p: chessPiece, sp: chessSpace): boolean {
        let type = p.type;
        let move = false;

        switch (type) {
            /*
            case "chessPawn":
                if (
                    ((<chessPawn>p).canMove(sp.row, sp.col) &&
                        this.isMoveClear(p, sp)) ||
                    (<chessPawn>p).canTake(sp.row, sp.col)
                ) {
                    move = true;
                }
                break;
            */
            case "rook":
                if (
                    (<Rook>p).canMove(sp.row, sp.col) &&
                    this.isMoveClear(p, sp)
                ) {
                    move = true;
                }
                break;

            case "knight":
                if ((<Knight>p).canMove(sp.row, sp.col)) {
                    move = true;
                }
                break;

            case "bishop":
                if (
                    (<Bishop>p).canMove(sp.row, sp.col) &&
                    this.isMoveClear(p, sp)
                ) {
                    move = true;
                }
                break;

            case "queen":
                if (
                    (<Queen>p).canMove(sp.row, sp.col) &&
                    this.isMoveClear(p, sp)
                ) {
                    move = true;
                }
                break;

            case "chessKing":
                if ((<chessKing>p).canMove(sp.row, sp.col)) {
                    move = true;
                }
                break;
        }

        // If there's a piece in the space I want to move to and it's the same color as me, don't allow a move here
        if (sp.piece !== null && sp.piece.isWhite === p.isWhite) {
            move = false;
        }

        if (type === "chessPawn") {
            if (
                sp.piece !== null &&
                sp.piece.isWhite === !p.isWhite &&
                (<chessPawn>p).canTake(sp.row, sp.col)
            ) {
                move = true;
            } else if (
                (<chessPawn>p).canMove(sp.row, sp.col) &&
                this.isMoveClear(p, sp) &&
                sp.piece === null
            ) {
                move = true;
            } else {
                move = false;
            }
        }

        return move;
    }

    /* Function that will move the selected piece to the given space
    If the space contains a piece of the opposite color the piece will be taken,
    otherwise the selected piece will just move to the empty space. */
    moveSelected(sp: chessSpace) {
        let type = this._selectedPiece.type;
        let take = false;

        if (
            sp.piece !== null &&
            sp.piece.isWhite === !this._selectedPiece.isWhite
        ) {
            take = true;
        }

        switch (type) {
            case "chessPawn":
                if (
                    take &&
                    (<chessPawn>this._selectedPiece).canTake(sp.row, sp.col) &&
                    this.isMoveClear(this._selectedPiece, sp)
                ) {
                    this.moveSelectedToTake(sp.piece);
                } else if (
                    !take &&
                    (<chessPawn>this._selectedPiece).canMove(sp.row, sp.col) &&
                    this.isMoveClear(this._selectedPiece, sp)
                ) {
                    this.moveSelectedToEmptySp(sp);
                } else {
                    this.selectAPiece(this._selectedPiece);
                }
                break;
            case "rook":
                if (
                    (<Rook>this._selectedPiece).canMove(sp.row, sp.col) &&
                    this.isMoveClear(this._selectedPiece, sp)
                ) {
                    take
                        ? this.moveSelectedToTake(sp.piece)
                        : this.moveSelectedToEmptySp(sp);
                } else {
                    this.selectAPiece(this._selectedPiece);
                }
                break;
            case "knight":
                if ((<Knight>this._selectedPiece).canMove(sp.row, sp.col)) {
                    take
                        ? this.moveSelectedToTake(sp.piece)
                        : this.moveSelectedToEmptySp(sp);
                } else {
                    this.selectAPiece(this._selectedPiece);
                }
                break;
            case "bishop":
                if (
                    (<Bishop>this._selectedPiece).canMove(sp.row, sp.col) &&
                    this.isMoveClear(this._selectedPiece, sp)
                ) {
                    take
                        ? this.moveSelectedToTake(sp.piece)
                        : this.moveSelectedToEmptySp(sp);
                } else {
                    this.selectAPiece(this._selectedPiece);
                }
                break;
            case "queen":
                if (
                    (<Queen>this._selectedPiece).canMove(sp.row, sp.col) &&
                    this.isMoveClear(this._selectedPiece, sp)
                ) {
                    take
                        ? this.moveSelectedToTake(sp.piece)
                        : this.moveSelectedToEmptySp(sp);
                } else {
                    this.selectAPiece(this._selectedPiece);
                }
                break;
            case "chessKing":
                if ((<chessKing>this._selectedPiece).canMove(sp.row, sp.col)) {
                    take
                        ? this.moveSelectedToTake(sp.piece)
                        : this.moveSelectedToEmptySp(sp);
                } else {
                    this.selectAPiece(this._selectedPiece);
                }
                break;
        }
    }

    // Move the selected piece to take a piece
    moveSelectedToTake(p: chessPiece) {
        let sp = this.findPiece(p);

        sp.clearPiece(); // clear out the taken piece from the space

        if (this.moveSelectedToEmptySp(sp)) {
            // If the king was in check from the move, put the old piece back in the empty space
            sp.addPiece(p);
            this.highlightKingSpace(true);
        }
    }

    // Move the selected piece to an empty space.  If the king was in check while moving, return true for moveSelectedToTake
    moveSelectedToEmptySp(sp: chessSpace): boolean {
        let space_old = this.findPiece(this._selectedPiece); // storing piece old space in case king is in check
        let check = false;

        space_old.clearPiece();
        sp.addPiece(this._selectedPiece);

        if (!this.check()) {
            // after the move the king is not in check
            this.highlightKingSpace(false);
            this.initializeSelected();
            this._whiteTurn = !this._whiteTurn;
            this.loadWhiteTurn(this._whiteTurn);
            this.clearSelections();
        } else {
            // after the move the king was in check so revert
            sp.clearPiece();
            space_old.addPiece(this._selectedPiece);
            check = true;
        }
        return check;
    }

    // If the selected piece needs to be initialized on the first turn, do that here
    initializeSelected() {
        let type = this._selectedPiece.type;
        if (type === "chessPawn") {
            (<chessPawn>this._selectedPiece).initialized = true;
        }
        if (type === "chessKing") {
            (<chessKing>this._selectedPiece).initialized = true;
        }
        if (type === "rook") {
            (<Rook>this._selectedPiece).initialized = true;
        }
    }

    // Special move where the king and rook switch places
    // See https://en.wikipedia.org/wiki/Castling?oldformat=true
    castle(sp: chessSpace) {
        let isAllowed: boolean = false;
        let isLeft: boolean = sp.col < this._selectedPiece.col;
        let spaceMoved: number = Math.abs(this._selectedPiece.col - sp.col);
        let row: number = this._selectedPiece.isRed ? 0 : 7;
        let rookCol: number = isLeft ? 0 : 7;
        let rookSp: chessSpace = this.board[row][rookCol];
        let rook: Rook;

        if (
            this._selectedPiece.type === "chessKing" &&
            !(<chessKing>this._selectedPiece).initialized
        ) {
            if (
                spaceMoved === 2 &&
                rookSp.piece !== null &&
                rookSp.piece.type === "rook" &&
                !(<Rook>rookSp.piece).initialized
            ) {
                rook = <Rook>rookSp.piece;
                isAllowed = true;
            }
        }

        if (isAllowed) {
            if (isLeft) {
                rookSp.clearPiece();
                this.board[row][2].addPiece(rook);
                this.moveSelectedToEmptySp(sp);
            } else {
                rookSp.clearPiece();
                this.board[row][4].addPiece(rook);
                this.moveSelectedToEmptySp(sp);
            }
        } else {
            this.moveSelected(sp);
        }
    }

    /* Is Move Clear functionality
    These functions help determine if the path is clear between the selected piece
    and the space that the piece is moving to */

    // Determines whether to use the straight or diag function to check
    isMoveClear(p: chessPiece, sp: chessSpace) {
        let spRow = sp.row;
        let spCol = sp.col;
        let pRow = p.row;
        let pCol = p.col;
        let isClear = true;

        if (spRow === pRow || spCol === pCol) {
            isClear = this.isMoveClearStraight(p, sp);
        } else {
            isClear = this.isMoveClearDiag(p, sp);
        }

        return isClear;
    }

    // Determines if the space has a piece between the piece
    // and the space on a straight line
    isMoveClearStraight(p: chessPiece, sp: chessSpace): boolean {
        let colDiff = Math.abs(p.col - sp.col);
        let rowDiff = Math.abs(p.row - sp.row);

        let isClear = true;

        if (colDiff === 0) {
            let rowStart = Math.min(p.row, sp.row);
            let rowEnd = rowStart + rowDiff;

            for (let i = rowStart + 1; i < rowEnd; i++) {
                if (this.board[i][p.col].piece !== null) {
                    isClear = false;
                }
            }
        }

        if (rowDiff === 0) {
            let colStart = Math.min(p.col, sp.col);
            let colEnd = colStart + colDiff;
            let colArr = this.board[p.row].slice(colStart + 1, colEnd);

            colArr.forEach(sp => {
                if (sp.piece !== null) {
                    isClear = false;
                }
            });
        }

        return isClear;
    }

    // Determines if the space has a piece between the piece
    // and the space on a diagonal line
    isMoveClearDiag(p: chessPiece, sp: chessSpace): boolean {
        let spRow = sp.row;
        let spCol = sp.col;
        let pRow = p.row;
        let pCol = p.col;
        let diagLen = Math.abs(spRow - pRow);
        let isClear = true;

        for (let i = 1; i < diagLen; i++) {
            // Up Right
            if (spRow < pRow && spCol > pCol) {
                if (this.board[pRow - i][pCol + i].piece !== null) {
                    isClear = false;
                }
            }
            // Up Left
            if (spRow < pRow && spCol < pCol) {
                if (this.board[pRow - i][pCol - i].piece !== null) {
                    isClear = false;
                }
            }
            // Down Right
            if (spRow > pRow && spCol > pCol) {
                if (this.board[pRow + i][pCol + i].piece !== null) {
                    isClear = false;
                }
            }
            // Down Left
            if (spRow > pRow && spCol < pCol) {
                if (this.board[pRow + i][pCol - i].piece !== null) {
                    isClear = false;
                }
            }
        }

        return isClear;
    }

    // Finds a piece on the board and returns the space it is on
    findPiece(p: chessPiece): chessSpace {
        let sp: chessSpace = null;

        // Look through the board and see if the piece is on a space
        this.board.forEach(row =>
            row.forEach(space => {
                if (space.piece === p) {
                    sp = space;
                }
            })
        );

        return sp;
    }

    // Get array of pieces for the white or the black team
    getPieceArray(white: boolean) {
        let pieceArray = new Array();
        this.board.forEach(row => {
            row.forEach(space => {
                if (space.piece !== null && space.piece.isWhite === white) {
                    pieceArray.push(space.piece);
                }
            });
        });

        return pieceArray;
    }

    // Clears all highlights, direction flags, and selected pieces from board
    clearSelections() {
        this.board.forEach(row =>
            row.forEach(space => {
                space.highlight = space.moveTo = space.jump = false;
                if (space.piece !== null) {
                    space.piece.jump = false;
                }
            })
        );
        this._selectedPiece = null;
    }
}
