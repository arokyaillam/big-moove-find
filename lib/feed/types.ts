// LTP and Trade data
export interface LTPData {
  ltp?: number;
  ltt?: string | number;
  ltq?: string | number;
  cp?: number;
}

// Option Greeks data
export interface OptionGreeks {
  delta?: number;
  theta?: number;
  gamma?: number;
  vega?: number;
  rho?: number;
  iv?: number;
}

// Bid/Ask Quote entry
export interface BidAskQuote {
  bidQ?: string | number;
  bidP?: number;
  askQ?: string | number;
  askP?: number;
}

// OHLC data point
export interface OHLCData {
  interval?: string;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  vol?: string | number;
  ts?: string | number;
}

// Market level data (order book)
export interface MarketLevel {
  bidAskQuote?: BidAskQuote[];
}

// Market OHLC data
export interface MarketOHLC {
  ohlc?: OHLCData[];
}

// Market full feed data
export interface MarketFF {
  ltpc?: LTPData;
  marketLevel?: MarketLevel;
  optionGreeks?: OptionGreeks;
  marketOHLC?: MarketOHLC;
  atp?: number;
  vtt?: number | string;
  oi?: number | string;
  iv?: number;
  tbq?: number | string;
  tsq?: number | string;
}

// Full feed block
export interface FullFeed {
  marketFF?: MarketFF;
  indexFF?: any;
  requestMode?: string;
}

// Feed value for each instrument
export interface FeedValue {
  fullFeed?: FullFeed;
  ltpc?: LTPData;
  firstLevelWithGreeks?: {
    ltpc?: LTPData;
    optionGreeks?: OptionGreeks;
    tbq?: number | string;
    tsq?: number | string;
    vtt?: number | string;
  };
}

// Complete feed response
export interface FeedResponseShape {
  type?: string;
  feeds?: Record<string, FeedValue>;
  currentTs?: string;
  marketInfo?: any; // Additional market info data
}
