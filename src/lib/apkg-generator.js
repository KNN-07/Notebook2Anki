// NotebookLM2Anki - Offscreen APKG generation

import { getQuizModel } from "../templates/quiz-model.js";
import { getFlashcardModel } from "../templates/flashcard-model.js";
import { cleanMath, generateId, sanitizeDeckName, sanitizeFilename } from "./utils.js";

let initializationPromise = null;

export function initApkgGenerator() {
  if (globalThis.SQL?.Database) return Promise.resolve(globalThis.SQL);
  if (initializationPromise) return initializationPromise;
  if (typeof globalThis.initSqlJs !== "function") {
    return Promise.reject(new Error("sql.js is unavailable in the offscreen document"));
  }

  initializationPromise = globalThis.initSqlJs({
    locateFile: file => chrome.runtime.getURL(`vendor/${file}`)
  }).then(sql => {
    globalThis.SQL = sql;
    return sql;
  }).catch(error => {
    initializationPromise = null;
    throw error;
  });

  return initializationPromise;
}

export async function generateApkg(data, deckName) {
  if (!data || typeof data !== "object") throw new Error("No content was provided");
  await initApkgGenerator();

  const ModelClass = globalThis.Model;
  const DeckClass = globalThis.Deck;
  const PackageClass = globalThis.Package;
  if (!ModelClass || !DeckClass || !PackageClass) {
    throw new Error("The APKG packaging library is unavailable");
  }

  const quizModel = new ModelClass(getQuizModel());
  const flashcardModel = new ModelClass(getFlashcardModel());
  const packageFile = new PackageClass();
  const baseName = sanitizeDeckName(deckName, "NotebookLM Export");
  let count = 0;

  const quizzes = Array.isArray(data.quizzes) ? data.quizzes : [];
  if (quizzes.length > 0) {
    const quizDeck = new DeckClass(generateId(), `${baseName} - Quiz`);
    for (const quiz of quizzes) {
      if (!quiz || !String(quiz.question || "").trim()) continue;
      quizDeck.addNote(quizModel.note(quizToFields(quiz)));
      count += 1;
    }
    if (quizDeck.notes.length > 0) packageFile.addDeck(quizDeck);
  }

  const flashcards = Array.isArray(data.flashcards) ? data.flashcards : [];
  if (flashcards.length > 0) {
    const flashcardDeck = new DeckClass(generateId(), `${baseName} - Flashcard`);
    for (const card of flashcards) {
      if (!card || !String(card.front || "").trim() || !String(card.back || "").trim()) continue;
      flashcardDeck.addNote(flashcardModel.note([
        cleanMath(card.front),
        cleanMath(card.back)
      ]));
      count += 1;
    }
    if (flashcardDeck.notes.length > 0) packageFile.addDeck(flashcardDeck);
  }

  if (count === 0) throw new Error("No valid quizzes or flashcards were found");
  return { packageFile, count, baseName };
}

export async function downloadApkg(data, deckName) {
  try {
    const { packageFile, count, baseName } = await generateApkg(data, deckName);
    const filename = `${sanitizeFilename(baseName)}.apkg`;
    await packageFile.writeToFile(filename);
    return { success: true, count, filename };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function quizToFields(quiz) {
  const options = Array.isArray(quiz.options) ? quiz.options : [];
  const fields = [
    cleanMath(quiz.question),
    cleanMath(quiz.hint),
    cleanMath(quiz.archDiagram)
  ];

  for (let index = 0; index < 4; index += 1) {
    const option = options[index];
    fields.push(
      cleanMath(option?.text),
      option?.isCorrect ? "True" : "False",
      cleanMath(option?.rationale)
    );
  }
  return fields;
}
