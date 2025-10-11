"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function DashboardPage() {
  const [symbol, setSymbol] = useState("NSE_FO|42690");

  async function sendCommand(type: "sub" | "unsub") {
    const res = await fetch(`/api/command?type=${type}&symbol=${symbol}`, {
      method: "POST",
    });
    const data = await res.json();
    console.log("Command response:", data);
  }

  return (
    <main className="p-8 space-y-4">
      <h1 className="text-xl font-bold">Live Subscription Test</h1>
      <div className="flex gap-2">
        <Button onClick={() => sendCommand("sub")}>Subscribe</Button>
        <Button variant="destructive" onClick={() => sendCommand("unsub")}>
          Unsubscribe
        </Button>
      </div>
    </main>
  );
}
