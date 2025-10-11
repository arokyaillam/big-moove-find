/**
 * Centralized Logger Utility — color coded + timestamped
 */

function time() {
  return new Date().toISOString();
}

const COLORS = {
  reset: "\x1b[0m",
  blue: "\x1b[34m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  magenta: "\x1b[35m",
};

export const logger = {
  info: (msg: string, ctx?: string) =>
    console.log(`${COLORS.green}[INFO]${COLORS.reset} [${time()}] ${ctx ? `[${ctx}]` : ""} ${msg}`),

  warn: (msg: string, ctx?: string) =>
    console.warn(`${COLORS.yellow}[WARN]${COLORS.reset} [${time()}] ${ctx ? `[${ctx}]` : ""} ${msg}`),

  error: (msg: string, ctx?: string) =>
    console.error(`${COLORS.red}[ERROR]${COLORS.reset} [${time()}] ${ctx ? `[${ctx}]` : ""} ${msg}`),

  alert: (msg: string, ctx?: string) =>
    console.log(`${COLORS.magenta}[ALERT]${COLORS.reset} [${time()}] ${ctx ? `[${ctx}]` : ""} ${msg}`),

  system: (msg: string, ctx?: string) =>
    console.log(`${COLORS.blue}[SYS]${COLORS.reset} [${time()}] ${ctx ? `[${ctx}]` : ""} ${msg}`),
};
