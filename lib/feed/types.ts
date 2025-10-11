export interface LTPCBlock { ltpc?: { ltp?: number; ltt?: string | number; cp?: number } }
export interface GreeksBlock { optionGreeks?: { gamma?: number; delta?: number; iv?: number; vega?: number; theta?: number; rho?: number } }
export interface FirstLevelWithGreeksBlock { firstLevelWithGreeks?: { ltpc?: LTPCBlock["ltpc"]; optionGreeks?: GreeksBlock["optionGreeks"]; tbq?: number | string; tsq?: number | string; vtt?: number | string } }
export interface OrderBookBlock { tbq?: number | string; tsq?: number | string }
export interface OHLCBlock { marketOHLC?: { ohlc: Array<{ high: number; low: number; open?: number; close?: number; ts?: string | number }>} }
export interface FullFeedBlock { fullFeed?: { marketFF?: any; indexFF?: any } }

export interface FeedValue extends LTPCBlock, GreeksBlock, OrderBookBlock, OHLCBlock, FullFeedBlock, FirstLevelWithGreeksBlock {
  vtt?: number | string;
}
export interface FeedResponseShape { feeds?: Record<string, FeedValue>; }
