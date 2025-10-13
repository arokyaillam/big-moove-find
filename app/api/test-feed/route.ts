import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  logger.system("Starting comprehensive test feed with complete market data", "TestFeed");

  // Send initial connection message
  writer.write(`data: ${JSON.stringify({
    type: "connected",
    message: "Test feed connected - streaming complete market data structure",
    timestamp: new Date().toISOString()
  })}\n\n`);

  // Send comprehensive market data every 3 seconds
  const interval = setInterval(() => {
    const baseLtp1 = 181.95;
    const baseLtp2 = 245.75;
    const variation1 = (Math.random() - 0.5) * 15;
    const variation2 = (Math.random() - 0.5) * 20;

    const currentLtp1 = Math.max(150, baseLtp1 + variation1);
    const currentLtp2 = Math.max(200, baseLtp2 + variation2);

    const completeMarketData = {
      type: "live_feed",
      feeds: {
        "NSE_FO|42691": {
          fullFeed: {
            marketFF: {
              ltpc: {
                ltp: currentLtp1,
                ltt: Date.now().toString(),
                ltq: Math.floor(50 + Math.random() * 100).toString(),
                cp: currentLtp1 - (Math.random() - 0.5) * 5
              },
              marketLevel: {
                bidAskQuote: [
                  {
                    bidQ: Math.floor(500 + Math.random() * 300).toString(),
                    bidP: currentLtp1 - 0.05 - Math.random() * 0.1,
                    askQ: Math.floor(600 + Math.random() * 400).toString(),
                    askP: currentLtp1 + 0.05 + Math.random() * 0.1
                  },
                  {
                    bidQ: Math.floor(800 + Math.random() * 500).toString(),
                    bidP: currentLtp1 - 0.1 - Math.random() * 0.15,
                    askQ: Math.floor(700 + Math.random() * 300).toString(),
                    askP: currentLtp1 + 0.1 + Math.random() * 0.15
                  },
                  {
                    bidQ: Math.floor(300 + Math.random() * 200).toString(),
                    bidP: currentLtp1 - 0.15 - Math.random() * 0.2,
                    askQ: Math.floor(400 + Math.random() * 300).toString(),
                    askP: currentLtp1 + 0.15 + Math.random() * 0.2
                  }
                ]
              },
              optionGreeks: {
                delta: 0.4519 + (Math.random() - 0.5) * 0.2,
                theta: -17.6157 + (Math.random() - 0.5) * 8,
                gamma: 0.0007 + Math.random() * 0.002,
                vega: 12.7741 + (Math.random() - 0.5) * 5,
                rho: 1.8554 + (Math.random() - 0.5) * 1,
                iv: 0.1685333251953125 + (Math.random() - 0.5) * 0.08
              },
              marketOHLC: {
                ohlc: [
                  {
                    interval: "I1",
                    open: currentLtp1 - 2 + Math.random() * 4,
                    high: currentLtp1 + 1 + Math.random() * 3,
                    low: currentLtp1 - 3 - Math.random() * 2,
                    close: currentLtp1,
                    vol: Math.floor(200000 + Math.random() * 100000).toString(),
                    ts: Date.now().toString()
                  }
                ]
              },
              atp: currentLtp1 - 5 + Math.random() * 10,
              vtt: Math.floor(119687250 + Math.random() * 1000000).toString(),
              oi: Math.floor(8326800 + Math.random() * 500000).toString(),
              iv: 0.1685333251953125 + (Math.random() - 0.5) * 0.05,
              tbq: Math.floor(4185525 + Math.random() * 1000000).toString(),
              tsq: Math.floor(901350 + Math.random() * 200000).toString()
            },
            requestMode: "full_d30"
          }
        },
        "NSE_FO|42687": {
          fullFeed: {
            marketFF: {
              ltpc: {
                ltp: currentLtp2,
                ltt: Date.now().toString(),
                ltq: Math.floor(30 + Math.random() * 80).toString(),
                cp: currentLtp2 - (Math.random() - 0.5) * 8
              },
              marketLevel: {
                bidAskQuote: [
                  {
                    bidQ: Math.floor(400 + Math.random() * 200).toString(),
                    bidP: currentLtp2 - 0.1 - Math.random() * 0.2,
                    askQ: Math.floor(500 + Math.random() * 300).toString(),
                    askP: currentLtp2 + 0.1 + Math.random() * 0.2
                  },
                  {
                    bidQ: Math.floor(600 + Math.random() * 400).toString(),
                    bidP: currentLtp2 - 0.15 - Math.random() * 0.25,
                    askQ: Math.floor(450 + Math.random() * 250).toString(),
                    askP: currentLtp2 + 0.15 + Math.random() * 0.25
                  }
                ]
              },
              optionGreeks: {
                delta: 0.6234 + (Math.random() - 0.5) * 0.15,
                theta: -22.145 + (Math.random() - 0.5) * 6,
                gamma: 0.0012 + Math.random() * 0.0015,
                vega: 18.334 + (Math.random() - 0.5) * 4,
                rho: 2.145 + (Math.random() - 0.5) * 0.8,
                iv: 0.195 + (Math.random() - 0.5) * 0.04
              },
              marketOHLC: {
                ohlc: [
                  {
                    interval: "I1",
                    open: currentLtp2 - 3 + Math.random() * 6,
                    high: currentLtp2 + 2 + Math.random() * 4,
                    low: currentLtp2 - 4 - Math.random() * 3,
                    close: currentLtp2,
                    vol: Math.floor(150000 + Math.random() * 80000).toString(),
                    ts: Date.now().toString()
                  }
                ]
              },
              atp: currentLtp2 - 4 + Math.random() * 8,
              vtt: Math.floor(450000 + Math.random() * 200000).toString(),
              oi: Math.floor(2150000 + Math.random() * 300000).toString(),
              iv: 0.195 + (Math.random() - 0.5) * 0.04,
              tbq: Math.floor(1850000 + Math.random() * 400000).toString(),
              tsq: Math.floor(320000 + Math.random() * 100000).toString()
            },
            requestMode: "full_d30"
          }
        }
      },
      currentTs: new Date().toISOString()
    };

    writer.write(`data: ${JSON.stringify(completeMarketData)}\n\n`);
  }, 3000);

  // Cleanup on disconnect
  req.signal.addEventListener("abort", () => {
    logger.system("Test feed client disconnected", "TestFeed");
    clearInterval(interval);
    writer.close();
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "Connection": "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
