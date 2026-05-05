import amqp from "amqplib";
import { declareAndBind, SimpleQueueType } from "./consume.js";

export async function subscribeJSON<T>(
  conn: amqp.ChannelModel,
  exchange: string,
  queueName: string,
  key: string,
  queueType: SimpleQueueType,
  handler: (data: T) => void,
): Promise<void> {
  const [channel, queue] = await declareAndBind(
    conn,
    exchange,
    queueName,
    key,
    queueType,
  );
  await channel.consume(queue.queue, (message: amqp.ConsumeMessage | null) => {
    if (!message) {
      console.log("no message");
      return;
    }
    const fromBuffer = message.content.toString();
    // console.log(fromBuffer);
    const res = JSON.parse(fromBuffer);
    // console.log(res);
    handler(res);
    channel.ack(message);
  });
}
