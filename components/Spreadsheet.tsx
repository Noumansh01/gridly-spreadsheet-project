"use client";

import { address } from "@/lib/address";
import { createFixtures } from "@/lib/fixtures";
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
  const [draft, setDraft] = useState("");
  const [sheetId, setSheetId] = useState("budget");
  const [selection, setSelection] = useState<Selection>(initialSelection);
  const [workbook, setWorkbook] = useState<Workbook>(() => createFixtures());
  const gridRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
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
    </main>
  );
}
