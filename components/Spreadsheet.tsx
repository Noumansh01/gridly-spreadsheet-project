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

          <button className="btn" onClick={} disabled={}>
            ↶ Undo
          </button>

          <button className="btn" onClick={} disabled={}>
            ↷ Redo
          </button>

          <button className="btn" onClick={}></button>
        </div>
      </header>
    </main>
  );
}
