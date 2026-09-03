import { ACTIONS, EXPORT_TYPES, MESSAGE_TARGETS } from "../lib/constants.js";
import {
  exportAllToCSV,
  exportFlashcardsToCSV,
  exportQuizzesToCSV,
  exportQuizFlashcardsToCSV
} from "../lib/csv-exporter.js";
import { sanitizeDeckName, sanitizeFilename } from "../lib/utils.js";

const elements = {
  status: document.getElementById("status-indicator"),
  statusText: document.getElementById("status-text"),
  sourceDetail: document.getElementById("source-detail"),
  contentLoading: document.getElementById("content-loading"),
  contentInfo: document.getElementById("content-info"),
  noContent: document.getElementById("no-content"),
  quizCount: document.getElementById("quiz-count"),
  quizLabel: document.getElementById("quiz-label"),
  flashcardCount: document.getElementById("flashcard-count"),
  flashcardLabel: document.getElementById("flashcard-label"),
  deckName: document.getElementById("deck-name"),
  deckPreview: document.getElementById("deck-preview"),
  previewQuiz: document.getElementById("preview-quiz"),
  previewFlashcard: document.getElementById("preview-flashcard"),
  refresh: document.getElementById("btn-refresh"),
  anki: document.getElementById("btn-anki-connect"),
  ankiDetail: document.getElementById("anki-action-detail"),
  apkg: document.getElementById("btn-apkg"),
  csvAll: document.getElementById("btn-csv-all"),
  csvToggle: document.getElementById("btn-csv-dropdown"),
  csvMenu: document.getElementById("csv-menu"),
  csvQuizzes: document.getElementById("btn-csv-quizzes"),
  csvFlashcards: document.getElementById("btn-csv-flashcards"),
  csvHeaderless: document.getElementById("btn-csv-all-headerless"),
  csvQuizFlashcards: document.getElementById("btn-csv-quiz-as-flashcard"),
  message: document.getElementById("message"),
  version: document.getElementById("version-display")
};

let extractedData = null;
let ankiConnected = false;
let scanning = false;
let operationInProgress = false;
let checkingAnki = false;
let messageTimeout = null;

bindEvents();
initialize();

async function initialize() {
  elements.version.textContent = `v${chrome.runtime.getManifest().version}`;
  await Promise.allSettled([checkAnkiStatus(), scanActiveTab()]);
}

function bindEvents() {
  elements.status.addEventListener("click", checkAnkiStatus);
  elements.refresh.addEventListener("click", scanActiveTab);
  elements.deckName.addEventListener("input", updateDeckPreview);
  elements.deckName.addEventListener("blur", () => {
    if (elements.deckName.value.trim()) elements.deckName.value = getDeckName();
    updateDeckPreview();
  });

  elements.anki.addEventListener("click", () => runExport(elements.anki, sendToAnki));
  elements.apkg.addEventListener("click", () => runExport(elements.apkg, downloadApkg));
  elements.csvAll.addEventListener("click", () => runCsvExport(() =>
    exportAllToCSV(extractedData, { filenameBase: getFilenameBase() })
  ));
  elements.csvQuizzes.addEventListener("click", () => runCsvExport(() =>
    exportQuizzesToCSV(extractedData.quizzes, {
      filename: `${getFilenameBase()}-quizzes.csv`
    })
  ));
  elements.csvFlashcards.addEventListener("click", () => runCsvExport(() =>
    exportFlashcardsToCSV(extractedData.flashcards, {
      filename: `${getFilenameBase()}-flashcards.csv`
    })
  ));
  elements.csvHeaderless.addEventListener("click", () => runCsvExport(() =>
    exportAllToCSV(extractedData, {
      filenameBase: getFilenameBase(),
      includeHeader: false
    })
  ));
  elements.csvQuizFlashcards.addEventListener("click", () => runCsvExport(() =>
    exportQuizFlashcardsToCSV(extractedData.quizzes, {
      filename: `${getFilenameBase()}-quiz-flashcards.csv`
    })
  ));

  elements.csvToggle.addEventListener("click", event => {
    event.stopPropagation();
    toggleCsvMenu(elements.csvMenu.classList.contains("hidden"));
  });
  elements.csvToggle.addEventListener("keydown", event => {
    if (event.key !== "ArrowDown") return;
    event.preventDefault();
    toggleCsvMenu(true);
    firstEnabledMenuItem()?.focus();
  });
  elements.csvMenu.addEventListener("click", event => {
    if (event.target.closest("button")) toggleCsvMenu(false);
  });
  document.addEventListener("click", event => {
    if (!event.target.closest(".csv-action-group") && !event.target.closest("#csv-menu")) {
      toggleCsvMenu(false);
    }
  });
  document.addEventListener("keydown", event => {
    if (event.key !== "Escape" || elements.csvMenu.classList.contains("hidden")) return;
    toggleCsvMenu(false);
    elements.csvToggle.focus();
  });
}

