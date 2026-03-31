import React, { useEffect, useMemo, useState } from "react";

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
  }

  .view-page {
    max-width: 1320px;
    margin: 0 auto;
    padding: 18px 18px 70px;
    display: grid;
    gap: 16px;
  }

  .top-grid {
    display: grid;
    grid-template-columns: 1.6fr 1fr;
    gap: 18px;
    align-items: stretch;
  }

  @media (max-width: 980px) {
    .top-grid {
      grid-template-columns: 1fr;
    }
  }

  .card {
    background: hsl(var(--card));
    color: hsl(var(--card-foreground));
    border: 1px solid hsl(var(--border));
    border-radius: var(--radius);
    box-shadow: var(--shadow-soft);
    padding: 16px;
  }

  .preview-card {
    min-height: 320px;
    height: clamp(380px, 60vh, 820px);
    display: flex;
    align-items: center;
    justify-content: center;
    background: hsl(var(--secondary));
    border: 1px dashed hsl(var(--border));
    overflow: hidden;
    padding: 12px;
  }

  .preview-card img {
    max-height: 100%;
    max-width: 95%;
    width: auto;
    object-fit: contain;
    display: block;
    border-radius: calc(var(--radius) / 1.3);
    box-shadow: var(--shadow-soft);
  }

  .meta-card {
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .meta-title {
    font-size: 18px;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.01em;
  }

  .meta-sub {
    margin: 0;
    color: hsl(var(--muted-foreground));
    font-weight: 700;
    letter-spacing: 0.01em;
  }

  .field-stack {
    display: grid;
    gap: 8px;
  }

  .field-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    border: 1px solid hsl(var(--border));
    border-radius: 12px;
    background: hsl(var(--secondary));
  }

  .field-row .label {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: hsl(var(--muted-foreground));
    font-weight: 800;
  }

  .field-row .value {
    font-weight: 700;
    color: hsl(var(--foreground));
    text-align: right;
  }

  .section-title {
    font-weight: 800;
    margin: 0 0 8px;
    letter-spacing: -0.01em;
  }

  table {
    border-collapse: collapse;
    width: 100%;
    margin-top: 8px;
    font-size: 13px;
    background: hsl(var(--card));
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

  .muted {
    color: hsl(var(--muted-foreground));
    font-size: 13px;
  }

  .item-grid {
    display: grid;
    gap: 12px;
  }

  .item-card {
    border: 1px solid hsl(var(--border));
    border-radius: calc(var(--radius) / 1.4);
    padding: 12px;
    background: hsl(var(--secondary));
  }

  .item-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .item-title {
    font-weight: 800;
    margin: 0;
  }

  .field-list {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 8px;
  }

  .field-chip {
    border: 1px solid hsl(var(--border));
    border-radius: 10px;
    padding: 8px 10px;
    background: hsl(var(--card));
    box-shadow: inset 0 1px 0 hsl(0 0% 100% / 0.7);
  }

  .field-chip .label {
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: hsl(var(--muted-foreground));
    margin-bottom: 4px;
    display: block;
    font-weight: 800;
  }

  .field-chip .value {
    font-weight: 700;
    color: hsl(var(--foreground));
    word-break: break-word;
  }

  .status-line {
    padding: 10px 12px;
    border-radius: calc(var(--radius) / 1.2);
    border: 1px dashed hsl(var(--border));
    background: hsl(var(--secondary));
    font-weight: 700;
    color: hsl(var(--muted-foreground));
  }

  .status-line.success {
    background: hsl(var(--success) / 0.12);
    color: hsl(var(--success));
    border-color: hsl(var(--success) / 0.4);
  }

  .status-line.danger {
    background: hsl(var(--destructive) / 0.12);
    color: hsl(var(--destructive));
    border-color: hsl(var(--destructive) / 0.4);
  }

  .toast { position: fixed; top: 110px; left: 50%; transform: translate(-50%, -6px); min-width: 220px; max-width: 360px; padding: 12px 14px; border-radius: calc(var(--radius) / 1.2); border: 1px solid hsl(var(--border)); box-shadow: var(--shadow-elevated); font-weight: 700; color: hsl(var(--muted-foreground)); background: hsl(var(--card)); opacity: 0; pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease; z-index: 200; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
  .toast.neutral { background: hsl(var(--card)); color: hsl(var(--muted-foreground)); border-color: hsl(var(--border)); }
  .toast.success { background: hsl(var(--success) / 0.3); color: hsl(var(--primary-foreground)); border-color: hsl(var(--success) / 0.5); }
  .toast.danger { background: hsl(var(--destructive) / 0.28); color: hsl(var(--primary-foreground)); border-color: hsl(var(--destructive) / 0.5); }
`;

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

const formatBytes = (bytes?: number) => {
  if (!Number.isFinite(bytes) || (bytes ?? 0) < 0) return "N/A";
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, power);
  return `${val.toFixed(val >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
};

const formatDate = (value?: string) => {
  if (!value) return "N/A";
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return value;
  return dt.toLocaleString();
};

const docFieldValue = (obj: any) => {
  const val = obj?.normalized_value ?? obj?.value ?? obj?.raw_value;
  if (val === null || val === undefined || val === "") return null;
  return String(val);
};

const prettifyLabel = (name: string) => {
  if (!name) return "";
  return name
    .replace(/[_-]+/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (m) => m.toUpperCase());
};

const itemFieldValue = (obj: any) => {
  const val = obj?.normalized_value ?? obj?.value ?? obj?.raw_value;
  if (val === null || val === undefined || val === "") return null;
  const unit = obj?.normalized_unit ?? obj?.unit;
  return unit ? `${val} ${unit}` : String(val);
};

export default function View() {
  const params = new URLSearchParams(window.location.search);
  const docIdParam = params.get("id");

  const [doc, setDoc] = useState<Document | null>(null);
  const [status, setStatus] = useState("Loading document...");
  const [statusVisible, setStatusVisible] = useState(true);
  const [statusVariant, setStatusVariant] = useState<"neutral" | "success" | "danger">("neutral");

  useEffect(() => {
    if (docIdParam) {
      loadById(docIdParam);
    } else {
      showStatus("No document id provided", "danger");
    }
  }, [docIdParam]);

  useEffect(() => {
    if (!status) return;
    const t = window.setTimeout(() => setStatusVisible(false), 2800);
    setStatusVisible(true);
    return () => window.clearTimeout(t);
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
      showStatus(`Loaded doc #${data.id}`, "success");
    } catch (err: any) {
      console.error(err);
      showStatus(err?.message || `Error loading document #${id}`, "danger");
    }
  }

  const docFields = useMemo(() => doc?.extraction?.document_fields || {}, [doc]);
  const items = useMemo(() => {
    const list = doc?.extraction?.items;
    return Array.isArray(list) ? list : [];
  }, [doc]);
  const previewUrl = doc ? `${API_BASE}/preview/${doc.id}?v=${encodeURIComponent(doc.uploaded_at || String(doc.id))}` : "";

  return (
    <>
      <style>{styles}</style>
      <div className="view-page">
        <div className="top-grid">
          <div className="card preview-card">
            {doc ? (
              <img src={previewUrl} alt="Preview" />
            ) : (
              <div className="muted">Preview will appear after the document loads.</div>
            )}
          </div>
          <div className="card meta-card">
            <div className="meta-title">Document Fields</div>
            <p className="meta-sub">{doc?.filename || `Document #${doc?.id ?? "N/A"}`}</p>
            {(() => {
              const usable = Object.entries(docFields).filter(([, obj]: any) => docFieldValue(obj) !== null);
              if (!usable.length) return <div className="muted">No document fields.</div>;
              return (
                <div className="field-stack">
                  {usable.map(([name, obj]: any) => (
                    <div className="field-row" key={name}>
                      <span className="label">{prettifyLabel(name)}</span>
                      <span className="value">{docFieldValue(obj)}</span>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>

        <div className="card">
          <div className="section-title">Items</div>
          {items.length === 0 ? (
            <div className="muted">No items found.</div>
          ) : (
            <div className="item-grid">
              {items.map((item: any, idx: number) => {
                const fields = { ...(item.fields || {}) };
                const itemNameVal =
                  fields.item_name?.normalized_value ??
                  fields.item_name?.value ??
                  fields.item_name?.raw_value ??
                  item.item_name ??
                  `Item ${idx + 1}`;

                delete fields.item_name;

                const usableFields = Object.entries(fields).filter(([, obj]) => itemFieldValue(obj) !== null);

                return (
                  <div className="item-card" key={idx}>
                    <div className="item-head">
                      <p className="item-title">{itemNameVal}</p>
                      <span className="pill neutral">#{idx + 1}</span>
                    </div>

                    {usableFields.length ? (
                      <div className="field-list">
                        {usableFields.map(([name, obj]: any) => (
                          <div className="field-chip" key={name}>
                            <span className="label">{prettifyLabel(name)}</span>
                            <span className="value">{itemFieldValue(obj)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="muted">No structured fields for this item.</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <div className={`toast ${statusVisible ? "show" : ""} ${statusVariant}`} role="status" aria-live="polite">
        {status}
      </div>
    </>
  );
}
