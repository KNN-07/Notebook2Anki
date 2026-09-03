// NotebookLM2Anki - NotebookLM bridge and injected export control

(function initializeContentScript() {
  "use strict";

  const CHANNEL = "notebooklm2anki";
  const BUTTON_ID = "notebooklm-to-anki-btn";
  const STYLE_ID = "notebooklm-to-anki-styles";
  const TOAST_ID = "notebooklm-to-anki-toast";
  const MESSAGE_TARGET = "background";
  const SEND_ACTION = "sendToAnki";
  const ANCHOR_SELECTORS = [
    'button[aria-label="Download"]',
    'button[aria-label="Copy"]',
    'button[aria-label="Good content rating"]'
  ];

  let activeMiner = null;
  let activeMinerCount = -1;
  let activeRequestId = null;
  let exportTimeout = null;
  let resetTimeout = null;
  let toastTimeout = null;
  let uiState = "preparing";
  let uiCount = 0;

  if (window === window.top) initializeUi();
  initializeMiner();

  function initializeMiner() {
    const announce = () => {
      const data = extractPageData();
      if (!data) return false;

      window.top.postMessage({
        channel: CHANNEL,
        action: "miner-ready",
        count: data.quizzes.length + data.flashcards.length
      }, "*");
      return true;
    };

    if (!announce()) {
      const observer = new MutationObserver(() => {
        if (announce()) observer.disconnect();
      });
      observer.observe(document.documentElement, { childList: true, subtree: true });
    }

    window.addEventListener("message", event => {
      if (
        event.source !== window.top ||
        event.data?.channel !== CHANNEL ||
        event.data.action !== "export-request"
      ) {
        return;
      }
      exportFromFrame(event.data);
    });
  }

  async function exportFromFrame(request) {
    const data = extractPageData();
    if (!hasContent(data)) {
      postResult("export-error", request.requestId, {
        error: "No quiz or flashcard content was found in this frame"
      });
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        target: MESSAGE_TARGET,
        action: SEND_ACTION,
        data,
        deckName: request.deckName || data.title,
        type: "all"
      });

      if (!response?.success && !response?.count) {
        throw new Error(response?.error || "Anki did not accept the export");
      }

      postResult("export-success", request.requestId, {
        count: response.count || 0,
        skipped: response.skipped || 0,
        failed: response.failed || 0,
        deckName: request.deckName || data.title
      });
    } catch (error) {
      postResult("export-error", request.requestId, {
        error: error instanceof Error ? error.message : String(error)
      });
    }
  }

  function initializeUi() {
    injectStyles();

    window.addEventListener("message", event => {
      if (event.data?.channel !== CHANNEL) return;

      if (event.data.action === "miner-ready") {
        const count = Number(event.data.count) || 0;
        if (!activeMiner || count > activeMinerCount) {
          activeMiner = event.source;
          activeMinerCount = count;
        }
        updateButton("ready");
        return;
      }

      if (event.data.requestId !== activeRequestId) return;
      if (event.data.action === "export-success") {
        finishRequest();
        const count = Number(event.data.count) || 0;
        const skipped = Number(event.data.skipped) || 0;
        const failed = Number(event.data.failed) || 0;
        updateButton(failed > 0 ? "error" : "success", count);

        let message = `${formatCount(count, "card")} sent to Anki`;
        if (skipped > 0) message += ` · ${skipped} already existed`;
        if (failed > 0) message += ` · ${failed} failed`;
        showToast(message, failed > 0 ? "error" : "success");
      } else if (event.data.action === "export-error") {
        finishRequest();
        updateButton("error");
        showToast(formatExportError(event.data.error), "error");
      }
    });

    let insertionScheduled = false;
    const scheduleInsertion = () => {
      if (insertionScheduled) return;
      insertionScheduled = true;
      requestAnimationFrame(() => {
        insertionScheduled = false;
        insertButton();
      });
    };

    scheduleInsertion();
    const observer = new MutationObserver(scheduleInsertion);
    observer.observe(document.body, { childList: true, subtree: true });
  }

  function insertButton() {
    if (document.getElementById(BUTTON_ID)) return;
    const anchor = findAnchor();
    if (!anchor?.parentElement) return;
    anchor.parentElement.insertBefore(createButton(), anchor);
    updateButton(uiState, uiCount);
  }

  function findAnchor() {
    for (const selector of ANCHOR_SELECTORS) {
      const candidates = Array.from(document.querySelectorAll(selector));
      const visible = candidates.find(candidate => candidate.getClientRects().length > 0);
      if (visible) return visible;
    }
    return null;
  }

  function createButton() {
    const button = document.createElement("button");
    button.id = BUTTON_ID;
    button.className = "n2a-export-button";
    button.type = "button";
    button.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M8 7.5h8M8 11.5h5M6.5 3.5h11a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-11a2 2 0 0 1-2-2v-13a2 2 0 0 1 2-2Z"/>
        <path d="m14.5 15 2 2 3.5-4"/>
      </svg>
      <span class="n2a-export-label">Preparing…</span>
    `;
    button.disabled = true;
    button.setAttribute("aria-label", "Preparing NotebookLM export");
    button.addEventListener("click", startExport);
    return button;
  }

  function startExport(event) {
    event.preventDefault();
    event.stopPropagation();
    if (!activeMiner || activeRequestId) return;

    const requestId = createRequestId();
    activeRequestId = requestId;
    updateButton("loading");

    const extractor = globalThis.NotebookLM2AnkiExtractor;
    const deckName = extractor?.sanitizeDeckName?.(getNotebookTitle()) || "NotebookLM Export";
    activeMiner.postMessage({
      channel: CHANNEL,
      action: "export-request",
      requestId,
      deckName
    }, "*");

    exportTimeout = setTimeout(() => {
      if (activeRequestId !== requestId) return;
      finishRequest();
      updateButton("error");
      showToast("Export timed out. Reopen the notebook and try again.", "error");
    }, 12000);
  }

  function updateButton(state, count = 0) {
    uiState = state;
    uiCount = count;
    const button = document.getElementById(BUTTON_ID);
    if (!button) return;
    const label = button.querySelector(".n2a-export-label");
    if (!label) return;

    clearTimeout(resetTimeout);
    button.dataset.state = state;
    button.disabled = state === "preparing" || state === "loading";
    button.removeAttribute("aria-busy");

    const states = {
      preparing: ["Preparing…", "Preparing NotebookLM export"],
      ready: ["Export to Anki", "Export NotebookLM cards to Anki"],
      loading: ["Exporting…", "Exporting NotebookLM cards to Anki"],
      success: [`Saved ${count}`, `${formatCount(count, "card")} sent to Anki`],
      error: ["Try again", "Export failed. Try again"]
    };
    const [text, accessibleName] = states[state] || states.preparing;
    label.textContent = text;
    button.setAttribute("aria-label", accessibleName);
    if (state === "loading") button.setAttribute("aria-busy", "true");

    if (state === "success" || state === "error") {
      resetTimeout = setTimeout(() => updateButton("ready"), 3500);
    }
  }

  function showToast(message, type) {
    let toast = document.getElementById(TOAST_ID);
    if (!toast) {
      toast = document.createElement("div");
      toast.id = TOAST_ID;
      toast.className = "n2a-export-toast";
      toast.setAttribute("role", type === "error" ? "alert" : "status");
      toast.setAttribute("aria-live", type === "error" ? "assertive" : "polite");
      document.documentElement.append(toast);
    }

    clearTimeout(toastTimeout);
    toast.className = `n2a-export-toast is-visible is-${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.textContent = message;
    toastTimeout = setTimeout(() => toast.classList.remove("is-visible"), 6000);
  }

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = `
      #${BUTTON_ID}.n2a-export-button {
        appearance: none;
        min-height: 36px;
        margin-inline-end: 8px;
        padding: 0 14px;
        border: 1px solid rgba(168, 199, 250, .42);
        border-radius: 9px;
        background: rgba(168, 199, 250, .08);
        color: #d7e6ff;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 7px;
        font: 600 13px/1 "Google Sans", "Segoe UI", sans-serif;
        letter-spacing: .01em;
        flex: 0 0 auto;
        white-space: nowrap;
        cursor: pointer;
        transition: background-color 180ms ease, border-color 180ms ease, color 180ms ease, transform 120ms ease;
      }
      #${BUTTON_ID}.n2a-export-button svg {
        width: 18px;
        height: 18px;
        fill: none;
        stroke: currentColor;
        stroke-width: 1.7;
        stroke-linecap: round;
        stroke-linejoin: round;
      }
      #${BUTTON_ID}.n2a-export-button:hover:not(:disabled) {
        background: rgba(168, 199, 250, .16);
        border-color: rgba(168, 199, 250, .68);
      }
      #${BUTTON_ID}.n2a-export-button:active:not(:disabled) { transform: translateY(1px); }
      #${BUTTON_ID}.n2a-export-button:focus-visible {
        outline: 2px solid #d7e6ff;
        outline-offset: 2px;
      }
      #${BUTTON_ID}.n2a-export-button:disabled { cursor: wait; opacity: .62; }
      #${BUTTON_ID}[data-state="loading"] svg { animation: n2a-pulse 900ms ease-in-out infinite; }
      #${BUTTON_ID}[data-state="success"] {
        border-color: rgba(129, 201, 149, .62);
        background: rgba(129, 201, 149, .12);
        color: #b7e4c2;
      }
      #${BUTTON_ID}[data-state="error"] {
        border-color: rgba(242, 139, 130, .66);
        background: rgba(242, 139, 130, .12);
        color: #ffc3bd;
      }
      .n2a-export-toast {
        position: fixed;
        right: 24px;
        bottom: 24px;
        z-index: 1200;
        max-width: min(360px, calc(100vw - 32px));
        padding: 12px 14px;
        border: 1px solid #4b4f52;
        border-radius: 10px;
        background: #222426;
        color: #f0f1f2;
        box-shadow: 0 10px 30px rgba(10, 12, 14, .32);
        font: 500 13px/1.45 "Google Sans", "Segoe UI", sans-serif;
        opacity: 0;
        transform: translateY(8px);
        pointer-events: none;
        transition: opacity 180ms ease, transform 180ms ease;
      }
      .n2a-export-toast.is-visible { opacity: 1; transform: translateY(0); }
      .n2a-export-toast.is-success { border-color: rgba(129, 201, 149, .45); }
      .n2a-export-toast.is-error { border-color: rgba(242, 139, 130, .5); }
      @keyframes n2a-pulse { 50% { opacity: .45; } }
      @media (prefers-reduced-motion: reduce) {
        #${BUTTON_ID}.n2a-export-button,
        .n2a-export-toast { transition: none; }
        #${BUTTON_ID}[data-state="loading"] svg { animation: none; }
      }
    `;
    document.head.append(style);
  }

  function extractPageData() {
    return globalThis.NotebookLM2AnkiExtractor?.extractFromPage?.() || null;
  }

  function getNotebookTitle() {
    const data = extractPageData();
    if (data?.title && data.title !== "Unknown Notebook") return data.title;
    return document.title.replace(/\s*(?:-|–|\|)\s*NotebookLM\s*$/i, "").trim();
  }

  function hasContent(data) {
    return Boolean(data && (data.quizzes?.length || data.flashcards?.length));
  }

  function finishRequest() {
    activeRequestId = null;
    clearTimeout(exportTimeout);
    exportTimeout = null;
  }

  function postResult(action, requestId, detail) {
    window.top.postMessage({ channel: CHANNEL, action, requestId, ...detail }, "*");
  }

  function createRequestId() {
    return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random()}`;
  }

  function formatCount(count, noun) {
    return `${count} ${noun}${count === 1 ? "" : "s"}`;
  }

  function formatExportError(error) {
    const message = String(error || "Export failed");
    if (/fetch|network|connect|anki/i.test(message)) {
      return "Anki is unavailable. Open Anki with AnkiConnect, then try again.";
    }
    return `${message.replace(/[.!]+$/, "")}. Try again.`;
  }
})();
