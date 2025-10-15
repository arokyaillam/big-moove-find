import protobuf from "protobufjs";
import path from "path";
import type { FeedResponseShape } from "./types";
import { logger } from "@/lib/logger";

let root: protobuf.Root | null = null;
let FeedResponse: protobuf.Type | null = null;

export async function loadProto(): Promise<protobuf.Root> {
  if (root) return root;
  const protoPath = path.join(process.cwd(), "lib", "feed", "proto", "MarketDataFeedV3.proto");
  logger.system(`Loading proto: ${protoPath}`, "Decoder");
  root = await protobuf.load(protoPath).catch((e) => {
    logger.error(`Proto file missing: ${e}`, "Decoder");
    throw e;
  });
  FeedResponse = root.lookupType("com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse");
  if (!FeedResponse) throw new Error("FeedResponse type not found");
  logger.system("FeedResponse type loaded", "Decoder");
  return root;
}

export async function decodeMessageBinary(bytes: Uint8Array): Promise<FeedResponseShape> {
  if (!FeedResponse) await loadProto();
  const decoded = FeedResponse!.decode(bytes);
  const obj = FeedResponse!.toObject(decoded, { longs: String, enums: String, bytes: String }) as FeedResponseShape;
  return obj;
}