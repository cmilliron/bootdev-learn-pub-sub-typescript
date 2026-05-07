import type { ConfirmChannel } from "amqplib";
import { encode } from "@msgpack/msgpack";

export function publishJSON<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const jsonString = JSON.stringify(value);
  return new Promise((resolve, reject) => {
    const serializedValue = Buffer.from(jsonString, "utf-8");
    ch.publish(
      exchange,
      routingKey,
      serializedValue,
      {
        contentType: "application/json",
      },
      (err) => {
        if (err !== null) {
          reject(new Error("Message was NACKed by the broker"));
        } else {
          resolve();
        }
      },
    );
  });
}

export function publishMsgPack<T>(
  ch: ConfirmChannel,
  exchange: string,
  routingKey: string,
  value: T,
): Promise<void> {
  const encoded = encode(value);
  return new Promise((resolve, reject) => {
    const buffer = Buffer.from(
      encoded.buffer,
      encoded.byteOffset,
      encoded.byteLength,
    );
    if (!ch) {
      return reject(new Error("Channel not initialized"));
    }
    const sent = ch.publish(
      exchange,
      routingKey,
      buffer,
      {
        contentType: "application/x-msgpack",
      },
      (err, ok) => {
        if (err !== null) {
          reject(new Error("Message was NACKed by the broker"));
        }
        resolve();
      },
    );
    if (!sent) {
      console.warn("Write buffer is full, waiting for drain event...");
    }
  });
}
