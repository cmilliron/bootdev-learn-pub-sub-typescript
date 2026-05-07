import amqp, { type ConfirmChannel } from "amqplib";
import {
  clientWelcome,
  commandStatus,
  getInput,
  printClientHelp,
  printQuit,
} from "../internal/gamelogic/gamelogic.js";
import { SimpleQueueType } from "../internal/pubsub/consume.js";
import {
  ArmyMovesPrefix,
  ExchangePerilDirect,
  ExchangePerilTopic,
  GameLogSlug,
  PauseKey,
  WarRecognitionsPrefix,
} from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";
import { subscribeJSON } from "../internal/pubsub/subscribe.js";
import { handlerMove, handlerPause, handlerWar } from "./handlers.js";
import { publishJSON, publishMsgPack } from "../internal/pubsub/publish.js";
import { compileFunction } from "vm";
import type { GameLog } from "../internal/gamelogic/logs.js";

async function main() {
  console.log("Starting Peril client...");
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);

  console.log("Peril game client connected to RabbitMQ!");

  ["SIGINT", "SIGTERM"].forEach((signal) =>
    process.on(signal, async () => {
      try {
        await conn.close();
        console.log("RabbitMQ connection closed.");
      } catch (err) {
        console.error("Error closing RabbitMQ connection:", err);
      } finally {
        process.exit(0);
      }
    }),
  );

  // declare and bind queue
  const userName = await clientWelcome();

  const gameState = new GameState(userName);
  const publishConfirmChannel = await conn.createConfirmChannel();

  await subscribeJSON(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${userName}`,
    PauseKey,
    SimpleQueueType.Transient,
    handlerPause(gameState),
  );

  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    `${ArmyMovesPrefix}.${userName}`,
    `${ArmyMovesPrefix}.*`,
    SimpleQueueType.Transient,
    handlerMove(gameState, publishConfirmChannel),
  );

  await subscribeJSON(
    conn,
    ExchangePerilTopic,
    `${WarRecognitionsPrefix}`,
    `${WarRecognitionsPrefix}.*`,
    SimpleQueueType.Durable,
    handlerWar(gameState, publishConfirmChannel),
  );

  while (true) {
    const input = await getInput("What would you like to do? ");
    if (input.length === 0) {
      continue;
    }
    const command = input[0];

    switch (command) {
      case "spawn":
        try {
          commandSpawn(gameState, input);
        } catch (err) {
          console.log((err as Error).message);
        }
        break;

      case "move":
        try {
          const move = commandMove(gameState, input);

          await publishJSON(
            publishConfirmChannel,
            ExchangePerilTopic,
            `army_moves.${userName}`,
            move,
          );
        } catch (err) {
          console.log((err as Error).message);
        }
        break;

      case "status":
        try {
          commandStatus(gameState);
        } catch (err) {
          console.log((err as Error).message);
        }
        break;

      case "help":
        printClientHelp();
        break;

      case "spam":
        console.log("Spamming not allowed yet!");
        break;

      case "quit":
        printQuit();
        conn.close();
        process.exit(0);

      default:
        console.log("Unknown command. ");
        break;
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

export function publishGameLog(
  ch: ConfirmChannel,
  username: string,
  message: string,
) {
  const gameLog: GameLog = {
    username: username,
    message: message,
    currentTime: new Date(),
  };
  console.log("publish game log: ", message);
  return publishMsgPack(
    ch,
    ExchangePerilTopic,
    `${GameLogSlug}.${username}`,
    gameLog,
  );
}
