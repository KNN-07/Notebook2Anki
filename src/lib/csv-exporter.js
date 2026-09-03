// NotebookLM2Anki - CSV serialization and downloads

import { downloadFile, escapeCSV, sanitizeFilename } from "./utils.js";

const LINE_BREAK = "\r\n";
const QUIZ_HEADERS = Object.freeze([
  "Question",
  "Hint",
  "Option1", "Flag1", "Rationale1",
  "Option2", "Flag2", "Rationale2",
  "Option3", "Flag3", "Rationale3",
  "Option4", "Flag4", "Rationale4"
]);

export function createFlashcardsCSV(flashcards, includeHeader = true) {
  const rows = includeHeader ? [["Front", "Back"]] : [];
  for (const card of Array.isArray(flashcards) ? flashcards : []) {
    if (!card || (!card.front && !card.back)) continue;
    rows.push([card.front, card.back]);
  }
  return serializeRows(rows);
}

export function createQuizzesCSV(quizzes, includeHeader = true) {
  const rows = includeHeader ? [QUIZ_HEADERS] : [];
  for (const quiz of Array.isArray(quizzes) ? quizzes : []) {
    if (!quiz?.question) continue;
    const options = Array.isArray(quiz.options) ? quiz.options : [];
    const row = [quiz.question, quiz.hint || ""];
    for (let index = 0; index < 4; index += 1) {
      const option = options[index];
      row.push(
        option?.text || "",
        option?.isCorrect ? "True" : "False",
        option?.rationale || ""
      );
    }
    rows.push(row);
  }
  return serializeRows(rows);
}

export function createQuizFlashcardsCSV(quizzes, includeHeader = true) {
  const rows = includeHeader ? [["Front", "Back"]] : [];
  for (const quiz of Array.isArray(quizzes) ? quizzes : []) {
    const correctOption = quiz?.options?.find(option => option?.isCorrect);
    if (quiz?.question && correctOption?.text) rows.push([quiz.question, correctOption.text]);
  }
  return serializeRows(rows);
}

export function exportFlashcardsToCSV(flashcards, options = {}) {
  const filename = options.filename || "notebooklm-flashcards.csv";
  const csv = createFlashcardsCSV(flashcards, options.includeHeader !== false);
  downloadFile(csv, filename, "text/csv;charset=utf-8");
  return { success: true, count: countDataRows(csv, options.includeHeader !== false), filename };
}

export function exportQuizzesToCSV(quizzes, options = {}) {
  const filename = options.filename || "notebooklm-quizzes.csv";
  const csv = createQuizzesCSV(quizzes, options.includeHeader !== false);
  downloadFile(csv, filename, "text/csv;charset=utf-8");
  return { success: true, count: countDataRows(csv, options.includeHeader !== false), filename };
}

export function exportQuizFlashcardsToCSV(quizzes, options = {}) {
  const filename = options.filename || "notebooklm-quiz-flashcards.csv";
  const csv = createQuizFlashcardsCSV(quizzes, options.includeHeader !== false);
  downloadFile(csv, filename, "text/csv;charset=utf-8");
  return { success: true, count: countDataRows(csv, options.includeHeader !== false), filename };
}

export function exportAllToCSV(data, options = {}) {
  const filenameBase = sanitizeFilename(options.filenameBase || data?.title);
  const results = [];

  if (data?.quizzes?.length) {
    results.push(exportQuizzesToCSV(data.quizzes, {
      includeHeader: options.includeHeader,
      filename: `${filenameBase}-quizzes.csv`
    }));
  }
  if (data?.flashcards?.length) {
    results.push(exportFlashcardsToCSV(data.flashcards, {
      includeHeader: options.includeHeader,
      filename: `${filenameBase}-flashcards.csv`
    }));
  }
  if (results.length === 0) throw new Error("No quizzes or flashcards were found");

  return {
    success: true,
    count: results.reduce((total, result) => total + result.count, 0),
    files: results.map(result => result.filename)
  };
}

function serializeRows(rows) {
  if (rows.length === 0) return "";
  return `${rows.map(row => row.map(escapeCSV).join(",")).join(LINE_BREAK)}${LINE_BREAK}`;
}

function countDataRows(csv, hasHeader) {
  if (!csv) return 0;
  const rowCount = csv.split(LINE_BREAK).filter(Boolean).length;
  return Math.max(0, rowCount - (hasHeader ? 1 : 0));
}
