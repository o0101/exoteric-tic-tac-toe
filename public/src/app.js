import {e} from './web_modules/exoteric/r.js';

// state object
  const AppState = {state:null};

// main startup procedure
run();

async function run() {
  initState(AppState);
  Game(AppState).to('#app', 'innerHTML');
}

// init state 
  function initState(State) {
    return State.state = {
      squares: Array(9).fill(''),
      xIsNext: true,
    };
  }

// view funcs
  function Game({state}) {
    return e`
      <div class="game">
        <div class="game-board">
          ${Board(state)}
        </div>
        <div class="game-info">
          <div>${''/* status */}</div>
          <ol>${''/* TODO */}</ol>
          <button click=${() => setState(initState(AppState))}>Reset</button>
        </div>
      </div>
    `;
  }

  function Board(state) {
    const {squares, xIsNext} = state;
    const winner = calculateWinner(squares);
    let status;
    if (winner) {
      status = 'Winner: ' + winner;
    } else {
      status = 'Next player: ' + (xIsNext ? 'X' : 'O');
    }

    const renderSquare = i => Square({state,i});

    return e`
      <div>
        <div class="status">${status}</div>
        <div class="board-row">
          ${renderSquare(0)}
          ${renderSquare(1)}
          ${renderSquare(2)}
        </div>
        <div class="board-row">
          ${renderSquare(3)}
          ${renderSquare(4)}
          ${renderSquare(5)}
        </div>
        <div class="board-row">
          ${renderSquare(6)}
          ${renderSquare(7)}
          ${renderSquare(8)}
        </div>
      </div>
    `;
  }

  function Square({state, i}) {
    const key = i;
    return e`${{key}}
      <button class="square" click=${() => handleClick({state,i})}>
        ${state.squares[i]}
      </button>
    `;
  }

// event handler
  function handleClick({state,i}) {
    const squares = state.squares.slice();
    if (calculateWinner(squares) || squares[i]) {
      return;
    }
    squares[i] = state.xIsNext ? 'X' : 'O';
    setState({
      squares: squares,
      xIsNext: !state.xIsNext,
    });
  }

// helpers
  function calculateWinner(squares) {
    const lines = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8],
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8],
      [0, 4, 8],
      [2, 4, 6],
    ];
    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  }

  function setState(state) {
    AppState.state = state;
    Game(AppState);
  }

  