async function checkAnkiStatus() {
  if (checkingAnki) return;
  checkingAnki = true;
  elements.status.disabled = true;
  setConnectionState("checking", "Checking Anki");

  try {
    const response = await chrome.runtime.sendMessage({
      target: MESSAGE_TARGETS.BACKGROUND,
      action: ACTIONS.CHECK_ANKI
    });
    ankiConnected = Boolean(response?.connected);
    setConnectionState(
      ankiConnected ? "connected" : "disconnected",
      ankiConnected ? "Anki ready" : "Anki offline"
    );
  } catch {
    ankiConnected = false;
    setConnectionState("disconnected", "Anki offline");
  } finally {
    checkingAnki = false;
    elements.status.disabled = false;
    updateActionStates();
  }
}

async function scanActiveTab() {
  if (scanning) return;
  scanning = true;
  extractedData = null;
  setScanningState();
  updateActionStates();

  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id || !isNotebookLMUrl(tab.url || tab.pendingUrl)) {
      showEmptyState(
        "Open NotebookLM to export",
        "Select a notebook, generate a quiz or flashcards, then scan again."
      );
      return;
    }

    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      files: ["src/lib/extractor.js"]
    });
    const frameResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => globalThis.NotebookLM2AnkiExtractor?.extractFromPage?.() || null
    });

    extractedData = mergeFrameData(frameResults.map(result => result.result).filter(Boolean));
    if (!hasContent(extractedData)) {
      extractedData = null;
      showEmptyState(
        "No study content found",
        "Generate a quiz or flashcards in this notebook, then scan again."
      );
      return;
    }

    showContentState();
  } catch (error) {
    extractedData = null;
    showEmptyState(
      "This notebook could not be read",
      "Reload NotebookLM, reopen this popup, and scan again."
    );
    showMessage(error instanceof Error ? error.message : String(error), "error");
  } finally {
    scanning = false;
    elements.refresh.classList.remove("is-loading");
    elements.refresh.removeAttribute("aria-busy");
    updateActionStates();
  }
}

function setScanningState() {
  elements.sourceDetail.textContent = "Scanning the active tab";
  elements.contentLoading.classList.remove("hidden");
  elements.contentInfo.classList.add("hidden");
  elements.noContent.classList.add("hidden");
  elements.deckPreview.classList.add("hidden");
  elements.refresh.classList.add("is-loading");
  elements.refresh.setAttribute("aria-busy", "true");
  toggleCsvMenu(false);
}

function showContentState() {
  const quizCount = extractedData.quizzes.length;
  const flashcardCount = extractedData.flashcards.length;
  elements.sourceDetail.textContent = extractedData.title;
  elements.quizCount.textContent = quizCount;
  elements.quizLabel.textContent = quizCount === 1 ? "quiz question" : "quiz questions";
  elements.flashcardCount.textContent = flashcardCount;
  elements.flashcardLabel.textContent = flashcardCount === 1 ? "flashcard" : "flashcards";
  elements.deckName.value = extractedData.title === "Unknown Notebook" ? "" : extractedData.title;

  elements.contentLoading.classList.add("hidden");
  elements.noContent.classList.add("hidden");
  elements.contentInfo.classList.remove("hidden");
  updateDeckPreview();
}

function showEmptyState(title, copy) {
  elements.sourceDetail.textContent = "Nothing ready to export";
  elements.noContent.querySelector("strong").textContent = title;
  elements.noContent.querySelector("p").textContent = copy;
  elements.contentLoading.classList.add("hidden");
  elements.contentInfo.classList.add("hidden");
  elements.noContent.classList.remove("hidden");
  elements.deckPreview.classList.add("hidden");
}

function mergeFrameData(results) {
  const merged = { title: "", quizzes: [], flashcards: [] };
  for (const result of results) {
    if (!merged.title && result.title && result.title !== "Unknown Notebook") {
      merged.title = result.title;
    }
    if (Array.isArray(result.quizzes)) merged.quizzes.push(...result.quizzes);
    if (Array.isArray(result.flashcards)) merged.flashcards.push(...result.flashcards);
  }

  merged.quizzes = deduplicate(merged.quizzes, quiz =>
    JSON.stringify([quiz.question, quiz.options?.map(option => option.text)])
  );
  merged.flashcards = deduplicate(merged.flashcards, card =>
    JSON.stringify([card.front, card.back])
  );
  merged.title = sanitizeDeckName(merged.title, "Unknown Notebook");
  return merged;
}

function updateDeckPreview() {
  if (!hasContent(extractedData)) {
    elements.deckPreview.classList.add("hidden");
    return;
  }

  const name = getDeckName();
  const hasQuizzes = extractedData.quizzes.length > 0;
  const hasFlashcards = extractedData.flashcards.length > 0;
  elements.deckPreview.classList.remove("hidden");
  elements.previewQuiz.classList.toggle("hidden", !hasQuizzes);
  elements.previewFlashcard.classList.toggle("hidden", !hasFlashcards);
  elements.previewQuiz.querySelector(".preview-name").textContent = name;
  elements.previewFlashcard.querySelector(".preview-name").textContent = name;
}

