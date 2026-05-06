import amqp from "amqplib";
import { declareAndBind, SimpleQueueType } from "./consume.js";

export enum AckType {
  Ack,
  NackRequeue,
  NackDiscard,
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  const [channel, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType,
  );
  await channel.consume(
    queue.queue,
    async (message: amqp.ConsumeMessage | null) => {
      if (!message) {
        console.log("no message");
        return;
      }
      let res: T;
      try {
        const fromBuffer = message.content.toString();
        res = JSON.parse(fromBuffer);
      } catch (error) {
        console.error("Could not unmarshal data: ", error);
        return;
      }
      const result = await handler(res);
      processResult(channel, message, result);
      // channel.ack(message);
    },
  );
}

function processResult(
  ch: amqp.Channel,
  message: amqp.ConsumeMessage,
  ack: AckType,
) {
  switch (ack) {
    case AckType.Ack:
      // console.log(`Acknowledging ${message}`);
      ch.ack(message);
      break;
    case AckType.NackRequeue:
      console.log(`Nack and Requeue ${message}`);
      ch.nack(message, false, true);
      break;
    case AckType.NackDiscard:
      // console.log(`Nack and Discard ${message}`);
      ch.nack(message, false, false);
      break;

    default:
      const unreachable: never = ack;
      console.error("Unexpected ack type:", unreachable);
      return;
  }
}
