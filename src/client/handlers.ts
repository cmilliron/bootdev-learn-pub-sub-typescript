import {
  GameState,
  type PlayingState,
} from "../internal/gamelogic/gamestate.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { type ArmyMove } from "../internal/gamelogic/gamedata.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => void {
  // console.log("handler called");
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
  };
}

export function handlerMove(gs: GameState): (move: ArmyMove) => void {
  return (move: ArmyMove) => {
    const move_result = handleMove(gs, move);
    console.log(`Moved ${move.units.length} units to ${move.toLocation}`);
    process.stdout.write("> ");
  };
}
