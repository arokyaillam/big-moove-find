import protobuf from "protobufjs";
import type { FeedResponseShape } from "./types";

let root: protobuf.Root | null = null;

export async function loadProto() {
  if (root) return root;
  root = await protobuf.load("lib/feed/proto/MarketDataFeedV3.proto");
  return root;
}

export async function decodeMessageBinary(bytes: Uint8Array): Promise<FeedResponseShape> {
  const r = await loadProto();
  const FeedResponse = r.lookupType("com.upstox.marketdatafeederv3udapi.rpc.proto.FeedResponse");
  const decoded = FeedResponse.decode(bytes);
  const obj = FeedResponse.toObject(decoded, { longs: String, enums: String, bytes: String }) as any;
  return obj as FeedResponseShape;
}
