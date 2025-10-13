import { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    logger.info("Test endpoint called", "Test");
    
    return new Response(JSON.stringify({
      status: "ok",
      timestamp: new Date().toISOString(),
      message: "API is working"
    }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
    });
  } catch (error) {
    logger.error(`Test endpoint error: ${error}`, "Test");
    return new Response(JSON.stringify({
      status: "error",
      error: String(error)
    }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}