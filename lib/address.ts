export function columnLabel(index: number): string {
  let n = index + 1;
  let label = "";

  while (n > 0) {
    const remainder = (n - 1) % 26;

    label = String.fromCharCode(65 + remainder) + label;

    n = Math.floor((n - 1) / 26);
  }

  return label;
}

export function columnIndex(label: string): number {
  let n = 0;

  for (const char of label.toUpperCase()) {
    n = n * 26 + char.charCodeAt(0) - 64;
  }

  return n - 1;
}

export function address(row: number, col: number): string {
  return `${columnLabel(col)}${row + 1}`;
}

export function parseAddress(
  value: string,
): { row: number; col: number } | null {
  const match = /^([A-Z]+)([1-9]\d*)$/i.exec(value.trim());

  if (!match) return null;

  return {
    row: Number(match[2]) - 1,
    col: columnIndex(match[1]),
  };
}
