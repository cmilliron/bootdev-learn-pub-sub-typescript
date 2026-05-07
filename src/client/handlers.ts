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
import { publishJSON, publishMsgPack } from "../internal/pubsub/publish.js";
import {
  ExchangePerilTopic,
  WarRecognitionsPrefix,
} from "../internal/routing/routing.js";
import { handleWar, WarOutcome } from "../internal/gamelogic/war.js";
import { publishGameLog } from "./index.js";
import { writeLog, type GameLog } from "../internal/gamelogic/logs.js";

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

export function handlerWar(gs: GameState, confirmChannel: ConfirmChannel) {
  return async (rw: RecognitionOfWar): Promise<AckType> => {
    const warResult = handleWar(gs, rw);
    let msg: AckType;
    let msgLog: string = "";
    switch (warResult.result) {
      case WarOutcome.NotInvolved:
        msg = AckType.NackRequeue;
        break;

      case WarOutcome.NoUnits:
        msg = AckType.NackDiscard;
        break;

      case WarOutcome.OpponentWon:
        msgLog = `${warResult.winner} won a war against ${warResult.loser}`;
        msg = AckType.NackRequeue;
        break;

      case WarOutcome.YouWon:
        msgLog = `${warResult.winner} won a war against ${warResult.loser}`;
        msg = AckType.Ack;
        break;

      case WarOutcome.Draw:
        msgLog = `A war between ${warResult.attacker} and ${warResult.defender} resulted in a draw`;
        msg = AckType.Ack;
        break;

      default:
        console.log("You must have really screwed up");
        msgLog = "";
        msg = AckType.NackDiscard;
        break;
    }
    if (msgLog) {
      try {
        console.log("log: ", msgLog);
        await publishGameLog(confirmChannel, gs.getUsername(), msgLog);
        msg = AckType.Ack;
      } catch (error) {
        msg = AckType.NackRequeue;
        console.error("There was a logging error");
      }
    }
    process.stdout.write("> ");
    return msg;
  };
}
