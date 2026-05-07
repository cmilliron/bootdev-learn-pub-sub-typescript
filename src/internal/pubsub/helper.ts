import { decode } from "@msgpack/msgpack";
import type { GameLog } from "../gamelogic/logs.js";

export function deserializeMsgPack(buffer: Buffer<ArrayBufferLike>) {
  //   return (buffer: Buffer<ArrayBufferLike>) => {
  const res = decode(buffer) as GameLog;
  return res;
  //   };
}
