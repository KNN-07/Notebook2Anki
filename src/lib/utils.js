// NotebookLM2Anki - Shared utility functions

const ID_MIN = 2 ** 30;
const ID_RANGE = 2 ** 30;


/** Generate a positive 31-bit ID accepted by Anki. */
export function generateId() {
  if (globalThis.crypto?.getRandomValues) {
    const value = new Uint32Array(1);
    globalThis.crypto.getRandomValues(value);
    return ID_MIN + (value[0] % ID_RANGE);
  }
  return ID_MIN + Math.floor(Math.random() * ID_RANGE);
}


/** Convert NotebookLM dollar-delimited math and inline code for Anki. */
export function cleanMath(value) {
  const text = String(value ?? "");
  return text
    .replace(/\$\$(.*?)\$\$/gs, "\\[$1\\]")
    .replace(/\$((?:[^$]|\\\$)+?)\$/g, "\\($1\\)")
    .replace(/`([^`]+)`/g, (_, code) => `<code class="latex-snippet">${escapeHtml(code)}</code>`);
}

/** Escape a value as one RFC 4180-compatible CSV cell. */
export function escapeCSV(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

/** Remove accidental Anki hierarchy markers and unsafe control characters. */
export function sanitizeDeckName(value, fallback = "Unknown Notebook") {
  const name = String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/::/g, " - ")
    .replace(/\s+/g, " ")
    .trim();
  return name || fallback;
}

/** Convert user-provided text to a safe download filename stem. */
export function sanitizeFilename(value, fallback = "notebooklm-export") {
  const filename = String(value ?? "")
    .normalize("NFKC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/[. ]+$/g, "")
    .trim();
  return filename || fallback;
}


/** Start a browser download and release its object URL after navigation begins. */
export function downloadFile(content, filename, mimeType = "text/plain") {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.hidden = true;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
