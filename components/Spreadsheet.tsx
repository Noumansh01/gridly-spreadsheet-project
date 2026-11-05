"use client";

import { SaveStatus } from "@/lib/type";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

export default function Spreadsheet() {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("saved");
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
    </main>
  );
}