function updateActionStates() {
  const hasExportData = hasContent(extractedData);
  const contentReady = hasExportData && !scanning && !operationInProgress;
  elements.deckName.disabled = !hasExportData || scanning || operationInProgress;
  elements.anki.disabled = !contentReady || !ankiConnected;
  elements.apkg.disabled = !contentReady;
  elements.csvAll.disabled = !contentReady;
  elements.csvToggle.disabled = !contentReady;
  elements.csvQuizzes.disabled = !contentReady || !extractedData?.quizzes.length;
  elements.csvFlashcards.disabled = !contentReady || !extractedData?.flashcards.length;
  elements.csvHeaderless.disabled = !contentReady;
  elements.csvQuizFlashcards.disabled = !contentReady || !extractedData?.quizzes.length;
  elements.ankiDetail.textContent = ankiConnected
    ? "Direct through AnkiConnect"
    : "Open Anki to enable";
}

async function sendToAnki() {
  const response = await chrome.runtime.sendMessage({
    target: MESSAGE_TARGETS.BACKGROUND,
    action: ACTIONS.SEND_TO_ANKI,
    data: extractedData,
    deckName: getDeckName(),
    type: EXPORT_TYPES.ALL
  });

  if (!response?.success) {
    if (response?.count) {
      throw new Error(`${formatCount(response.count, "card")} sent; ${response.failed || 1} failed`);
    }
    throw new Error(response?.error || "Anki did not accept the export");
  }

  if (response.count === 0 && response.skipped > 0) {
    return `${formatCount(response.skipped, "card")} already existed in Anki`;
  }

  let message = `${formatCount(response.count, "card")} sent to Anki`;
  if (response.skipped > 0) message += ` · ${response.skipped} already existed`;
  return message;
}

async function downloadApkg() {
  const response = await chrome.runtime.sendMessage({
    target: MESSAGE_TARGETS.BACKGROUND,
    action: ACTIONS.GENERATE_APKG,
    data: extractedData,
    deckName: getDeckName()
  });
  if (!response?.success) throw new Error(response?.error || "The APKG file could not be created");
  return `${formatCount(response.count, "card")} saved in ${response.filename}`;
}

async function runExport(button, operation) {
  if (operationInProgress || button.disabled) return;
  operationInProgress = true;
  button.classList.add("is-loading");
  button.setAttribute("aria-busy", "true");
  updateActionStates();

  try {
    const successMessage = await operation();
    button.classList.add("is-success");
    showMessage(successMessage, "success");
  } catch (error) {
    button.classList.add("is-error");
    showMessage(formatError(error), "error");
  } finally {
    operationInProgress = false;
    button.classList.remove("is-loading");
    button.removeAttribute("aria-busy");
    setTimeout(() => button.classList.remove("is-success", "is-error"), 2200);
    updateActionStates();
  }
}

function runCsvExport(exporter) {
  if (operationInProgress || !hasContent(extractedData)) return;
  try {
    const result = exporter();
    const fileCount = result.files?.length || 1;
    showMessage(`${formatCount(result.count, "card")} saved in ${formatCount(fileCount, "CSV file")}`, "success");
  } catch (error) {
    showMessage(formatError(error), "error");
  }
}

function setConnectionState(state, label) {
  elements.status.className = `connection is-${state}`;
  elements.statusText.textContent = label;
  elements.status.setAttribute(
    "aria-label",
    state === "checking" ? "Checking Anki connection" : `${label}. Check again`
  );
}

function toggleCsvMenu(open) {
  if (elements.csvToggle.disabled && open) return;
  elements.csvMenu.classList.toggle("hidden", !open);
  elements.csvToggle.setAttribute("aria-expanded", String(open));
}

function firstEnabledMenuItem() {
  return elements.csvMenu.querySelector("button:not(:disabled)");
}

function showMessage(text, type) {
  clearTimeout(messageTimeout);
  elements.message.textContent = text;
  elements.message.className = `message is-${type}`;
  elements.message.setAttribute("role", type === "error" ? "alert" : "status");
  messageTimeout = setTimeout(() => elements.message.classList.add("hidden"), 6500);
}

function getDeckName() {
  return sanitizeDeckName(elements.deckName.value || extractedData?.title, "NotebookLM Export");
}

function getFilenameBase() {
  return sanitizeFilename(getDeckName());
}

function hasContent(data) {
  return Boolean(data && (data.quizzes?.length || data.flashcards?.length));
}

function isNotebookLMUrl(value) {
  try {
    return new URL(value).hostname === "notebooklm.google.com";
  } catch {
    return false;
  }
}

function deduplicate(items, createKey) {
  const seen = new Set();
  return items.filter(item => {
    const key = createKey(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function formatCount(count, noun) {
  return `${count} ${noun}${count === 1 ? "" : "s"}`;
}

function formatError(error) {
  const message = error instanceof Error ? error.message : String(error || "Export failed");
  if (/fetch|network|connect|anki offline|failed to fetch/i.test(message)) {
    return "Anki is unavailable. Open Anki with AnkiConnect, then try again.";
  }
  return message.replace(/[.!]+$/, "");
}
