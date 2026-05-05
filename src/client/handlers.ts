import {
  GameState,
  type PlayingState,
} from "../internal/gamelogic/gamestate.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => void {
  console.log("handler called");
  return (ps) => {
    console.log(ps);
    if (ps.isPaused) {
      gs.pauseGame();
    } else {
      gs.resumeGame();
    }
    console.log("> ");
  };
}
