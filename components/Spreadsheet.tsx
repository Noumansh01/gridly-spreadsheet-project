"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { createFixtures } from "@/lib/fixtures";
import { address, columnLabel, parseAddress } from "@/lib/address";
import { displayValue, evaluateWorkbook } from "@/lib/formula";

import type { Workbook, SheetData, Selection, SaveStatus } from "@/lib/type";

const ROW_HEIGHT = 31;
const OVERSCAN = 8;

const DEFAULT_WIDTHS = [
  190, 170, 110, 110, 110, 130, 130, 130, 130, 120, 130, 120,
];

function getBounds(selection: Selection) {
  return {
    r1: Math.min(selection.anchorRow, selection.row),
    r2: Math.max(selection.anchorRow, selection.row),
    c1: Math.min(selection.anchorCol, selection.col),
    c2: Math.max(selection.anchorCol, selection.col),
  };
}

function isSelected(selection: Selection, row: number, col: number) {
  const bounds = getBounds(selection);

  return (
    row >= bounds.r1 && row <= bounds.r2 && col >= bounds.c1 && col <= bounds.c2
  );
}

function parseTSV(text: string): string[][] {
  return text
    .replace(/\r/g, "")
    .replace(/\n$/, "")
    .split("\n")
    .map((line) => line.split("\t").slice(0, 100));
}

function initialSelection(): Selection {
  return {
    anchorRow: 2,
    anchorCol: 2,
    row: 2,
    col: 2,
  };
}

