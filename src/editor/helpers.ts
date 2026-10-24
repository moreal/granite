export function pasteStillCurrent(
  body: string,
  from: number,
  to: number,
  url: string,
  started: number,
  revision: number,
) {
  return started === revision && body.slice(from, to) === url;
}
export function safeWebUrl(value: string): string | null {
  try {
    const u = new URL(value);
    return ["https:", "http:"].includes(u.protocol) ? u.href : null;
  } catch {
    return null;
  }
}
