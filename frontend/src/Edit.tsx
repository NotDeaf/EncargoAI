import React, { useEffect, useMemo, useRef, useState } from "react";

type DocumentExtraction = {
  document_fields?: Record<string, any>;
  items?: Array<any>;
};

type Document = {
  id: number;
  filename: string;
  stored_filename: string;
  storage_path: string;
  uploaded_at: string;
  pdf_size_bytes: number;
  ocr_method?: string | null;
  ocr_worked: boolean;
  extraction: DocumentExtraction;
  saved?: boolean;
};

const styles = `
  :root {
    --background: 0 0% 100%;
    --foreground: 206 30% 20%;
    --card: 0 0% 100%;
    --card-foreground: 206 30% 20%;
    --secondary: 216 33% 98%;
    --muted: 216 33% 98%;
    --muted-foreground: 206 20% 45%;
    --primary: 210 78% 15%;
    --primary-foreground: 0 0% 100%;
    --primary-light: 210 78% 22%;
    --success: 145 63% 42%;
    --warning: 27 87% 62%;
    --destructive: 0 84.2% 60.2%;
    --border: 216 20% 90%;
    --input: 216 20% 90%;
    --radius: 0.75rem;
    --shadow-soft: 0 4px 20px -4px hsl(210 78% 15% / 0.15);
    --shadow-elevated: 0 10px 40px -10px hsl(210 78% 15% / 0.25);
  }

  * { box-sizing: border-box; }

  html, body {
    margin: 0;
    font-family: Inter, system-ui, -apple-system, sans-serif;
    background: radial-gradient(circle at 10% 20%, hsl(210 78% 96%), hsl(210 78% 98%)), hsl(var(--background));
    color: hsl(var(--foreground));
    min-height: 100vh;
    overflow: auto;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  html::-webkit-scrollbar, body::-webkit-scrollbar {
    display: none;
  }

  .page {
    max-width: 1440px;
    margin: 0 auto;
    padding: 32px 20px 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  header {
    width: 80%;
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    margin-bottom: 24px;
    gap: 10px;
  }

  .brand {
    display: flex;
    flex-direction: column;
    gap: 6px;
    align-items: center;
  }


    h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin: 0;
    color: hsl(var(--foreground));
    font-style: italic;
  }

  .card {
    background: hsl(var(--card));
    color: hsl(var(--card-foreground));
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius);
    box-shadow: var(--shadow-soft);
    padding: 18px;
  }

  .stack {
    display: grid;
    gap: 16px;
    width: 95%;
  }

  .section-title {
    font-weight: 800;
    margin-bottom: 8px;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin-top: 8px;
    font-size: 13px;
    background: hsl(var(--card));
  }

  .data-table {
    table-layout: fixed;
  }

  th, td {
    border: 1px solid hsl(var(--border));
    padding: 8px 10px;
    vertical-align: top;
  }

  th {
    text-align: left;
    background: hsl(var(--secondary));
    color: hsl(var(--foreground));
    font-weight: 700;
  }

  .data-table tbody tr {
    min-height: 42px;
    cursor: pointer;
    transition: background 0.15s ease;
  }

  .data-table tbody tr:hover {
    background: hsl(var(--secondary));
  }

  .data-table tbody tr.expanded {
    height: auto;
  }

  .data-table td {
    overflow: visible;
  }

  .field-cell {
    position: relative;
  }

  .field-preview {
    display: none;
  }

  .field-cell textarea {
    width: 100%;
    height: 100%;
    display: block;
  }

  .muted {
    color: hsl(var(--muted-foreground));
    font-size: 12px;
  }

  button {
    padding: 10px 14px;
    border: none;
    border-radius: calc(var(--radius) / 1.2);
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)));
    color: hsl(var(--primary-foreground));
    font-weight: 700;
    letter-spacing: 0.01em;
    cursor: pointer;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-soft);
  }

  button:hover {
    transform: translateY(-1px);
  }

  button:disabled {
    opacity: 0.6;
    cursor: not-allowed;
    transform: none;
  }

  .ghost {
    background: hsl(var(--secondary));
    color: hsl(var(--foreground));
    border: 1px solid hsl(var(--border));
    box-shadow: none;
  }

  .primary-btn {
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)));
    color: hsl(var(--primary-foreground));
    border: none;
  }

  .primary-btn:hover {
    transform: translateY(-1px);
  }

  .toast { position: fixed; top: 110px; left: 50%; transform: translate(-50%, -6px); min-width: 220px; max-width: 600px; padding: 12px 14px; border-radius: calc(var(--radius) / 1.2); border: 1px solid hsl(var(--border)); box-shadow: 0 10px 30px -12px rgba(0,0,0,0.25); font-weight: 700; color: hsl(var(--muted-foreground)); background: hsl(var(--card)); opacity: 0; pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease; z-index: 200; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
  .toast.neutral { background: hsl(var(--card)); color: hsl(var(--muted-foreground)); border-color: hsl(var(--border)); }
  .toast.success { background: hsl(var(--success) / 0.3); color: hsl(var(--primary-foreground)); border-color: hsl(var(--success) / 0.5); }
  .toast.danger { background: hsl(var(--destructive) / 0.28); color: hsl(var(--primary-foreground)); border-color: hsl(var(--destructive) / 0.5); }

  .status {
    padding: 8px 12px;
    border-radius: var(--radius);
    background: hsl(var(--secondary));
    border: 1px solid hsl(var(--border));
    font-weight: 600;
    font-size: 12px;
    color: hsl(var(--muted-foreground));
  }

  .item-card {
    margin-top: 20px;
    border: 1px solid hsl(var(--border));
    border-radius: calc(var(--radius) / 1.5);
    padding: 12px;
    background: hsl(var(--card));
    box-shadow: var(--shadow-soft);
  }

  .item-name-input {
    font-size: 16px;
    font-weight: 700;
    line-height: 1.4;
    color: hsl(var(--foreground));
    width: 100%;
    margin-top: 0;
    margin-bottom: 6px;
    padding: 0;
    border: none;
    background: transparent;
    resize: none;
    overflow: hidden;
    font-family: inherit;
    appearance: none;
    outline: none;
    box-shadow: none;
    display: block;
    text-align: center;
  }

  .floating-save {
    position: fixed;
    right: 20px;
    bottom: 20px;
    z-index: 10;
    padding: 12px 16px;
    border: none;
    border-radius: 999px;
    background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light)));
    color: hsl(var(--primary-foreground));
    font-weight: 800;
    letter-spacing: 0.01em;
    box-shadow: var(--shadow-elevated);
    cursor: pointer;
  }

  .floating-save.danger {
    background: linear-gradient(135deg, hsl(var(--destructive)), hsl(var(--warning)));
  }

    
  .field-input {
    width: 100%;
    border: none;
    background: transparent;          /* no background change */
    font-family: inherit;             /* match table text */
    font-size: 13px;
    font-weight: 500;
    color: hsl(var(--foreground));
    padding: 6px 4px;
    line-height: 1.4;
    min-height: 32px;
    resize: none;
    display: block;
    white-space: normal;
    overflow: visible;
    text-overflow: unset;
    height: auto;
    appearance: none;
    outline: none;
    box-shadow: none;
  }

  /* focus state (NO background change) */
  .field-input:focus {
    outline: 2px solid hsl(var(--primary));
    border-radius: 4px;
    background: transparent;   /* explicitly prevent white flash */
  }

  /* optional: smoother feel */
  .field-input {
    transition: outline 0.15s ease, box-shadow 0.15s ease;
  }

  .data-table tr.expanded .field-input {
    display: block;
  }



  .row-normal {
    background: hsl(var(--card));
  }

  .row-review {
    background: hsl(var(--warning) / 0.15);
  }

  .row-missing {
    background: hsl(var(--destructive) / 0.12);
  }
`;

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function Edit() {
  const params = new URLSearchParams(window.location.search);
  const docIdParam = params.get("id");

  const [doc, setDoc] = useState<Document | null>(null);
  const [extraction, setExtraction] = useState<DocumentExtraction>({});
  const [status, setStatus] = useState("Loading...");
  const [statusVisible, setStatusVisible] = useState(false);
  const [statusVariant, setStatusVariant] = useState<"neutral" | "success" | "danger">("neutral");
  const [isSaved, setIsSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const toastTimer = useRef<number | null>(null);

  useEffect(() => {
    if (docIdParam) {
      loadById(docIdParam);
    } else {
      showStatus("No document id provided", "danger");
    }
  }, [docIdParam]);

  useEffect(() => {
    const textareas = document.querySelectorAll(".data-table textarea");
    textareas.forEach((el) => autoSize(el as HTMLTextAreaElement));
  }, [expandedRows, extraction]);

  useEffect(() => {
    if (!status) return;
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setStatusVisible(true);
    toastTimer.current = window.setTimeout(() => setStatusVisible(false), 3000);
    return () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    };
  }, [status]);

  function showStatus(text: string, variant: "neutral" | "success" | "danger" = "neutral") {
    setStatus(text);
    setStatusVariant(variant);
  }

  async function loadById(id: string) {
    showStatus(`Loading document #${id}...`, "neutral");
    try {
      const res = await fetch(`${API_BASE}/documents/${id}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDoc(data);
      setExtraction(data.extraction || {});
      setIsSaved(!!data.saved);
      showStatus(`Loaded doc #${data.id}${data.filename ? " → " + data.filename : ""}`, "success");
    } catch (err: any) {
      console.error(err);
      showStatus(err.message || `Error loading document #${id}`, "danger");
    }
  }

  function updateExtraction(path: string, value: any) {
    setExtraction((prev) => {
      const next = structuredClone(prev);
      const parts = path.split("|");
      let node: any = next;

      for (let i = 0; i < parts.length - 1; i++) {
        const key = parts[i];
        const nextKey = parts[i + 1];
        const isIndex = /^\\d+$/.test(nextKey);

        if (node[key] === undefined) {
          node[key] = isIndex ? [] : {};
        }
        node = node[key];
      }

      node[parts[parts.length - 1]] = value;
      return next;
    });
  }

  async function toggleSaved() {
    if (!doc) return;

    const next = !isSaved;
    setSaving(true);
    showStatus(next ? "Marking saved..." : "Marking unsaved...", "neutral");
    try {
      const res = await fetch(`${API_BASE}/documents/${doc.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ saved: next }),
      });
      if (!res.ok) throw new Error(await res.text());
      setIsSaved(next);
      showStatus(next ? "Saved" : "Marked unsaved", next ? "success" : "neutral");
    } catch (err: any) {
      console.error(err);
      showStatus(err.message || "Error updating saved flag", "danger");
    } finally {
      setSaving(false);
    }
  }

  const docFields = useMemo(() => extraction.document_fields || {}, [extraction]);
  const items = useMemo(
    () => (Array.isArray(extraction.items) ? extraction.items : []),
    [extraction]
  );

  function autoSize(el: HTMLTextAreaElement | null) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.max(el.scrollHeight, 32) + "px";
  }

  function toggleRow(key: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      <style>{styles}</style>
      <div className="page">
        <div className="stack">
          <div className="card">
            <div className="section-title">Document Fields</div>

              {Object.keys(docFields).length === 0 ? (
                <div className="muted">No document fields.</div>
              ) : (
                <table className="data-table">
                  <colgroup>
                    <col style={{ width: "20%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "15%" }} />
                    <col style={{ width: "50%" }} />
                  </colgroup>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Raw Value</th>
                    <th>Value</th>
                    <th>Review Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(docFields).map(([name, obj]: any) => {
                    const rowKey = `doc-${name}`;
                    let rowClass = "row-normal";

                    if (obj?.required_review === true) {
                      rowClass = "row-review";
                    } else if (!obj?.raw_value && !obj?.normalized_value && obj?.required_review === false) {
                      rowClass = "row-missing";
                    }

                    const isExpanded = expandedRows.has(rowKey);

                    return (
                      <tr
                        key={name}
                        className={`${rowClass} ${isExpanded ? "expanded" : ""}`}
                      >
                        <td>{name}</td>

                        <td
                          className="field-cell"
                          onClick={(e) => {
                            if (!isExpanded) toggleRow(rowKey);
                            const textarea = e.currentTarget.querySelector("textarea") as HTMLTextAreaElement | null;
                            if (textarea) {
                              textarea.focus();
                              const len = textarea.value.length;
                              textarea.setSelectionRange(len, len);
                            }
                          }}
                        >
                          <div className="field-preview" />
                          <textarea
                            className="field-input"
                            value={obj?.raw_value ?? ""}
                            rows={1}
                            onClick={(e) => e.stopPropagation()}
                            onInput={(e) => {
                              if (isExpanded) autoSize(e.currentTarget);
                              updateExtraction(`document_fields|${name}|raw_value`, e.currentTarget.value);
                            }}
                            onFocus={(e) => {
                              if (isExpanded) autoSize(e.currentTarget);
                            }}
                            onChange={() => {}}
                          />
                        </td>

                        <td
                          className="field-cell"
                          onClick={(e) => {
                            if (!isExpanded) toggleRow(rowKey);
                            const textarea = e.currentTarget.querySelector("textarea") as HTMLTextAreaElement | null;
                            if (textarea) {
                              textarea.focus();
                              const len = textarea.value.length;
                              textarea.setSelectionRange(len, len);
                            }
                          }}
                        >
                          <div className="field-preview" />
                          <textarea
                            className="field-input"
                            value={obj?.normalized_value ?? ""}
                            rows={1}
                            onClick={(e) => e.stopPropagation()}
                            onInput={(e) => {
                              if (isExpanded) autoSize(e.currentTarget);
                              updateExtraction(`document_fields|${name}|normalized_value`, e.currentTarget.value);
                            }}
                            onFocus={(e) => {
                              if (isExpanded) autoSize(e.currentTarget);
                            }}
                            onChange={() => {}}
                          />
                        </td>

                        <td
                          className="field-cell"
                          onClick={(e) => {
                            if (!isExpanded) toggleRow(rowKey);
                            const textarea = e.currentTarget.querySelector("textarea") as HTMLTextAreaElement | null;
                            if (textarea) {
                              textarea.focus();
                              const len = textarea.value.length;
                              textarea.setSelectionRange(len, len);
                            }
                          }}
                        >
                          <div className="field-preview" />
                          <textarea
                            className="field-input"
                            value={obj?.review_notes ?? ""}
                            rows={1}
                            onClick={(e) => e.stopPropagation()}
                            onInput={(e) => {
                              if (isExpanded) autoSize(e.currentTarget);
                              updateExtraction(`document_fields|${name}|review_notes`, e.currentTarget.value);
                            }}
                            onFocus={(e) => {
                              if (isExpanded) autoSize(e.currentTarget);
                            }}
                            onChange={() => {}}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div className="card">
            <div className="section-title">Items</div>

            {items.length === 0 ? (
              <div className="muted">No items.</div>
            ) : (
              items.map((item: any, idx: number) => {
                const fields = { ...(item.fields || {}) };

                const itemNameVal =
                  fields.item_name?.normalized_value ??
                  fields.item_name?.value ??
                  fields.item_name?.raw_value ??
                  item.item_name ??
                  `Item ${idx + 1}`;

                delete fields.item_name;

                return (
                  <div className="item-card" key={idx}>
                    <textarea
                      className="item-name-input"
                      value={itemNameVal}
                      rows={1}
                      onInput={(e) => {
                        autoSize(e.currentTarget);
                        updateExtraction(`items|${idx}|fields|item_name|value`, e.currentTarget.value);
                      }}
                      onFocus={(e) => autoSize(e.currentTarget)}
                      onChange={() => {}}
                    />

                    {Object.keys(fields).length ? (
                      <table className="data-table">
                        <colgroup>
                          <col style={{ width: "15%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "10%" }} />
                          <col style={{ width: "45%" }} />
                        </colgroup>
                        <thead>
                          <tr>
                            <th>Field</th>
                            <th>Raw Value</th>
                            <th>Value</th>
                            <th>Raw Unit</th>
                            <th>Unit</th>
                            <th>Review Notes</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(fields).map(([name, obj]: any) => {
                            const rowKey = `item-${idx}-${name}`;
                            let rowClass = "row-normal";

                            if (obj?.required_review === true) {
                              rowClass = "row-review";
                            } else if (!obj?.raw_value && !obj?.normalized_value && obj?.required_review === false) {
                              rowClass = "row-missing";
                            }

                            const isExpanded = expandedRows.has(rowKey);

                            return (
                              <tr
                                key={name}
                                className={`${rowClass} ${isExpanded ? "expanded" : ""}`}
                              >
                                <td>{name}</td>

                                <td
                                  className="field-cell"
                                  onClick={(e) => {
                                    if (!isExpanded) toggleRow(rowKey);
                                    const textarea = e.currentTarget.querySelector("textarea") as HTMLTextAreaElement | null;
                                    if (textarea) {
                                      textarea.focus();
                                      const len = textarea.value.length;
                                      textarea.setSelectionRange(len, len);
                                    }
                                  }}
                                >
                                  <div className="field-preview" />
                                  <textarea
                                    className="field-input"
                                    value={obj?.raw_value ?? ""}
                                    rows={1}
                                    onClick={(e) => e.stopPropagation()}
                                    onInput={(e) => {
                                      if (isExpanded) autoSize(e.currentTarget);
                                      updateExtraction(`items|${idx}|fields|${name}|raw_value`, e.currentTarget.value);
                                    }}
                                    onFocus={(e) => {
                                      if (isExpanded) autoSize(e.currentTarget);
                                    }}
                                    onChange={() => {}}
                                  />
                                </td>

                                <td
                                  className="field-cell"
                                  onClick={(e) => {
                                    if (!isExpanded) toggleRow(rowKey);
                                    const textarea = e.currentTarget.querySelector("textarea") as HTMLTextAreaElement | null;
                                    if (textarea) {
                                      textarea.focus();
                                      const len = textarea.value.length;
                                      textarea.setSelectionRange(len, len);
                                    }
                                  }}
                                >
                                  <div className="field-preview" />
                                  <textarea
                                    className="field-input"
                                    value={obj?.normalized_value ?? ""}
                                    rows={1}
                                    onClick={(e) => e.stopPropagation()}
                                    onInput={(e) => {
                                      if (isExpanded) autoSize(e.currentTarget);
                                      updateExtraction(`items|${idx}|fields|${name}|normalized_value`, e.currentTarget.value);
                                    }}
                                    onFocus={(e) => {
                                      if (isExpanded) autoSize(e.currentTarget);
                                    }}
                                    onChange={() => {}}
                                  />
                                </td>

                                <td
                                  className="field-cell"
                                  onClick={(e) => {
                                    if (!isExpanded) toggleRow(rowKey);
                                    const textarea = e.currentTarget.querySelector("textarea") as HTMLTextAreaElement | null;
                                    if (textarea) {
                                      textarea.focus();
                                      const len = textarea.value.length;
                                      textarea.setSelectionRange(len, len);
                                    }
                                  }}
                                >
                                  <div className="field-preview" />
                                  <textarea
                                    className="field-input"
                                    value={obj?.unit ?? ""}
                                    rows={1}
                                    onClick={(e) => e.stopPropagation()}
                                    onInput={(e) => {
                                      if (isExpanded) autoSize(e.currentTarget);
                                      updateExtraction(`items|${idx}|fields|${name}|unit`, e.currentTarget.value);
                                    }}
                                    onFocus={(e) => {
                                      if (isExpanded) autoSize(e.currentTarget);
                                    }}
                                    onChange={() => {}}
                                  />
                                </td>

                                <td
                                  className="field-cell"
                                  onClick={(e) => {
                                    if (!isExpanded) toggleRow(rowKey);
                                    const textarea = e.currentTarget.querySelector("textarea") as HTMLTextAreaElement | null;
                                    if (textarea) {
                                      textarea.focus();
                                      const len = textarea.value.length;
                                      textarea.setSelectionRange(len, len);
                                    }
                                  }}
                                >
                                  <div className="field-preview" />
                                  <textarea
                                    className="field-input"
                                    value={obj?.normalized_unit ?? ""}
                                    rows={1}
                                    onClick={(e) => e.stopPropagation()}
                                    onInput={(e) => {
                                      if (isExpanded) autoSize(e.currentTarget);
                                      updateExtraction(`items|${idx}|fields|${name}|normalized_unit`, e.currentTarget.value);
                                    }}
                                    onFocus={(e) => {
                                      if (isExpanded) autoSize(e.currentTarget);
                                    }}
                                    onChange={() => {}}
                                  />
                                </td>

                                <td
                                  className="field-cell"
                                  onClick={(e) => {
                                    if (!isExpanded) toggleRow(rowKey);
                                    const textarea = e.currentTarget.querySelector("textarea") as HTMLTextAreaElement | null;
                                    if (textarea) {
                                      textarea.focus();
                                      const len = textarea.value.length;
                                      textarea.setSelectionRange(len, len);
                                    }
                                  }}
                                >
                                  <div className="field-preview" />
                                  <textarea
                                    className="field-input"
                                    value={obj?.review_notes ?? ""}
                                    rows={1}
                                    onClick={(e) => e.stopPropagation()}
                                    onInput={(e) => {
                                      if (isExpanded) autoSize(e.currentTarget);
                                      updateExtraction(`items|${idx}|fields|${name}|review_notes`, e.currentTarget.value);
                                    }}
                                    onFocus={(e) => {
                                      if (isExpanded) autoSize(e.currentTarget);
                                    }}
                                    onChange={() => {}}
                                  />
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="muted">No fields.</div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <button
          id="saveFlagBtn"
          className={`floating-save ${isSaved ? "" : "danger"}`}
          type="button"
          disabled={saving}
          onClick={toggleSaved}
        >
          {isSaved ? "Saved" : "Mark Saved"}
        </button>
      </div>
      <div className={`toast ${statusVisible ? "show" : ""} ${statusVariant}`} role="status" aria-live="polite">
        {status}
      </div>
    </>
  );
}