export default function Spreadsheet() {
  const [workbook, setWorkbook] = useState<Workbook>(() => createFixtures());

  const [sheetId, setSheetId] = useState("budget");

  const [selection, setSelection] = useState<Selection>(initialSelection);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const [toast, setToast] = useState("");
  const [dark, setDark] = useState(false);

  const [columnWidths, setColumnWidths] = useState(DEFAULT_WIDTHS);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);

  const [renaming, setRenaming] = useState<string | null>(null);

  const [renameValue, setRenameValue] = useState("");
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [newSheetName, setNewSheetName] = useState("");

  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const history = useRef<{
    past: Workbook[];
    future: Workbook[];
  }>({
    past: [],
    future: [],
  });

  const pointerStart = useRef<{
    x: number;
    width: number;
  } | null>(null);

  const sheet =
    workbook.sheets.find((item) => item.id === sheetId) ?? workbook.sheets[0];

  const computed = useMemo(
    () => evaluateWorkbook(sheet.cells, sheet.rows, sheet.columns),
    [sheet.cells, sheet.rows, sheet.columns],
  );

  const activeAddress = address(selection.row, selection.col);

  const rawValue = sheet.cells[activeAddress] ?? "";

  const bounds = getBounds(selection);

  // Load browser data and system theme.
  useEffect(() => {
    const saved = localStorage.getItem("gridly-workbook");

    if (saved) {
      try {
        const parsed = JSON.parse(saved) as Workbook;

        if (parsed.sheets?.length) {
          React.startTransition(() => setWorkbook(parsed));
        }
      } catch {
        console.error("Could not restore workbook");
      }
    }

    const params = new URLSearchParams(location.search);

    const id = params.get("sheet");
    const cell = params.get("cell");

    if (id) setSheetId(id);

    if (cell) {
      const position = parseAddress(cell);

      if (position) {
        setSelection({
          anchorRow: position.row,
          anchorCol: position.col,
          row: position.row,
          col: position.col,
        });
      }
    }

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    setDark(media.matches);

    const listener = (event: MediaQueryListEvent) => {
      setDark(event.matches);
    };

    media.addEventListener("change", listener);

    return () => {
      media.removeEventListener("change", listener);
    };
  }, []);

  // Apply theme.
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);

  // Measure available grid height.
  useEffect(() => {
    const node = gridRef.current;

    if (!node) return;

    const observer = new ResizeObserver((entries) => {
      setViewportHeight(entries[0].contentRect.height);
    });

    observer.observe(node);

    return () => observer.disconnect();
  }, []);

  // Keep the URL in sync with current sheet and cell.
  useEffect(() => {
    const params = new URLSearchParams(location.search);

    params.set("sheet", sheet.id);
    params.set("cell", activeAddress);

    window.history.replaceState(
      null,
      "",
      `${location.pathname}?${params.toString()}`,
    );
  }, [sheet.id, activeAddress]);

  const notify = (message: string) => {
    setToast(message);

    window.setTimeout(() => {
      setToast("");
    }, 2600);
  };

  // Update sheet and persist locally.
  const updateWorkbook = (next: Workbook) => {
    setWorkbook(next);

    localStorage.setItem("gridly-workbook", JSON.stringify(next));
  };

  // Save one sheet to the API.
  const saveSheet = useCallback(async (target: SheetData) => {
    try {
      const response = await fetch(`/api/sheets/${target.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(target),
      });

      if (!response.ok) {
        throw new Error("Save failed");
      }

      setSaveStatus("saved");
    } catch {
      setSaveStatus("failed");
    }
  }, []);

  // Schedule debounced save.
  const scheduleSave = (target: SheetData) => {
    setSaveStatus("saving");

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      void saveSheet(target);
    }, 550);
  };

  // Commit one or multiple cells as one history step.
  const commitCells = (patch: Record<string, string>) => {
    const nextCells = { ...sheet.cells };

    Object.entries(patch).forEach(([key, value]) => {
      if (value === "") {
        delete nextCells[key];
      } else {
        nextCells[key] = value;
      }
    });

    history.current.past.push(workbook);

    if (history.current.past.length > 100) {
      history.current.past.shift();
    }

    history.current.future = [];
    setCanUndo(true);
    setCanRedo(false);

    const nextSheet = {
      ...sheet,
      cells: nextCells,
    };

    const nextWorkbook = {
      ...workbook,
      sheets: workbook.sheets.map((item) =>
        item.id === sheet.id ? nextSheet : item,
      ),
    };

    updateWorkbook(nextWorkbook);
    scheduleSave(nextSheet);
  };

  // Move active cell.
  const move = (row: number, col: number, extend = false) => {
    const nextRow = Math.max(0, Math.min(sheet.rows - 1, row));

    const nextCol = Math.max(0, Math.min(sheet.columns - 1, col));

    setSelection((old) => ({
      anchorRow: extend ? old.anchorRow : nextRow,
      anchorCol: extend ? old.anchorCol : nextCol,
      row: nextRow,
      col: nextCol,
    }));
  };

  // Start editing.
  const beginEdit = (initial?: string) => {
    setDraft(initial ?? rawValue);
    setEditing(true);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  // Finish editing.
  const finishEdit = (commit = true) => {
    if (!editing) return;

    if (commit) {
      commitCells({
        [activeAddress]: draft,
      });
    }

    setEditing(false);

    requestAnimationFrame(() => {
      gridRef.current?.focus();
    });
  };

  // Copy selected range.
  const copySelection = async () => {
    const rows: string[] = [];

    for (let row = bounds.r1; row <= bounds.r2; row++) {
      const cols: string[] = [];

      for (let col = bounds.c1; col <= bounds.c2; col++) {
        cols.push(sheet.cells[address(row, col)] ?? "");
      }

      rows.push(cols.join("\t"));
    }

    try {
      await navigator.clipboard.writeText(rows.join("\n"));

      notify("Copied selection");
    } catch {
      notify("Clipboard permission unavailable");
    }
  };

  // Paste data from clipboard.
  const pasteText = (text: string) => {
    const matrix = parseTSV(text);

    const cellCount = matrix.reduce((total, row) => total + row.length, 0);

    if (cellCount > 50000) {
      notify("Paste limited to 50,000 cells");
      return;
    }

    const patch: Record<string, string> = {};

    matrix.forEach((row, rowIndex) => {
      row.forEach((value, colIndex) => {
        const targetRow = selection.row + rowIndex;
        const targetCol = selection.col + colIndex;

        if (targetRow < sheet.rows && targetCol < sheet.columns) {
          patch[address(targetRow, targetCol)] = value.slice(0, 10000);
        }
      });
    });

    if (Object.keys(patch).length) {
      commitCells(patch);
    }

    notify(`Pasted ${Object.keys(patch).length} cells`);
  };

  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      pasteText(text);
    } catch {
      notify("Use Ctrl+V to paste");
    }
  };

  // Undo.
  const undo = () => {
    const previous = history.current.past.pop();

    if (!previous) return;

    history.current.future.push(workbook);
    setCanUndo(history.current.past.length > 0);
    setCanRedo(true);

    updateWorkbook(previous);

    const restored = previous.sheets.find((item) => item.id === sheetId);

    if (restored) {
      scheduleSave(restored);
    }
  };

  // Redo.
  const redo = () => {
    const next = history.current.future.pop();

    if (!next) return;

    history.current.past.push(workbook);
    setCanUndo(true);
    setCanRedo(history.current.future.length > 0);

    updateWorkbook(next);

    const restored = next.sheets.find((item) => item.id === sheetId);

    if (restored) {
      scheduleSave(restored);
    }
  };

  // Keyboard navigation.
  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (editing) return;

    const key = event.key.toLowerCase();

    if (key === "arrowdown") {
      event.preventDefault();
      move(selection.row + 1, selection.col, event.shiftKey);
    } else if (key === "arrowup") {
      event.preventDefault();
      move(selection.row - 1, selection.col, event.shiftKey);
    } else if (key === "arrowright") {
      event.preventDefault();
      move(selection.row, selection.col + 1, event.shiftKey);
    } else if (key === "arrowleft") {
      event.preventDefault();
      move(selection.row, selection.col - 1, event.shiftKey);
    } else if (key === "tab") {
      event.preventDefault();
      move(selection.row, selection.col + (event.shiftKey ? -1 : 1));
    } else if (key === "enter") {
      event.preventDefault();
      move(selection.row + 1, selection.col);
    } else if (key === "f2") {
      event.preventDefault();
      beginEdit();
    } else if (key === "escape") {
      setSelection(initialSelection());
    } else if (key === "delete" || key === "backspace") {
      event.preventDefault();
      commitCells({ [activeAddress]: "" });
    } else if ((event.ctrlKey || event.metaKey) && key === "z") {
      event.preventDefault();
      undo();
    } else if ((event.ctrlKey || event.metaKey) && key === "y") {
      event.preventDefault();
      redo();
    } else if ((event.ctrlKey || event.metaKey) && key === "c") {
      event.preventDefault();
      void copySelection();
    } else if ((event.ctrlKey || event.metaKey) && key === "v") {
      event.preventDefault();
      void pasteFromClipboard();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey) {
      beginEdit(event.key);
    }
  };

  // Paste events from other applications.
  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();

    const text = event.clipboardData.getData("text/plain");

    pasteText(text);
  };

  // Selected cell statistics.
  const selectedNumbers = useMemo(() => {
    const values: number[] = [];

    for (let row = bounds.r1; row <= bounds.r2; row++) {
      for (let col = bounds.c1; col <= bounds.c2; col++) {
        const value =
          computed[address(row, col)] ?? sheet.cells[address(row, col)] ?? "";

        if (
          value !== "" &&
          !value.startsWith("#") &&
          Number.isFinite(Number(value))
        ) {
          values.push(Number(value));
        }
      }
    }

    return values;
  }, [bounds.r1, bounds.r2, bounds.c1, bounds.c2, computed, sheet.cells]);

  const sum = selectedNumbers.reduce((total, value) => total + value, 0);

  const average = selectedNumbers.length ? sum / selectedNumbers.length : 0;

  // Virtualized row calculation.
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);

  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;

  const endRow = Math.min(sheet.rows, startRow + visibleCount);

  const visibleRows = Array.from(
    { length: endRow - startRow },
    (_, index) => startRow + index,
  );

  // Column resizing.
  const startResize = (event: React.MouseEvent, col: number) => {
    event.preventDefault();

    pointerStart.current = {
      x: event.clientX,
      width: columnWidths[col] ?? 120,
    };

    const onMove = (moveEvent: MouseEvent) => {
      if (!pointerStart.current) return;

      const delta = moveEvent.clientX - pointerStart.current.x;

      const width = Math.max(
        70,
        Math.min(420, pointerStart.current.width + delta),
      );

      setColumnWidths((old) =>
        old.map((value, index) => (index === col ? width : value)),
      );
    };

    const onUp = () => {
      pointerStart.current = null;

      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // Switch sheets.
  const switchSheet = (id: string) => {
    setSheetId(id);
    setSelection(initialSelection());
    setEditing(false);
  };

  // Add sheet.
  const addSheet = () => {
    const id = `sheet-${Date.now()}`;

    const newSheet: SheetData = {
      id,
      name: newSheetName.trim() || "New sheet",
      rows: 1000,
      columns: 12,
      cells: {},
    };

    const next = {
      ...workbook,
      sheets: [...workbook.sheets, newSheet],
    };

    updateWorkbook(next);

    setNewSheetName("");
    setShowNewSheet(false);
    switchSheet(id);
  };

  // Rename sheet.
  const renameSheet = (id: string) => {
    const name = renameValue.trim();

    if (!name) return;

    const next = {
      ...workbook,
      sheets: workbook.sheets.map((item) =>
        item.id === id ? { ...item, name } : item,
      ),
    };

    updateWorkbook(next);
    setRenaming(null);
  };

  // Navigate to address from name box.
  const goToAddress = () => {
    const input = document.getElementById(
      "name-box",
    ) as HTMLInputElement | null;

    if (!input) return;

    const position = parseAddress(input.value);

    if (!position) return;

    if (position.row >= sheet.rows || position.col >= sheet.columns) {
      notify("Cell is outside this sheet");
      return;
    }

    move(position.row, position.col);

    gridRef.current?.focus();
  };

  return (
    <main className="app-shell">
      {/* Top navigation */}
      <header className="topbar">
        <div style={{ display: "flex", gap: 18 }}>
          <div className="brand">
            <span className="brand-mark">▦</span>
            <span>gridly</span>
          </div>

          <button className="doc-title">Q4 Operating Budget ▾</button>
        </div>

        <div className="top-actions">
          <span className="save-state">
            <i
              className={`dot ${
                saveStatus === "saving"
                  ? "saving"
                  : saveStatus === "failed"
                    ? "failed"
                    : ""
              }`}
            />

            {saveStatus === "saved"
              ? "All changes saved"
              : saveStatus === "saving"
                ? "Saving..."
                : "Save failed"}
          </span>

          {saveStatus === "failed" && (
            <button className="btn" onClick={() => scheduleSave(sheet)}>
              Retry save
            </button>
          )}

          <button
            className="btn"
            onClick={undo}
            disabled={!canUndo}
          >
            ↶ Undo
          </button>

          <button
            className="btn"
            onClick={redo}
            disabled={!canRedo}
          >
            ↷ Redo
          </button>

          <button className="btn" onClick={() => setDark((value) => !value)}>
            {dark ? "☀ Light" : "☾ Dark"}
          </button>
        </div>
      </header>

      {/* Toolbar */}
      <nav className="toolbar">
        <span className="tool-label">File</span>
        <span className="tool-label">Edit</span>
        <span className="tool-label">View</span>

        <button className="tool-btn" onClick={undo}>
          ↶
        </button>

        <button className="tool-btn" onClick={redo}>
          ↷
        </button>

        <button className="tool-btn" onClick={() => void copySelection()}>
          Copy
        </button>

        <button className="tool-btn" onClick={() => void pasteFromClipboard()}>
          Paste
        </button>

        <button className="tool-btn" onClick={() => beginEdit()}>
          ✎ Edit cell
        </button>

        <span
          style={{
            marginLeft: "auto",
            fontSize: 11,
            color: "var(--muted)",
          }}
        >
          Keyboard-first spreadsheet
        </span>
      </nav>

      {/* Formula bar */}
      <section className="formula-wrap">
        <input
          id="name-box"
          className="name-box"
          key={activeAddress}
          defaultValue={activeAddress}
          aria-label="Cell address"
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              goToAddress();
            }
          }}
        />

        <span className="fx">fx</span>

        <input
          className="formula-input"
          value={editing ? draft : rawValue}
          onChange={(event) => {
            if (editing) {
              setDraft(event.target.value);
            }
          }}
          onFocus={() => {
            if (!editing) {
              setDraft(rawValue);
              setEditing(true);
            }
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              finishEdit(true);
            }

            if (event.key === "Escape") {
              event.preventDefault();
              finishEdit(false);
            }
          }}
          aria-label="Formula bar"
        />

        {!editing ? (
          <button className="btn" onClick={() => beginEdit(rawValue)}>
            Edit
          </button>
        ) : (
          <>
            <button className="btn" onClick={() => finishEdit(false)}>
              Cancel
            </button>

            <button className="btn primary" onClick={() => finishEdit(true)}>
              Apply
            </button>
          </>
        )}
      </section>

      {/* Spreadsheet grid */}
      <section className="grid-wrap">
        <div
          ref={gridRef}
          className="grid-scroll"
          tabIndex={0}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
          role="grid"
          aria-label="Spreadsheet grid"
          aria-rowcount={sheet.rows}
          aria-colcount={sheet.columns}
        >
          <table className="sheet-grid">
            <colgroup>
              <col style={{ width: 48 }} />

              {Array.from({ length: sheet.columns }, (_, col) => (
                <col
                  key={col}
                  style={{
                    width: columnWidths[col] ?? 120,
                  }}
                />
              ))}
            </colgroup>

            <thead>
              <tr>
                <th className="corner row-head">⌗</th>

                {Array.from({ length: sheet.columns }, (_, col) => (
                  <th key={col} className={col === 0 ? "frozen" : ""}>
                    {columnLabel(col)}

                    <span
                      className="resize-handle"
                      onMouseDown={(event) => startResize(event, col)}
                    />
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {startRow > 0 && (
                <tr>
                  <td
                    colSpan={sheet.columns + 1}
                    style={{
                      height: startRow * ROW_HEIGHT,
                      padding: 0,
                      border: 0,
                    }}
                  />
                </tr>
              )}

              {visibleRows.map((row) => (
                <tr key={row} aria-rowindex={row + 1}>
                  <th className="row-head">{row + 1}</th>

                  {Array.from({ length: sheet.columns }, (_, col) => {
                    const key = address(row, col);

                    const raw = sheet.cells[key] ?? "";

                    const value = displayValue(raw, computed[key] ?? raw);

                    const active =
                      selection.row === row && selection.col === col;

                    const selected = isSelected(selection, row, col);

                    const broken = value.startsWith("#");
                    const formula = raw.startsWith("=");

                    const subtotal = [5, 10, 14, 16, 19].includes(row);

                    const numericValue =
                      value !== "" && !Number.isNaN(Number(value));

                    const className = [
                      col === 0 ? "frozen" : "",
                      selected ? "selected" : "",
                      active ? "active" : "",
                      broken ? "broken" : "",
                      formula && !broken ? "computed" : "",
                      subtotal ? "subtotal" : "",
                      numericValue ? "number" : "",
                    ]
                      .filter(Boolean)
                      .join(" ");

                    return (
                      <td
                        key={col}
                        role="gridcell"
                        aria-selected={selected}
                        aria-label={`${key}, ${value || "empty"}`}
                        className={className}
                        onMouseDown={(event) => {
                          if (event.shiftKey) {
                            move(row, col, true);
                          } else {
                            move(row, col);
                          }

                          gridRef.current?.focus();
                        }}
                        onMouseEnter={(event) => {
                          if (event.buttons === 1) {
                            move(row, col, true);
                          }
                        }}
                        onDoubleClick={() => beginEdit(raw)}
                        title={formula ? raw : undefined}
                      >
                        {editing && active ? (
                          <input
                            ref={inputRef}
                            className="cell-editor"
                            value={draft}
                            onChange={(event) => setDraft(event.target.value)}
                            onBlur={() => finishEdit(true)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                finishEdit(true);
                                move(row + 1, col);
                              }

                              if (event.key === "Escape") {
                                event.preventDefault();
                                finishEdit(false);
                              }

                              event.stopPropagation();
                            }}
                          />
                        ) : (
                          value
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {endRow < sheet.rows && (
                <tr>
                  <td
                    colSpan={sheet.columns + 1}
                    style={{
                      height: (sheet.rows - endRow) * ROW_HEIGHT,
                      padding: 0,
                      border: 0,
                    }}
                  />
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Sheet tabs and status bar */}
        <footer className="sheet-footer">
          <div className="tabs">
            {workbook.sheets.map((item) => (
              <div
                key={item.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {renaming === item.id ? (
                  <input
                    autoFocus
                    value={renameValue}
                    onChange={(event) => setRenameValue(event.target.value)}
                    onBlur={() => renameSheet(item.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        renameSheet(item.id);
                      }

                      if (event.key === "Escape") {
                        setRenaming(null);
                      }
                    }}
                  />
                ) : (
                  <button
                    className={`tab ${item.id === sheet.id ? "active" : ""}`}
                    onClick={() => switchSheet(item.id)}
                    onDoubleClick={() => {
                      setRenaming(item.id);
                      setRenameValue(item.name);
                    }}
                  >
                    {item.name}
                  </button>
                )}
              </div>
            ))}

            {showNewSheet ? (
              <span style={{ display: "flex", gap: 4 }}>
                <input
                  autoFocus
                  value={newSheetName}
                  onChange={(event) => setNewSheetName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") addSheet();
                  }}
                  placeholder="Sheet name"
                />

                <button className="btn" onClick={addSheet}>
                  Add
                </button>
              </span>
            ) : (
              <button
                className="tab"
                onClick={() => setShowNewSheet(true)}
                aria-label="Add sheet"
              >
                ＋
              </button>
            )}
          </div>

          <div className="statusbar">
            <span>
              Sum: <strong>{sum.toLocaleString()}</strong>
            </span>

            <span>
              Average:{" "}
              <strong>
                {average.toLocaleString(undefined, {
                  maximumFractionDigits: 2,
                })}
              </strong>
            </span>

            <span>
              Count: <strong>{selectedNumbers.length}</strong>
            </span>
          </div>
        </footer>
      </section>

      <div className="hint">
        Tip: Arrow keys to move · Shift + arrows to select · Enter to move down
        · Double-click or type to edit · Ctrl/Cmd + C/V to copy and paste
      </div>

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </main>
  );
}
