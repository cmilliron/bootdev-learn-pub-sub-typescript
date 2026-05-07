import amqp from "amqplib";
import { declareAndBind, SimpleQueueType } from "./consume.js";
import { decode } from "@msgpack/msgpack";
import type { ConsumeMessage } from "amqplib";
import type { GameLog } from "../gamelogic/logs.js";

export enum AckType {
  Ack,
  NackRequeue,
  NackDiscard,
}

export async function subscribe<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
  unmarshaller: (data: Buffer) => T,
): Promise<void> {
  const [channel, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    routingKey,
    queueType,
  );

  await channel.prefetch(1);
  await channel.consume(
    queue.queue,
    async (message: amqp.ConsumeMessage | null) => {
      if (!message) {
        console.log("no message");
        return;
      }
      let data: T;
      try {
        data = unmarshaller(message.content);
      } catch (error) {
        console.error("Could not unmarshal data: ", error);
        return;
      }
      try {
        const result = await handler(data);
        processResultAndAck(channel, message, result);
      } catch (error) {
        console.error("Error in handler:", error);
        channel.nack(message, false, false);
      }
    },
    { noAck: false },
  );
}

function processResultAndAck(
  ch: amqp.Channel,
  message: amqp.ConsumeMessage,
  ack: AckType,
) {
  switch (ack) {
    case AckType.Ack:
      ch.ack(message);
      break;
    case AckType.NackRequeue:
      ch.nack(message, false, true);
      break;
    case AckType.NackDiscard:
      ch.nack(message, false, false);
      break;

    default:
      const unreachable: never = ack;
      console.error("Unexpected ack type:", unreachable);
  }
}

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  return subscribe(
    conn,
    exchange,
    queueName,
    routingKey,
    queueType,
    handler,
    (data) => JSON.parse(data.toString()),
  );
}

export async function subscribeMsgPack<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  routingKey: string,
  queueType: SimpleQueueType,
  handler: (data: T) => Promise<AckType> | AckType,
): Promise<void> {
  return subscribe(
    conn,
    exchange,
    queueName,
    routingKey,
    queueType,
    handler,
    (data) => decode(data) as T,
  );
}
