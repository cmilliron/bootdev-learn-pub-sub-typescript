import type { ConfirmChannel, Channel } from "amqplib";
import amqp from "amqplib";
import { DeadLetterExchangeKey } from "../routing/routing.js";

export enum SimpleQueueType {
  Durable,
  Transient,
}

export async function declareAndBind(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
): Promise<[Channel, amqp.Replies.AssertQueue]> {
  const channel = await conn.createChannel();
  const queue = await channel.assertQueue(queueName, {
    durable: queueType === SimpleQueueType.Durable,
    autoDelete: queueType === SimpleQueueType.Transient,
    exclusive: queueType === SimpleQueueType.Transient,
    deadLetterExchange: DeadLetterExchangeKey,
    // What the class uses
    // arguments: {
    //   "x-dead-letter-exchange": "peril_dlx",
    // },
  });
  await channel.bindQueue(queue.queue, exchange, key);

  return [channel, queue];
}
