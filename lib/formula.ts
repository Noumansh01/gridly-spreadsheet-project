import { parseAddress, address } from "./address";
import type { CellMap } from "./type";

type Token = {
  type:
    | "number"
    | "cell"
    | "op"
    | "name"
    | "colon"
    | "comma"
    | "lparen"
    | "rparen";
  value: string;
};

type Value = number | string | number[];

type Node =
  | { kind: "number"; value: number }
  | { kind: "cell"; ref: string }
  | { kind: "range"; from: string; to: string }
  | { kind: "unary"; op: string; value: Node }
  | { kind: "binary"; op: string; left: Node; right: Node }
  | { kind: "call"; name: string; args: Node[] };

function tokenize(source: string): Token[] {
  const input = source.startsWith("=") ? source.slice(1) : source;

  const tokens: Token[] = [];

  const regex =
    /\s*(?:(\d+(?:\.\d+)?)|([A-Z]+[1-9]\d*)|([A-Z]+)|([+\-*/])|(:)|(,)|(\()|(\)))/iy;

  let position = 0;

  while (position < input.length) {
    regex.lastIndex = position;

    const match = regex.exec(input);

    if (!match) {
      throw new Error("#ERROR!");
    }

    position = regex.lastIndex;

    if (match[1]) {
      tokens.push({ type: "number", value: match[1] });
    } else if (match[2]) {
      tokens.push({
        type: "cell",
        value: match[2].toUpperCase(),
      });
    } else if (match[3]) {
      tokens.push({
        type: "name",
        value: match[3].toUpperCase(),
      });
    } else if (match[4]) {
      tokens.push({ type: "op", value: match[4] });
    } else if (match[5]) {
      tokens.push({ type: "colon", value: ":" });
    } else if (match[6]) {
      tokens.push({ type: "comma", value: "," });
    } else if (match[7]) {
      tokens.push({ type: "lparen", value: "(" });
    } else if (match[8]) {
      tokens.push({ type: "rparen", value: ")" });
    }
  }

  return tokens;
}

class Parser {
  private index = 0;

  constructor(private tokens: Token[]) {}

  private peek() {
    return this.tokens[this.index];
  }

  private take() {
    return this.tokens[this.index++];
  }

  parse(): Node {
    const result = this.expression();

    if (this.index !== this.tokens.length) {
      throw new Error("#ERROR!");
    }

    return result;
  }

  private expression(): Node {
    let node = this.term();

    while (
      this.peek()?.type === "op" &&
      ["+", "-"].includes(this.peek().value)
    ) {
      const operator = this.take().value;

      node = {
        kind: "binary",
        op: operator,
        left: node,
        right: this.term(),
      };
    }

    return node;
  }

  private term(): Node {
    let node = this.factor();

    while (
      this.peek()?.type === "op" &&
      ["*", "/"].includes(this.peek().value)
    ) {
      const operator = this.take().value;

      node = {
        kind: "binary",
        op: operator,
        left: node,
        right: this.factor(),
      };
    }

    return node;
  }

  private factor(): Node {
    const token = this.peek();

    if (!token) throw new Error("#ERROR!");

    if (token.type === "op" && ["+", "-"].includes(token.value)) {
      this.take();

      return {
        kind: "unary",
        op: token.value,
        value: this.factor(),
      };
    }

    if (token.type === "number") {
      this.take();

      return {
        kind: "number",
        value: Number(token.value),
      };
    }

    if (token.type === "cell") {
      this.take();

      if (this.peek()?.type === "colon") {
        this.take();

        const end = this.take();

        if (!end || end.type !== "cell") {
          throw new Error("#REF!");
        }

        return {
          kind: "range",
          from: token.value,
          to: end.value,
        };
      }

      return {
        kind: "cell",
        ref: token.value,
      };
    }

    if (token.type === "name") {
      this.take();

      if (this.take()?.type !== "lparen") {
        throw new Error("#NAME?");
      }

      const args: Node[] = [];

      if (this.peek()?.type !== "rparen") {
        args.push(this.expression());

        while (this.peek()?.type === "comma") {
          this.take();
          args.push(this.expression());
        }
      }

      if (this.take()?.type !== "rparen") {
        throw new Error("#ERROR!");
      }

      return {
        kind: "call",
        name: token.value,
        args,
      };
    }

    if (token.type === "lparen") {
      this.take();

      const node = this.expression();

      if (this.take()?.type !== "rparen") {
        throw new Error("#ERROR!");
      }

      return node;
    }

    throw new Error("#ERROR!");
  }
}

function numeric(value: Value): number {
  if (Array.isArray(value)) {
    throw new Error("#VALUE!");
  }

  if (typeof value === "string" && value.startsWith("#")) {
    throw new Error(value);
  }

  if (value === "") return 0;

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new Error("#VALUE!");
  }

  return number;
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

export function displayValue(raw: string, computed: string): string {
  return raw.startsWith("=") ? computed : raw;
}
