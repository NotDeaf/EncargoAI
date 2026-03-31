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

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes < 0) return "–";
  if (bytes === 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const val = bytes / Math.pow(1024, power);
  return `${val.toFixed(val >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
};

const summarizeCoverage = (list: Document[]) => {
  const fieldCounts = list.map((d) => Object.keys(d.extraction?.document_fields || {}).length);
  const itemCounts = list.map((d) => (Array.isArray(d.extraction?.items) ? d.extraction.items.length : 0));
  const fieldTotal = fieldCounts.reduce((a, b) => a + b, 0);
  const itemTotal = itemCounts.reduce((a, b) => a + b, 0);
  return { fieldTotal, itemTotal };
};

const styles = `
  #root { width: 100%; max-width: none; margin: 0 auto; border: none; }
  :root {
    --background: 0 0% 100%;
    --foreground: 206 30% 20%;
    --card: 0 0% 100%;
    --card-foreground: 206 30% 20%;
    --secondary: 216 33% 98%;
    --muted: 216 33% 98%;
    --muted-foreground: 206 20% 45%;
    --accent: 207 68% 53%;
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
  html::-webkit-scrollbar, body::-webkit-scrollbar { display: none; }
  .page { max-width: 1320px; margin: 0 auto; padding: 28px 18px 64px; display: grid; gap: 22px; }
  header { display: grid; gap: 10px; align-items: center; }
  .eyebrow { display: inline-flex; align-items: center; gap: 8px; padding: 8px 12px; border-radius: var(--radius); background: hsl(var(--secondary)); color: hsl(var(--muted-foreground)); font-weight: 700; text-transform: uppercase; font-size: 11px; letter-spacing: 0.04em; width: fit-content; }
  h1 { margin: 0; font-size: 30px; letter-spacing: -0.02em; }
  .lede { margin: 0; color: hsl(var(--muted-foreground)); max-width: 860px; line-height: 1.5; }
  .logo { height: 80px; width: auto; filter: drop-shadow(0 6px 12px hsl(210 78% 15% / 0.12)); transition: transform 0.2s ease; }
  .logo:hover { transform: translateY(-2px); }
  button { padding: 10px 14px; border: none; border-radius: calc(var(--radius) / 1.2); background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light))); color: hsl(var(--primary-foreground)); font-weight: 700; letter-spacing: 0.01em; cursor: pointer; transition: all 0.2s ease; box-shadow: var(--shadow-soft); }
  button:hover { transform: translateY(-1px); }
  button:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
  .ghost { background: hsl(var(--secondary)); color: hsl(var(--foreground)); border: 1px solid hsl(var(--border)); box-shadow: none; }
  .card { background: hsl(var(--card)); color: hsl(var(--card-foreground)); border: 1px solid hsl(var(--border)); border-radius: var(--radius); box-shadow: var(--shadow-soft); padding: 16px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
  .stat { padding: 12px 14px; border-radius: calc(var(--radius) / 1.2); background: hsl(var(--secondary)); border: 1px solid hsl(var(--border)); display: grid; gap: 4px; }
  .stat .label { font-size: 12px; text-transform: uppercase; letter-spacing: 0.05em; color: hsl(var(--muted-foreground)); font-weight: 700; }
  .stat .value { font-size: 18px; font-weight: 800; letter-spacing: -0.01em; }
  .search { display: flex; gap: 10px; flex-wrap: wrap; }
  input[type="text"] { padding: 10px 12px; border-radius: calc(var(--radius) / 1.5); border: 1px solid hsl(var(--input)); background: hsl(var(--card)); min-width: 260px; font-size: 14px; color: hsl(var(--foreground)); box-shadow: var(--shadow-soft); }
  input[type="file"].file-input { display: none; }
  .file-name { display: inline-flex; align-items: center; min-width: 160px; padding: 10px 12px; border-radius: calc(var(--radius) / 2); border: 1px solid hsl(var(--input)); background: hsl(var(--card)); color: hsl(var(--muted-foreground)); font-size: 13px; box-shadow: var(--shadow-soft); }
  .doc-grid { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 14px; }
  .doc-card { display: grid; gap: 8px; grid-template-rows: auto auto 1fr auto; text-align: left; position: relative; }
  .doc-card.clean { padding: 0; overflow: hidden; transition: all 0.2s ease; }
  .doc-card.clean:hover { transform: translateY(-3px); box-shadow: var(--shadow-elevated); }
  .doc-head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
  .filename { font-weight: 800; letter-spacing: -0.01em; }
  .meta { color: hsl(var(--muted-foreground)); font-size: 12px; }
  .badge { display: inline-flex; align-items: center; gap: 6px; padding: 6px 10px; border-radius: 999px; font-weight: 700; font-size: 12px; background: hsl(var(--muted)); color: hsl(var(--muted-foreground)); border: 1px solid hsl(var(--border)); }
  .badge.success { background: hsl(var(--success) / 0.18); color: hsl(var(--success)); border-color: hsl(var(--success) / 0.4); }
  .badge.danger { background: hsl(var(--destructive) / 0.16); color: hsl(var(--destructive)); border-color: hsl(var(--destructive) / 0.4); }
  .pill { display: inline-flex; align-items: center; gap: 6px; padding: 8px 12px; border-radius: 999px; background: hsl(var(--secondary)); color: hsl(var(--muted-foreground)); font-weight: 700; font-size: 12px; border: 1px solid hsl(var(--border)); }
  .table-lite { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 6px; }
  .table-lite th, .table-lite td { border: 1px solid hsl(var(--border)); padding: 6px 8px; text-align: left; vertical-align: top; }
  .table-lite th { background: hsl(var(--secondary)); font-weight: 700; }
  .preview { position: relative; border: 1px solid hsl(var(--border)); border-radius: calc(var(--radius) / 1.2); overflow: hidden; background: hsl(var(--secondary)); height: 260px; display: flex; align-items: center; justify-content: center; }
  .doc-card.clean .preview { height: 180px; background: #f8f9fb; border-bottom: 1px solid hsl(var(--border)); border-radius: 0; }
  .preview img { max-height: 100%; width: auto; object-fit: contain; display: block; }
  .doc-main { padding: 12px 14px 2px; text-align: left; }
  .vendor { font-weight: 700; font-size: 14px; }
  .date { font-size: 12px; font-weight: 700; margin-top: 2px; color: hsl(var(--muted-foreground)); }
  .doc-meta { padding: 0 14px 10px; display: flex; gap: 10px; font-size: 12px; color: hsl(var(--muted-foreground)); align-items: center; text-align: left; }
  .doc-actions { display: flex; gap: 8px; padding: 10px; border-top: 1px solid hsl(var(--border)); }
  .doc-actions button { flex: 1; padding: 8px; font-size: 12px; }
  .item-toggle { cursor: pointer; font-weight: 600; color: hsl(var(--accent)); }
  .item-list { display: none; border-top: 1px solid hsl(var(--border)); padding: 10px 14px; text-align: left; }
  .item-list.show { display: block; }
  .item-row { display: flex; justify-content: flex-start; gap: 8px; font-size: 13px; padding: 4px 0; text-align: left; }
  .item-name { color: hsl(var(--foreground)); }
  .item-price { font-weight: 600; }
  .kebab { position: absolute; top: 8px; right: 8px; width: 32px; height: 32px; border-radius: 999px; border: 1px solid hsl(var(--border)); background: hsl(var(--card)); display: inline-flex; align-items: center; justify-content: center; font-weight: 800; color: hsl(var(--muted-foreground)); cursor: pointer; opacity: 0; transition: opacity 0.15s ease, transform 0.15s ease; box-shadow: var(--shadow-soft); z-index: 2; pointer-events: none; }
  .doc-card:hover .kebab { opacity: 1; pointer-events: auto; }
  .kebab:hover { transform: translateY(-1px); }
  .kebab-menu { position: absolute; top: 44px; right: 8px; min-width: 140px; background: hsl(var(--card)); border: 1px solid hsl(var(--border)); border-radius: calc(var(--radius) / 1.2); box-shadow: var(--shadow-elevated); padding: 6px; display: grid; gap: 4px; z-index: 3; }
  .kebab-menu button { width: 100%; justify-content: flex-start; padding: 8px 10px; font-size: 13px; border-radius: calc(var(--radius) / 1.5); }
  .muted { color: hsl(var(--muted-foreground)); }
  .status-text { padding: 10px 12px; border-radius: calc(var(--radius) / 1.2); background: hsl(var(--secondary)); color: hsl(var(--muted-foreground)); border: 1px solid hsl(var(--border)); font-weight: 700; display: none; }
  .status-text.show { display: block; }
  .status-text.neutral { background: hsl(var(--secondary)); color: hsl(var(--muted-foreground)); border-color: hsl(var(--border)); }
  .status-text.success { background: hsl(var(--success) / 0.12); color: hsl(var(--success)); border-color: hsl(var(--success) / 0.4); }
  .status-text.danger { background: hsl(var(--destructive) / 0.12); color: hsl(var(--destructive)); border-color: hsl(var(--destructive) / 0.4); }
  .toast { position: fixed; top: 110px; left: 50%; transform: translate(-50%, -6px); min-width: 220px; max-width: 320px; padding: 12px 14px; border-radius: calc(var(--radius) / 1.2); border: 1px solid hsl(var(--border)); box-shadow: var(--shadow-elevated); font-weight: 700; color: hsl(var(--muted-foreground)); background: hsl(var(--card)); opacity: 0; pointer-events: none; transition: opacity 0.2s ease, transform 0.2s ease; z-index: 200; }
  .toast.show { opacity: 1; transform: translate(-50%, 0); pointer-events: auto; }
  .toast.neutral { background: hsl(var(--card)); color: hsl(var(--muted-foreground)); border-color: hsl(var(--border)); }
  .toast.success { background: hsl(var(--success) / 0.3); color: hsl(var(--primary-foreground)); border-color: hsl(var(--success) / 0.5); }
  .toast.danger { background: hsl(var(--destructive) / 0.28); color: hsl(var(--primary-foreground)); border-color: hsl(var(--destructive) / 0.5); }
  .progress-shell { width: 100%; height: 10px; background: hsl(var(--secondary)); border-radius: 999px; overflow: hidden; border: 1px solid hsl(var(--border)); box-shadow: var(--shadow-soft); margin-top: 8px; }
  .progress-bar { height: 100%; width: 0%; background: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-light))); transition: width 0.3s ease; }
  .dual { display: grid; grid-template-columns: 1fr 1px 1fr; gap: 0; align-items: stretch; }
  .dual .pane { display: flex; flex-direction: column; gap: 10px; padding-right: 12px; }
  .dual .pane:last-child { padding-left: 12px; padding-right: 0; }
  .dual .divider { background: hsl(var(--border)); width: 1px; height: 100%; opacity: 0.8; }
  @media (max-width: 900px) { .dual { grid-template-columns: 1fr; gap: 12px; } .dual .divider { display: none; } .dual .pane { padding: 0; } }
  .panel-lite { margin-top: 12px; background: hsl(var(--secondary)); border-radius: var(--radius); padding: 10px 12px; border: 1px solid hsl(var(--border)); color: hsl(var(--foreground)); font-weight: 600; font-size: 13px; }
  @media (max-width: 1400px) { .doc-grid { grid-template-columns: repeat(3, minmax(0, 1fr)); } }
  @media (max-width: 1100px) { .doc-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
  @media (max-width: 720px) { h1 { font-size: 24px; } .doc-head { flex-direction: column; } .doc-grid { grid-template-columns: 1fr; } }
`;

type UploadState = {
  status: string;
  progress: number;
  inProgress: boolean;
  error: boolean;
  fileName: string;
  startedAt: number | null;
};

const defaultUploadState: UploadState = {
  status: "Idle",
  progress: 0,
  inProgress: false,
  error: false,
  fileName: "No file selected",
  startedAt: null,
};

const UPLOAD_STALE_MS = 5 * 60 * 1000;
const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000";

export default function Home() {
  const [docs, setDocs] = useState<Document[]>([]);
  const [statusText, setStatusText] = useState("Loading documents...");
  const [statusVariant, setStatusVariant] = useState<"neutral" | "success" | "danger">("neutral");
  const [statusVisible, setStatusVisible] = useState(false);
  const [search, setSearch] = useState("");
  const [uploadState, setUploadState] = useState<UploadState>(() => loadUploadState());
  const [expandedItems, setExpandedItems] = useState<Set<number>>(() => new Set());
  const [menuOpen, setMenuOpen] = useState<number | null>(null);
  const progressTimer = useRef<number | null>(null);
  const toastTimer = useRef<number | null>(null);

  const filteredDocs = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return docs;
    return docs.filter((doc) =>
      [doc.filename, doc.stored_filename, String(doc.id)].join(" ").toLowerCase().includes(q)
    );
  }, [docs, search]);

  useEffect(() => {
    loadDocs();
    restoreUploadUI();
    return () => {
      if (progressTimer.current) {
        clearInterval(progressTimer.current);
      }
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  async function loadDocs() {
    setStatus("Loading documents...", "neutral");
    try {
      const res = await fetch(`${API_BASE}/documents`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setDocs(Array.isArray(data) ? data : []);
      setStatus(`Loaded ${Array.isArray(data) ? data.length : 0} document(s).`, "neutral");
    } catch (err: any) {
      console.error(err);
      setStatus(err.message || "Unable to load documents.", "danger");
    }
  }

  function setStatus(text: string, variant: "neutral" | "success" | "danger") {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }
    setStatusText(text);
    setStatusVariant(variant);
    setStatusVisible(true);
    toastTimer.current = window.setTimeout(() => setStatusVisible(false), 3000);
  }

  function persistUploadState(next: UploadState) {
    setUploadState(next);
    try {
      localStorage.setItem("homeUploadState", JSON.stringify(next));
    } catch (e) {
      console.warn("Persist upload state failed", e);
    }
  }

  function startProgress(startAt = 0, startedAt: number | null = null) {
    if (progressTimer.current) window.clearInterval(progressTimer.current);
    const startTime = startedAt || Date.now();
    const stepMs = 300;
    const maxCrawl = 96.5;
    setUploadState((prev) => ({ ...prev, startedAt: startTime, inProgress: true, progress: startAt }));
    progressTimer.current = window.setInterval(() => {
      const elapsed = (Date.now() - startTime) / 1000;
      let pct: number;
      if (elapsed <= 60) pct = (elapsed / 60) * 70;
      else if (elapsed <= 120) pct = 70 + ((elapsed - 60) / 60) * 20;
      else pct = 90 + Math.min(maxCrawl - 90, (elapsed - 120) * 0.02);
      const width = Math.min(maxCrawl, pct);
      setUploadState((prev) => {
        const next = { ...prev, progress: width, inProgress: true };
        persistUploadState(next);
        return next;
      });
    }, stepMs);
  }

  function completeProgress() {
    if (progressTimer.current) {
      clearInterval(progressTimer.current);
      progressTimer.current = null;
    }
    const next: UploadState = { ...uploadState, progress: 100, inProgress: false, startedAt: null };
    persistUploadState(next);
    setTimeout(() => persistUploadState({ ...defaultUploadState }), 800);
  }

  function resetUploadState() {
    if (progressTimer.current) clearInterval(progressTimer.current);
    progressTimer.current = null;
    persistUploadState({ ...defaultUploadState });
  }

  function isStaleUpload(state: UploadState) {
    return state.inProgress && state.startedAt && Date.now() - state.startedAt > UPLOAD_STALE_MS;
  }

  async function handleUpload(file: File) {
    const nextState: UploadState = {
      ...uploadState,
      fileName: file.name,
      inProgress: true,
      progress: uploadState.progress || 0,
      startedAt: uploadState.startedAt || Date.now(),
      status: "Uploading...",
      error: false,
    };
    persistUploadState(nextState);
    startProgress(nextState.progress, nextState.startedAt);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${API_BASE}/upload`, { method: "POST", body: form });
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setStatus(`Uploaded doc #${data.id}`, "success");
      completeProgress();
      await loadDocs();
    } catch (err: any) {
      console.error(err);
      setStatus(err.message || "Upload failed", "danger");
      persistUploadState({ ...uploadState, inProgress: false, error: true, status: err.message || "Upload failed" });
    }
  }

  function restoreUploadUI() {
    const state = loadUploadState();
    if (isStaleUpload(state)) {
      resetUploadState();
      return;
    }
    setUploadState(state);
    if (state.inProgress && state.startedAt) {
      startProgress(state.progress || 0, state.startedAt);
    }
  }

  function toggleMenu(id: number) {
    setMenuOpen((prev) => (prev === id ? null : id));
  }

  async function handleDelete(id: number) {
    setStatus("Deleting document...", "danger");
    setMenuOpen(null);
    try {
      const res = await fetch(`${API_BASE}/documents/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error(await res.text());
      setDocs((prev) => prev.filter((d) => d.id !== id));
      setStatus(`Deleted document #${id}`, "danger");
    } catch (err: any) {
      console.error(err);
      setStatus(err.message || "Unable to delete document.", "danger");
    }
  }

  function toggleItemList(id: number) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  return (
    <>
      <style>{styles}</style>
      <div className="page">

        <div className="stats" id="statsRow">
          <div className="stat">
            <div className="label">Documents</div>
            <div className="value" id="docCount">
              {docs.length}
            </div>
            <div className="meta" id="latestMeta"></div>
          </div>
          <div className="stat">
            <div className="label">Total size</div>
            <div className="value" id="totalSize">
              {formatBytes(docs.reduce((sum, d) => sum + (d.pdf_size_bytes || 0), 0))}
            </div>
            <div className="meta muted">Includes stored PDFs</div>
          </div>
          <div className="stat">
            <div className="label">Extraction coverage</div>
            <div className="value" id="coverage">
              {(() => {
                const { fieldTotal, itemTotal } = summarizeCoverage(docs);
                return `${fieldTotal} fields / ${itemTotal} items`;
              })()}
            </div>
            <div className="meta muted">Fields + items reported</div>
          </div>
        </div>

        <div className="card dual">
      <div className="pane">
        <div className="section-title">Filter</div>
        <input
          id="searchInput"
          type="text"
          placeholder="Filter by filename, stored name, or doc ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
          <div className="divider"></div>
          <div className="pane">
            <div className="section-title">Upload a document</div>
            <div className="control-row">
              <input
                id="homeFileInput"
                className="file-input"
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    document.getElementById("homeFileName")!.textContent = file.name;
                    handleUpload(file);
                    e.target.value = "";
                  }
                }}
              />
              <button id="homeUploadBtn" type="button" onClick={() => document.getElementById("homeFileInput")?.click()}>
                Choose file & upload
              </button>
              <span id="homeFileName" className="file-name">
                {uploadState.fileName}
              </span>
            </div>
            <div
              className="status-text"
              id="homeUploadStatus"
              style={{
                background: uploadState.error ? "hsl(var(--destructive) / 0.16)" : "hsl(var(--secondary))",
                color: uploadState.error ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))",
                borderColor: uploadState.error ? "hsl(var(--destructive) / 0.4)" : "hsl(var(--border))",
              }}
            >
              {uploadState.status}
            </div>
            <div className="progress-shell">
              <div className="progress-bar" id="homeProgressBar" style={{ width: `${uploadState.progress}%` }}></div>
            </div>
            <div className="panel-lite">We store a copy of the PDF and persist the extracted JSON in the database.</div>
          </div>
        </div>

      <div className="doc-grid" id="docList">
        {filteredDocs.length === 0 ? (
          <div className="card">
            <div className="muted">No documents found.</div>
          </div>
        ) : (
            filteredDocs.map((doc) => (
              <DocCard
                key={doc.id}
                doc={doc}
                isOpen={expandedItems.has(doc.id)}
                onToggleItems={toggleItemList}
                isMenuOpen={menuOpen === doc.id}
                onToggleMenu={toggleMenu}
                onCloseMenu={() => setMenuOpen(null)}
                onDelete={handleDelete}
              />
            ))
          )}
        </div>
      </div>
      <div className={`toast ${statusVisible ? "show" : ""} ${statusVariant}`} role="status" aria-live="polite">
        {statusText}
      </div>
    </>
  );
}

