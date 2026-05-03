import type { ConfirmChannel } from "amqplib";

export async function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const jsonString = JSON.stringify(value);
  const serializedValue = Buffer.from(jsonString, "utf-8");
  ch.publish(exchange, routingKey, serializedValue, {
    contentType: "application/json",
  });
}
