import amqp from "amqplib";
import {
  clientWelcome,
  commandStatus,
  getInput,
  printClientHelp,
  printQuit,
} from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/consume.js";
import { ExchangePerilDirect, PauseKey } from "../internal/routing/routing.js";
import { GameState } from "../internal/gamelogic/gamestate.js";
import { commandSpawn } from "../internal/gamelogic/spawn.js";
import { commandMove } from "../internal/gamelogic/move.js";

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
  const [channel, queue] = await declareAndBind(
    conn,
    ExchangePerilDirect,
    `${PauseKey}.${userName}`,
    PauseKey,
    SimpleQueueType.Transient,
  );
  // printClientHelp();

  const gameState = new GameState(userName);

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
          commandMove(gameState, input);
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
