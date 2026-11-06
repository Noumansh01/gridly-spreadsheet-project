import type { CellMap } from "./type";

export type HistoryEntry = {
  before: CellMap;
  after: CellMap;
};

export class HistoryManager {
  private undoStack: HistoryEntry[] = [];
  private redoStack: HistoryEntry[] = [];

  constructor(private limit = 100) {}

  push(entry: HistoryEntry) {
    this.undoStack.push(entry);

    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }

    this.redoStack = [];
  }

  undo(): CellMap | null {
    const entry = this.undoStack.pop();

    if (!entry) return null;

    this.redoStack.push(entry);
    return entry.before;
  }

  redo(): CellMap | null {
    const entry = this.redoStack.pop();

    if (!entry) return null;

    this.undoStack.push(entry);
    return entry.after;
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}
