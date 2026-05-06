import {
  GameState,
  type PlayingState,
} from "../internal/gamelogic/gamestate.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import { type ArmyMove } from "../internal/gamelogic/gamedata.js";
import { AckType } from "../internal/pubsub/subscribe.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  // console.log("handler called");
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return AckType.Ack;
  };
}

export function handlerMove(gs: GameState): (move: ArmyMove) => AckType {
  return (move: ArmyMove) => {
    const move_result = handleMove(gs, move);
    console.log(`Moved ${move.units.length} units to ${move.toLocation}`);
    if (move_result == MoveOutcome.Safe || move_result == MoveOutcome.MakeWar) {
      return AckType.Ack;
    }
    if (move_result == MoveOutcome.SamePlayer) {
      return AckType.NackDiscard;
    }
    process.stdout.write("> ");
    return AckType.NackDiscard;
  };
}
