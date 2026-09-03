// NotebookLM2Anki - Background service worker

import { ACTIONS, EXPORT_TYPES, MESSAGE_TARGETS } from "../lib/constants.js";
import { checkAnkiConnect, sendContentToAnki } from "../lib/anki-connect.js";

let creatingOffscreenDocument = null;

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target && message.target !== MESSAGE_TARGETS.BACKGROUND) return false;

  handleMessage(message)
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: getErrorMessage(error) }));
  return true;
});

async function handleMessage(message) {
  switch (message?.action) {
    case ACTIONS.CHECK_ANKI:
      return checkAnkiConnect();
    case ACTIONS.SEND_TO_ANKI:
      return sendContentToAnki(
        message.data,
        message.deckName,
        message.type || EXPORT_TYPES.ALL
      );
    case ACTIONS.GENERATE_APKG:
      return generateApkg(message);
    default:
      return { success: false, error: `Unknown action: ${message?.action || "missing"}` };
  }
}

async function generateApkg(message) {
  if (!message.data || typeof message.data !== "object") {
    return { success: false, error: "No content was provided" };
  }

  await setupOffscreenDocument();
  return chrome.runtime.sendMessage({
    target: MESSAGE_TARGETS.OFFSCREEN,
    action: ACTIONS.GENERATE_APKG,
    data: message.data,
    deckName: message.deckName
  });
}

async function setupOffscreenDocument() {
  const documentUrl = chrome.runtime.getURL("src/offscreen/offscreen.html");
  const contexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [documentUrl]
  });
  if (contexts.length > 0) return;

  if (!creatingOffscreenDocument) {
    const creation = chrome.offscreen.createDocument({
      url: documentUrl,
      reasons: ["BLOBS"],
      justification: "Build and download a local Anki package"
    });
    creatingOffscreenDocument = creation;

    try {
      await creation;
    } finally {
      if (creatingOffscreenDocument === creation) creatingOffscreenDocument = null;
    }
    return;
  }

  await creatingOffscreenDocument;
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error || "Unknown error");
}