function DocCard({
  doc,
  isOpen,
  onToggleItems,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu,
  onDelete,
}: {
  doc: Document;
  isOpen: boolean;
  onToggleItems: (id: number) => void;
  isMenuOpen: boolean;
  onToggleMenu: (id: number) => void;
  onCloseMenu: () => void;
  onDelete: (id: number) => void;
}) {
  const cacheKey = encodeURIComponent(doc.uploaded_at || doc.id);
  const previewUrl = `${API_BASE}/preview/${doc.id}?v=${cacheKey}`;
  const items = Array.isArray(doc.extraction?.items) ? doc.extraction.items : [];
  const fields = doc.extraction?.document_fields || {};
  const vendor = fields.vendor_name?.normalized_value || fields.vendor_name?.raw_value || "Unknown Vendor";
  const date = fields.order_date?.normalized_value || fields.quote_date?.normalized_value || "No date";
  const isSaved = doc.saved === true;
  const confidence = isSaved ? "Saved" : "Not Saved";
  const confidenceClass = isSaved ? "success" : "danger";

  const itemList = items.map((item, idx) => {
    const name =
      item.item_name ||
      item.fields?.item_name?.value ||
      item.fields?.item_name?.normalized_value ||
      item.fields?.item_name?.raw_value ||
      `Item ${idx + 1}`;
    return (
      <div className="item-row" key={idx}>
        <span className="item-name">{String(name)}</span>
      </div>
    );
  });

  return (
    <div
      className="card doc-card clean"
      data-id={doc.id}
      onMouseLeave={() => onCloseMenu()}
    >
      <button
        className="kebab"
        type="button"
        aria-label="More actions"
        onClick={(e) => {
          e.stopPropagation();
          onToggleMenu(doc.id);
        }}
      >
        ⋯
      </button>
      {isMenuOpen && (
        <div
          className="kebab-menu"
          onClick={(e) => {
            e.stopPropagation();
          }}
        >
          <button
            className="ghost"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(doc.id);
            }}
            style={{ color: "hsl(var(--destructive))", borderColor: "hsl(var(--destructive) / 0.4)" }}
          >
            Delete
          </button>
        </div>
      )}
      <div className="preview" data-preview-url={previewUrl}>
        <img src={previewUrl} alt="Preview" style={{ maxHeight: "100%", width: "auto", objectFit: "contain" }} />
      </div>
      <div className="doc-main">
        <div className="vendor">{vendor}</div>
        <div className="date">{date}</div>
      </div>
      <div className="doc-meta">
        <span className="item-toggle" onClick={() => onToggleItems(doc.id)}>
          {items.length} items
        </span>
        <span className={`badge ${confidenceClass}`}>{confidence}</span>
      </div>
      <div className={`item-list ${isOpen ? "show" : ""}`}>
        {itemList.length ? itemList : <div className="muted">No items found</div>}
      </div>
      <div className="doc-actions">
        <button className="ghost" disabled>
          Compare
        </button>
        <button className="open-doc" onClick={() => (window.location.href = `./edit.html?id=${doc.id}`)}>
          Open
        </button>
      </div>
    </div>
  );
}

function loadUploadState(): UploadState {
  try {
    const raw = localStorage.getItem("homeUploadState");
    if (!raw) return { ...defaultUploadState };
    return { ...defaultUploadState, ...JSON.parse(raw) };
  } catch {
    return { ...defaultUploadState };
  }
}
