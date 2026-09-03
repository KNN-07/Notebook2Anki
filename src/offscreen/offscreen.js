import { ACTIONS, MESSAGE_TARGETS } from "../lib/constants.js";
import { downloadApkg } from "../lib/apkg-generator.js";

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (
    message?.target !== MESSAGE_TARGETS.OFFSCREEN ||
    message.action !== ACTIONS.GENERATE_APKG
  ) {
    return false;
  }

  downloadApkg(message.data, message.deckName)
    .then(sendResponse)
    .catch(error => sendResponse({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }));
  return true;
});
