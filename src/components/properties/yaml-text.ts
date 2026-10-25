/** Map a browser textarea edit back onto exact source, preserving untouched CRLF. */
export function textareaChange(source: string, next: string): string {
  const previous = source.replace(/\r\n/g, "\n");
  let from = 0,
    tail = 0;
  while (
    from < previous.length &&
    from < next.length &&
    previous[from] === next[from]
  )
    from++;
  while (
    tail < previous.length - from &&
    tail < next.length - from &&
    previous[previous.length - 1 - tail] === next[next.length - 1 - tail]
  )
    tail++;
  const offset = (position: number) => {
    let actual = 0,
      normalized = 0;
    while (normalized < position) {
      if (source[actual] === "\r" && source[actual + 1] === "\n") actual++;
      actual++;
      normalized++;
    }
    return actual;
  };
  const insert = next
    .slice(from, next.length - tail)
    .replace(/\n/g, source.includes("\r\n") ? "\r\n" : "\n");
  return (
    source.slice(0, offset(from)) +
    insert +
    source.slice(offset(previous.length - tail))
  );
}
