export function displayValue(raw: string, computed: string): string {
  return raw.startsWith("=") ? computed : raw;
}
export function evaluateWorkbook(
  cells: CellMap,
  maxRows = 10000,
  maxCols = 26,
): Record<string, string> {
  const output: Record<string, string> = {};
  const visiting = new Set<string>();
  const cache = new Map<string, string>();

  const read = (reference: string): string => {
    const position = parseAddress(reference);

    if (!position || position.row >= maxRows || position.col >= maxCols) {
      return "#REF!";
    }

    return evaluate(reference);
  };

  const readRange = (from: string, to: string): number[] => {
    const start = parseAddress(from);
    const end = parseAddress(to);

    if (!start || !end) {
      throw new Error("#REF!");
    }

    const minRow = Math.min(start.row, end.row);
    const maxRow = Math.max(start.row, end.row);
    const minCol = Math.min(start.col, end.col);
    const maxCol = Math.max(start.col, end.col);

    const size = (maxRow - minRow + 1) * (maxCol - minCol + 1);

    if (size > 20000) {
      throw new Error("#RANGE!");
    }

    const values: number[] = [];

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        values.push(numeric(read(address(row, col))));
      }
    }

    return values;
  };

  const run = (node: Node): Value => {
    switch (node.kind) {
      case "number":
        return node.value;

      case "cell":
        return read(node.ref);

      case "range":
        return readRange(node.from, node.to);

      case "unary": {
        const value = numeric(run(node.value));

        return node.op === "-" ? -value : value;
      }

      case "binary": {
        const left = numeric(run(node.left));
        const right = numeric(run(node.right));

        switch (node.op) {
          case "+":
            return left + right;

          case "-":
            return left - right;

          case "*":
            return left * right;

          case "/":
            if (right === 0) {
              throw new Error("#DIV/0!");
            }

            return left / right;

          default:
            throw new Error("#ERROR!");
        }
      }

      case "call": {
        if (!["SUM", "AVG"].includes(node.name)) {
          throw new Error("#NAME?");
        }

        const values: number[] = [];

        for (const argument of node.args) {
          const result = run(argument);

          if (Array.isArray(result)) {
            values.push(...result);
          } else {
            values.push(numeric(result));
          }
        }

        if (node.name === "SUM") {
          return values.reduce((a, b) => a + b, 0);
        }

        return values.length
          ? values.reduce((a, b) => a + b, 0) / values.length
          : 0;
      }
    }
  };

  const evaluate = (reference: string): string => {
    if (cache.has(reference)) {
      return cache.get(reference)!;
    }

    if (visiting.has(reference)) {
      return "#CYCLE!";
    }

    visiting.add(reference);

    const raw = cells[reference] ?? "";
    let result = raw;

    if (raw.startsWith("=")) {
      try {
        const ast = new Parser(tokenize(raw)).parse();
        const value = run(ast);

        result =
          typeof value === "number"
            ? String(Number(value.toFixed(8)))
            : String(value);
      } catch (error) {
        const message = error instanceof Error ? error.message : "#ERROR!";

        result = message.startsWith("#") ? message : "#ERROR!";
      }
    }

    visiting.delete(reference);
    cache.set(reference, result);

    return result;
  };

  Object.keys(cells).forEach((key) => {
    output[key] = evaluate(key);
  });

  return output;
}
