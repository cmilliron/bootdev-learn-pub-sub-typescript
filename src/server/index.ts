import amqp from "amqplib";
import { publishJSON } from "../internal/pubsub/publish.js";
import {
  ExchangePerilDirect,
  ExchangePerilTopic,
  GameLogSlug,
  PauseKey,
} from "../internal/routing/routing.js";
import type { PlayingState } from "../internal/gamelogic/gamestate.js";
import { getInput, printServerHelp } from "../internal/gamelogic/gamelogic.js";
import { declareAndBind, SimpleQueueType } from "../internal/pubsub/consume.js";
import { subscribeMsgPack } from "../internal/pubsub/subscribe.js";
import { handlerLog } from "./handlers.js";

async function main() {
  console.log("Starting Peril server...");
  const rabbitConnString = "amqp://guest:guest@localhost:5672/";
  const conn = await amqp.connect(rabbitConnString);

  console.log("Started Peril server on port 5672...");
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

  await subscribeMsgPack(
    conn,
    ExchangePerilTopic,
    GameLogSlug,
    `${GameLogSlug}.*`,
    SimpleQueueType.Durable,
    handlerLog(),
  );
  const playingState: PlayingState = {
    isPaused: true,
  };

  const publishCH = await conn.createConfirmChannel();

  // Used to run the server from a non-interactive source, like the multiserver.sh file
  if (!process.stdin.isTTY) {
    console.log("Non-interactive mode: skipping command input.");
    return;
  }

  printServerHelp();

  let run = true;
  while (run) {
    const input = await getInput("What would you like to do? ");
    if (input.length === 0) {
      continue;
    }

    const command = input[0];

    switch (input[0]) {
      case "pause":
        playingState.isPaused = true;
        console.log("Publishing paused game state");
        try {
          await publishJSON(
            publishCH,
            ExchangePerilDirect,
            PauseKey,
            playingState,
          );
        } catch (error) {
          console.error(`Error publishing pause message: ${error}`);
        }
        break;
      case "resume":
        playingState.isPaused = false;
        console.log("Publishing resumed game state");
        try {
          await publishJSON(
            publishCH,
            ExchangePerilDirect,
            PauseKey,
            playingState,
          );
        } catch (error) {
          console.error(`Error publishing resume message: ${error}`);
        }
        break;
      case "quit":
        run = false;
        console.log("Goodbye!");
        await conn.close();
        process.exit(0);
      default:
        console.log("invalid input");
        printServerHelp();
        break;
    }
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});

function handleShutdown() {
  console.log("Server is shutting down");
  process.exit();
}
