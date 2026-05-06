import {
  GameState,
  type PlayingState,
} from "../internal/gamelogic/gamestate.js";
import { handlePause } from "../internal/gamelogic/pause.js";
import { handleMove, MoveOutcome } from "../internal/gamelogic/move.js";
import {
  type ArmyMove,
  type RecognitionOfWar,
} from "../internal/gamelogic/gamedata.js";
import { AckType } from "../internal/pubsub/subscribe.js";
import type { ConfirmChannel } from "amqplib";
import { publishJSON } from "../internal/pubsub/publish.js";
import {
  ExchangePerilTopic,
  WarRecognitionsPrefix,
} from "../internal/routing/routing.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";

export function handlerPause(gs: GameState): (ps: PlayingState) => AckType {
  // console.log("handler called");
  return (ps: PlayingState) => {
    handlePause(gs, ps);
    process.stdout.write("> ");
    return AckType.Ack;
  };
}

export function handlerMove(
  gs: GameState,
  confirmChannel: ConfirmChannel,
): (move: ArmyMove) => Promise<AckType> {
  return async (move: ArmyMove) => {
    let msg: AckType;
    try {
      const moveResult = handleMove(gs, move);
      console.log(`Moved ${move.units.length} units to ${move.toLocation}`);
      switch (moveResult) {
        case MoveOutcome.SamePlayer:
        case MoveOutcome.Safe:
          msg = AckType.Ack;
          break;

        case MoveOutcome.MakeWar:
          try {
            const rw: RecognitionOfWar = {
              attacker: move.player,
              defender: gs.getPlayerSnap(),
            };
            await publishJSON(
              confirmChannel,
              ExchangePerilTopic,
              `${WarRecognitionsPrefix}.${gs.getUsername()}`,
              rw,
            );
            msg = AckType.Ack;
          } catch (error) {
            console.error("Error publishing war recognition:", error);
            msg = AckType.NackRequeue;
          }

          break;

        default:
          console.log("You really did something bad in the move handler");
          msg = AckType.NackDiscard;
          break;
      }
    } catch (error) {
      msg = AckType.NackDiscard;
    }
    process.stdout.write("> ");
    return msg;
  };
}

export function handlerWar(gs: GameState) {
  return async (rw: RecognitionOfWar): Promise<AckType> => {
    const warResult = handleWar(gs, rw);
    let msg: AckType;
    switch (warResult.result) {
      case WarOutcome.NotInvolved:
        msg = AckType.NackRequeue;
        break;

      case WarOutcome.NoUnits:
        msg = AckType.NackDiscard;
        break;

      case WarOutcome.OpponentWon:
      case WarOutcome.YouWon:
      case WarOutcome.Draw:
        msg = AckType.Ack;
        break;

      default:
        console.log("You must have really screwed up");
        msg = AckType.NackDiscard;
        break;
    }
    console.log("war hander: ", msg);
    process.stdout.write("> ");
    return msg;
  };
}
