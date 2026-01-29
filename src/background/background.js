// NotebookLM2Anki - Background Service Worker
// Handles AnkiConnect API calls and extension messaging

import { QUIZ_STYLING, QUIZ_FRONT_TEMPLATE, QUIZ_BACK_TEMPLATE, QUIZ_FIELDS } from '../templates/quiz-model.js';
import { FLASHCARD_STYLING, FLASHCARD_FRONT_TEMPLATE, FLASHCARD_BACK_TEMPLATE, FLASHCARD_FIELDS } from '../templates/flashcard-model.js';

// Configuration
const CONFIG = {
  ANKI_CONNECT_URL: "http://127.0.0.1:8765",
  ANKI_CONNECT_VERSION: 6,
  DEFAULT_PARENT_DECK: "NotebookLM",
  DEFAULT_TAGS: ["notebooklm_export"]
};

// Handle messages from content script and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender)
    .then(sendResponse)
    .catch(error => sendResponse({ success: false, error: error.message }));
  
  return true; // Keep channel open for async response
});

async function handleMessage(request, sender) {
  console.log("[NotebookLM2Anki] Background received:", request.action);
  
  switch (request.action) {
    case 'checkAnki':
      return await checkAnkiConnect();
    
    case 'sendToAnki':
      return await handleSendToAnki(request);
    
    case 'sendBatchToAnki':
      return await handleLegacySendBatch(request);
    
    case 'generateApkg':
      return await handleGenerateApkg(request);
    
    default:
      return { success: false, error: `Unknown action: ${request.action}` };
  }
}

// ==================== ANKICONNECT API ====================

