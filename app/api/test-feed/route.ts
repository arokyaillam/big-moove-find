import { NextRequest } from "next/server";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  let counter = 0;
  const sendTick = () => {
    const payload = {
      symbol: "NSE_FO|61755",
      score: 35 + Math.random() * 70, // random score 35–100
      alertLevel: "WATCH",
      metrics: {
        volumeRatio: Math.random() * 10,
        obRatio: Math.random() * 5,
        priceRange: Math.random() * 3,
        ltp: 180 + Math.random() * 5,
      },
      signals: [
        { type: "INFO", title: "Simulated Feed", message: "Test tick " + counter },
      ],
      timestamp: Date.now(),
    };

    writer.write(`data: ${JSON.stringify(payload)}\n\n`);
    counter++;
  };

  // 🟢 Send a tick every 3 seconds
  const interval = setInterval(sendTick, 3000);
  sendTick();

  req.signal.addEventListener("abort", () => {
    clearInterval(interval);
    writer.close();
    console.log("[TEST-FEED] client disconnected");
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
