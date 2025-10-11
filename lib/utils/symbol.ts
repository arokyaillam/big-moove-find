export function normalizeSymbol(sym: string) {
  const [ex, key] = sym.split("|");
  if (!key) return sym;
  const norm = key.trim().replace(/\s+/g, "_").toUpperCase();
  return `${ex}|${norm}`;
}
