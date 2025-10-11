function time() { return new Date().toISOString(); }

const C = { reset: "\x1b[0m", blue: "\x1b[34m", green: "\x1b[32m", yellow: "\x1b[33m", red: "\x1b[31m", magenta: "\x1b[35m" };

export const logger = {
  system: (m: string, c?: string) => console.log(`${C.blue}[SYS]${C.reset} [${time()}] ${c ? `[${c}]` : ""} ${m}`),
  info:   (m: string, c?: string) => console.log(`${C.green}[INFO]${C.reset} [${time()}] ${c ? `[${c}]` : ""} ${m}`),
  warn:   (m: string, c?: string) => console.warn(`${C.yellow}[WARN]${C.reset} [${time()}] ${c ? `[${c}]` : ""} ${m}`),
  error:  (m: string, c?: string) => console.error(`${C.red}[ERROR]${C.reset} [${time()}] ${c ? `[${c}]` : ""} ${m}`),
  alert:  (m: string, c?: string) => console.log(`${C.magenta}[ALERT]${C.reset} [${time()}] ${c ? `[${c}]` : ""} ${m}`)
};