function cleanMath(str) {
  if (!str) return "";
  let s = str.replace(/\$\$(.*?)\$\$/gs, '\\[$1\\]');
  s = s.replace(/\$((?:[^$]|\\\$)+?)\$/g, '\\($1\\)');
  s = s.replace(/\`([^\`]+)\`/g, '<code class="latex-snippet">$1</code>');
  return s;
}

async function ankiRequest(action, params = {}) {
  const response = await fetch(CONFIG.ANKI_CONNECT_URL, {
    method: 'POST',
    body: JSON.stringify({
      action,
      version: CONFIG.ANKI_CONNECT_VERSION,
      params
    })
  });
  
  const data = await response.json();
  
  if (data.error) {
    throw new Error(data.error);
  }
  
  return data.result;
}

async function checkAnkiConnect() {
  try {
    const version = await ankiRequest('version');
    return { connected: true, version };
  } catch (error) {
    return { connected: false, error: error.message };
  }
}

async function createDeck(deckName) {
  return await ankiRequest('createDeck', { deck: deckName });
}

async function modelExists(modelName) {
  const models = await ankiRequest('modelNames');
  return models.includes(modelName);
}

async function canAddNotes(notes) {
  return await ankiRequest('canAddNotes', { notes });
}

async function addNotes(notes) {
  return await ankiRequest('addNotes', { notes });
}

// ==================== NOTE TYPE TEMPLATES ====================

async function ensureQuizModel() {
  const modelName = "NotebookLM Quiz";
  const exists = await modelExists(modelName);
  if (exists) return true;
  
  try {
    const fieldNames = QUIZ_FIELDS.map(f => f.name);
    
    await ankiRequest('createModel', {
      modelName: modelName,
      inOrderFields: fieldNames,
      css: QUIZ_STYLING,
      cardTemplates: [{
        Name: "Quiz Card",
        Front: QUIZ_FRONT_TEMPLATE,
        Back: QUIZ_BACK_TEMPLATE
      }]
    });
    return true;
  } catch (error) {
    console.error("[NotebookLM2Anki] Failed to create quiz model:", error);
    return false;
  }
}

async function ensureFlashcardModel() {
  const modelName = "NotebookLM Flashcard";
  const exists = await modelExists(modelName);
  if (exists) return true;
  
  try {
    const fieldNames = FLASHCARD_FIELDS.map(f => f.name);
    
    await ankiRequest('createModel', {
      modelName: modelName,
      inOrderFields: fieldNames,
      css: FLASHCARD_STYLING,
      cardTemplates: [{
        Name: "Flashcard",
        Front: FLASHCARD_FRONT_TEMPLATE,
        Back: FLASHCARD_BACK_TEMPLATE
      }]
    });
    return true;
  } catch (error) {
    console.error("[NotebookLM2Anki] Failed to create flashcard model:", error);
    return false;
  }
}

// ==================== EXPORT HANDLERS ====================

async function handleSendToAnki(request) {
  const { data, deckName, type } = request;
  
  if (!data) {
    return { success: false, error: "No data provided" };
  }
  
  try {
    const name = deckName || data.title || "Unknown Notebook";
    
    switch (type) {
      case 'quizzes':
        if (!data.quizzes || data.quizzes.length === 0) {
          return { success: false, error: "No quizzes to send" };
        }
        return await sendQuizzesToAnki(data.quizzes, name);
      
      case 'flashcards':
        if (!data.flashcards || data.flashcards.length === 0) {
          return { success: false, error: "No flashcards to send" };
        }
        return await sendFlashcardsToAnki(data.flashcards, name);
      
      case 'all':
      default:
        return await sendAllToAnki(data, name);
    }
  } catch (error) {
    console.error("[NotebookLM2Anki] AnkiConnect error:", error);
    return { success: false, error: error.message };
  }
}

async function sendQuizzesToAnki(quizzes, deckName) {
  const targetDeck = `${CONFIG.DEFAULT_PARENT_DECK}::${deckName} - Quiz`;

  await createDeck(targetDeck);
  await ensureQuizModel();

  const notes = quizzes.map(quiz => {
    const options = quiz.options || [];
    return {
      deckName: targetDeck,
      modelName: "NotebookLM Quiz",
      fields: {
        Question: cleanMath(quiz.question || ""),
        Hint: cleanMath(quiz.hint || ""),
        ArchDiagram: "",
        Option1: cleanMath(options[0]?.text || ""),
        Flag1: options[0]?.isCorrect ? "True" : "False",
        Rationale1: cleanMath(options[0]?.rationale || ""),
        Option2: cleanMath(options[1]?.text || ""),
        Flag2: options[1]?.isCorrect ? "True" : "False",
        Rationale2: cleanMath(options[1]?.rationale || ""),
        Option3: cleanMath(options[2]?.text || ""),
        Flag3: options[2]?.isCorrect ? "True" : "False",
        Rationale3: cleanMath(options[2]?.rationale || ""),
        Option4: cleanMath(options[3]?.text || ""),
        Flag4: options[3]?.isCorrect ? "True" : "False",
        Rationale4: cleanMath(options[3]?.rationale || "")
      },
      tags: CONFIG.DEFAULT_TAGS
    };
  });

  const canAddResults = await canAddNotes(notes);
  const newNotes = notes.filter((_, index) => canAddResults[index]);
  const skippedCount = notes.length - newNotes.length;

  if (newNotes.length === 0) {
    return { success: true, count: 0, skipped: skippedCount, total: notes.length, message: "All cards already exist in Anki" };
  }

  const results = await addNotes(newNotes);
  const successCount = results.filter(id => id !== null).length;

  return {
    success: true,
    count: successCount,
    skipped: skippedCount,
    total: notes.length,
    message: skippedCount > 0 ? `Added ${successCount} new cards, skipped ${skippedCount} duplicates` : undefined
  };
}

async function sendFlashcardsToAnki(flashcards, deckName) {
  const targetDeck = `${CONFIG.DEFAULT_PARENT_DECK}::${deckName} - Flashcard`;

  await createDeck(targetDeck);
  await ensureFlashcardModel();

  const notes = flashcards.map(card => ({
    deckName: targetDeck,
    modelName: "NotebookLM Flashcard",
    fields: {
      Front: cleanMath(card.front || ""),
      Back: cleanMath(card.back || "")
    },
    tags: CONFIG.DEFAULT_TAGS
  }));

  const canAddResults = await canAddNotes(notes);
  const newNotes = notes.filter((_, index) => canAddResults[index]);
  const skippedCount = notes.length - newNotes.length;

  if (newNotes.length === 0) {
    return { success: true, count: 0, skipped: skippedCount, total: notes.length, message: "All cards already exist in Anki" };
  }

  const results = await addNotes(newNotes);
  const successCount = results.filter(id => id !== null).length;

  return {
    success: true,
    count: successCount,
    skipped: skippedCount,
    total: notes.length,
    message: skippedCount > 0 ? `Added ${successCount} new cards, skipped ${skippedCount} duplicates` : undefined
  };
}

async function sendAllToAnki(data, deckName) {
  let totalSuccess = 0;
  let totalSkipped = 0;
  let totalCards = 0;
  const messages = [];

  if (data.quizzes && data.quizzes.length > 0) {
    const result = await sendQuizzesToAnki(data.quizzes, deckName);
    totalSuccess += result.count;
    totalSkipped += result.skipped || 0;
    totalCards += data.quizzes.length;
    if (result.message) messages.push(result.message);
  }

  if (data.flashcards && data.flashcards.length > 0) {
    const result = await sendFlashcardsToAnki(data.flashcards, deckName);
    totalSuccess += result.count;
    totalSkipped += result.skipped || 0;
    totalCards += data.flashcards.length;
    if (result.message) messages.push(result.message);
  }

  return {
    success: true,
    count: totalSuccess,
    skipped: totalSkipped,
    total: totalCards,
    message: messages.length > 0 ? messages.join('; ') : undefined
  };
}

// Legacy handler for backwards compatibility
async function handleLegacySendBatch(request) {
  const { batchData, deckTitle } = request;
  
  if (!batchData || !Array.isArray(batchData)) {
    return { success: false, error: "No batch data provided" };
  }
  
  try {
    const targetDeck = `${CONFIG.DEFAULT_PARENT_DECK}::${deckTitle || 'Default Notebook'} - Quiz`;
    
    await createDeck(targetDeck);
    await ensureQuizModel();
    
    const notes = batchData.map(card => ({
      deckName: targetDeck,
      modelName: "NotebookLM Quiz",
      fields: {
        Question: cleanMath(card.question || ""),
        Hint: cleanMath(card.hint || ""),
        ArchDiagram: "",
        Option1: cleanMath(card.option1 || ""),
        Flag1: card.flag1 || "False",
        Rationale1: cleanMath(card.rationale1 || ""),
        Option2: cleanMath(card.option2 || ""),
        Flag2: card.flag2 || "False",
        Rationale2: cleanMath(card.rationale2 || ""),
        Option3: cleanMath(card.option3 || ""),
        Flag3: card.flag3 || "False",
        Rationale3: cleanMath(card.rationale3 || ""),
        Option4: cleanMath(card.option4 || ""),
        Flag4: card.flag4 || "False",
        Rationale4: cleanMath(card.rationale4 || "")
      },
      tags: CONFIG.DEFAULT_TAGS
    }));
    
    const canAddResults = await canAddNotes(notes);
    const newNotes = notes.filter((_, index) => canAddResults[index]);
    const skippedCount = notes.length - newNotes.length;

    if (newNotes.length === 0) {
      return { success: true, count: 0, skipped: skippedCount, total: notes.length };
    }

    const results = await addNotes(newNotes);
    const successCount = results.filter(id => id !== null).length;

    if (successCount === 0 && notes.length > 0) {
      return { success: false, error: "0 Cards Added. Check if 'NotebookLM Quiz' Note Type exists!" };
    }

    return { success: true, count: successCount, skipped: skippedCount, total: notes.length };
  } catch (error) {
    return { success: false, error: "Connection Failed: Is Anki open?" };
  }
}

// Log when service worker starts
console.log("[NotebookLM2Anki] Background service worker started");

// ==================== OFFSCREEN DOCUMENT FOR APKG ====================

let creatingOffscreen = null;

async function setupOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL('src/offscreen/offscreen.html');
  
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [offscreenUrl]
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['DOM_SCRAPING'],
      justification: 'Generate APKG files using sql.js WebAssembly'
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

async function handleGenerateApkg(request) {
  try {
    await setupOffscreenDocument();
    
    const response = await chrome.runtime.sendMessage({
      action: 'generateApkg',
      data: request.data,
      deckName: request.deckName
    });
    
    return response;
  } catch (error) {
    console.error("[NotebookLM2Anki] APKG generation error:", error);
    return { success: false, error: error.message };
  }
}
