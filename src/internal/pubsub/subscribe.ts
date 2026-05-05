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
    let res: T;
    try {
      const fromBuffer = message.content.toString();
      res = JSON.parse(fromBuffer);
    } catch (error) {
      console.error("Could not unmarshal data: ", error);
      return;
    }
    handler(res);
    channel.ack(message);
  });
}
