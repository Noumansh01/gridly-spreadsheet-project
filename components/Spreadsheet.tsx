"use client";

import { address } from "@/lib/address";
import { createFixtures } from "@/lib/fixtures";
import { displayValue, evaluateWorkbook } from "@/lib/formula";
import { SaveStatus, Selection, SheetData, Workbook } from "@/lib/type";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

function initialSelection(): Selection {
  return {
    anchorRow: 2,
    anchorCol: 2,
    row: 2,
    col: 2,
  };
}

export default function Spreadsheet() {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
  const [editing, setEditing] = useState(false);
  const [showNewSheet, setShowNewSheet] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sheetId, setSheetId] = useState("budget");
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [workbook, setWorkbook] = useState<Workbook>(() => createFixtures());
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(600);
  const sheet =
    workbook.sheets.find((item) => item.id === sheetId) ?? workbook.sheets[0];
  const activeAddress = address(selection.row, selection.col);
  const rawValue = sheet.cells[activeAddress] ?? "";
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const history = useRef<{
    past: Workbook[];
    future: Workbook[];
  }>({
    past: [],
    future: [],
  });
  const ROW_HEIGHT = 31;
  const OVERSCAN = 8;
  // Virtualized row calculation.
  const startRow = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const visibleCount = Math.ceil(viewportHeight / ROW_HEIGHT) + OVERSCAN * 2;
  const endRow = Math.min(sheet.rows, startRow + visibleCount);
  const visibleRows = Array.from(
    { length: endRow - startRow },
    (_, index) => startRow + index,
  );

  function getBounds(selection: Selection) {
    return {
      r1: Math.min(selection.anchorRow, selection.row),
      r2: Math.max(selection.anchorRow, selection.row),
      c1: Math.min(selection.anchorCol, selection.col),
      c2: Math.max(selection.anchorCol, selection.col),
    };
  }
  const computed = useMemo(
    () => evaluateWorkbook(sheet.cells, sheet.rows, sheet.columns),
    [sheet.cells, sheet.rows, sheet.columns],
  );

  // Save one sheet to the API.
  function isSelected(selection: Selection, row: number, col: number) {
    const bounds = getBounds(selection);

    return (
      row >= bounds.r1 &&
      row <= bounds.r2 &&
      col >= bounds.c1 &&
      col <= bounds.c2
    );
  }
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

  const scheduleSave = (target: SheetData) => {
    setSaveStatus("saving");

    if (saveTimer.current) {
      clearTimeout(saveTimer.current);
    }

    saveTimer.current = setTimeout(() => {
      void saveSheet(target);
    }, 550);
  };
  const updateWorkbook = (next: Workbook) => {
    setWorkbook(next);

    localStorage.setItem("gridly-workbook", JSON.stringify(next));
  };
  // Start editing.
  const beginEdit = (initial?: string) => {
    setDraft(initial ?? rawValue);
    setEditing(true);

    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };
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
            <button className="btn">Retry save</button>
          )}

          <button className="btn">↶ Undo</button>

          <button className="btn">↷ Redo</button>

          <button className="btn"></button>
        </div>
      </header>

      {/* Toolbar */}
      <nav className="toolbar">
        <span className="tool-label">File</span>
        <span className="tool-label">Edit</span>
        <span className="tool-label">View</span>

        <button className="tool-btn">↶</button>

        <button className="tool-btn">↷</button>

        <button className="tool-btn">Copy</button>

        <button className="tool-btn">Paste</button>

        <button className="tool-btn">✎ Edit cell</button>

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
        <input id="name-box" className="name-box" aria-label="Cell address" />

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
                <col key={col} />
              ))}
            </colgroup>

            <thead>
              <tr>
                <th className="corner row-head">⌗</th>

                {Array.from({ length: sheet.columns }, (_, col) => (
                  <th key={col} className={col === 0 ? "frozen" : ""}>
                    <span className="resize-handle" />
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
                  <td colSpan={sheet.columns + 1} />
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
                    // value={renameValue}
                  />
                ) : (
                  <button
                    className={`tab ${item.id === sheet.id ? "active" : ""}`}
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
                  // value={}

                  // onKeyDown={}
                  placeholder="Sheet name"
                />

                <button className="btn">Add</button>
              </span>
            ) : (
              <button className="tab" aria-label="Add sheet">
                ＋
              </button>
            )}
          </div>

          <div className="statusbar">
            <span>
              Sum: <strong>{}</strong>
            </span>

            <span>
              Average: <strong>{}</strong>
            </span>

            <span>
              Count: <strong>{}</strong>
            </span>
          </div>
        </footer>
      </section>
    </main>
  );
}
