import type { GameState } from "../internal/gamelogic/gamestate.js";
import { type GameLog, writeLog } from "../internal/gamelogic/logs.js";
import { AckType } from "../internal/pubsub/subscribe.js";

export function handlerLog(): (gameLog: GameLog) => AckType {
  return (gameLog: GameLog) => {
    try {
      writeLog(gameLog);
    } catch (error) {
      console.error(error);
      return AckType.NackRequeue;
    } finally {
      process.stdout.write("> ");
    }

    return AckType.Ack;
  };
}
