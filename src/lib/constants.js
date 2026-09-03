// NotebookLM2Anki - Shared runtime contracts

export const CONFIG = Object.freeze({
  ANKI_CONNECT_URL: "http://127.0.0.1:8765",
  ANKI_CONNECT_VERSION: 6,
  DEFAULT_PARENT_DECK: "NotebookLM",
  DEFAULT_DECK_NAME: "NotebookLM Export",
  DEFAULT_TAGS: Object.freeze(["notebooklm_export"])
});

export const MESSAGE_TARGETS = Object.freeze({
  BACKGROUND: "background",
  OFFSCREEN: "offscreen"
});

export const ACTIONS = Object.freeze({
  CHECK_ANKI: "checkAnki",
  SEND_TO_ANKI: "sendToAnki",
  GENERATE_APKG: "generateApkg"
});

export const EXPORT_TYPES = Object.freeze({
  ALL: "all",
  QUIZZES: "quizzes",
  FLASHCARDS: "flashcards"
});
