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

export function address(row: number, col: number): string {
  return `${columnLabel(col)}${row + 1}`;
}
