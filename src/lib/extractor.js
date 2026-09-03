// NotebookLM2Anki - Shared page extractor for classic content-script contexts

(function registerExtractor(global) {
  "use strict";

  if (global.NotebookLM2AnkiExtractor) return;

  const UNKNOWN_TITLE = "Unknown Notebook";
  const MAX_WALK_NODES = 10000;
  const MAX_WALK_DEPTH = 16;

  function extractFromPage(doc = document) {
    const roots = Array.from(doc.querySelectorAll("[data-app-data]"));
    if (roots.length === 0) return null;

    const aggregate = { title: "", quizzes: [], flashcards: [] };
    for (const root of roots) {
      const raw = root.getAttribute("data-app-data");
      const data = parseAppData(raw);
      if (!data) continue;

      const result = extractFromData(data);
      if (!aggregate.title && result.title) aggregate.title = result.title;
      aggregate.quizzes.push(...result.quizzes);
      aggregate.flashcards.push(...result.flashcards);
    }

    aggregate.quizzes = deduplicate(aggregate.quizzes, quiz =>
      JSON.stringify([quiz.question, quiz.options.map(option => option.text)])
    );
    aggregate.flashcards = deduplicate(aggregate.flashcards, card =>
      JSON.stringify([card.front, card.back])
    );

    return {
      title: sanitizeDeckName(aggregate.title || getNotebookTitle(doc)),
      quizzes: aggregate.quizzes,
      flashcards: aggregate.flashcards,
      extractedAt: new Date().toISOString()
    };
  }

  function extractFromData(data) {
    const quizzes = [];
    const flashcards = [];

    walkData(data, (value, path) => {
      if (!value || Array.isArray(value) || typeof value !== "object") return;

      const quiz = normalizeQuiz(value);
      if (quiz) quizzes.push(quiz);

      const flashcard = normalizeFlashcard(value, path);
      if (flashcard) flashcards.push(flashcard);
    });

    return {
      title: readDataTitle(data),
      quizzes: deduplicate(quizzes, quiz =>
        JSON.stringify([quiz.question, quiz.options.map(option => option.text)])
      ),
      flashcards: deduplicate(flashcards, card => JSON.stringify([card.front, card.back]))
    };
  }

  function normalizeQuiz(candidate) {
    const question = firstText(candidate.question, candidate.prompt, candidate.questionText);
    const rawOptions = candidate.answerOptions || candidate.options || candidate.answers;
    if (!question || !Array.isArray(rawOptions) || rawOptions.length < 2) return null;

    const options = rawOptions
      .map(option => {
        if (typeof option === "string") {
          return { text: option.trim(), isCorrect: false, rationale: "" };
        }
        if (!option || typeof option !== "object") return null;

        return {
          text: firstText(option.text, option.answer, option.content, option.label),
          isCorrect: Boolean(option.isCorrect ?? option.correct ?? option.isAnswer),
          rationale: firstText(option.rationale, option.explanation, option.reason)
        };
      })
      .filter(option => option?.text)
      .slice(0, 4);

    if (options.length < 2) return null;

    return {
      type: "quiz",
      question,
      hint: firstText(candidate.hint, candidate.clue),
      archDiagram: firstText(candidate.archDiagram, candidate.diagram, candidate.image),
      options
    };
  }

  function normalizeFlashcard(candidate, path) {
    const pathText = path.join(".").toLowerCase();
    const knownShape = "f" in candidate || "b" in candidate;
    const namedCollection = pathText.includes("flashcard") || pathText.includes("studycard");
    if (!knownShape && !namedCollection) return null;

    const front = firstText(candidate.f, candidate.front, candidate.term, candidate.question);
    const back = firstText(candidate.b, candidate.back, candidate.definition, candidate.answer);
    if (!front || !back) return null;

    return { type: "flashcard", front, back };
  }

  function walkData(root, visit) {
    const stack = [{ value: root, path: [], depth: 0 }];
    let visited = 0;

    while (stack.length > 0 && visited < MAX_WALK_NODES) {
      const current = stack.pop();
      visited += 1;
      visit(current.value, current.path);

      if (
        current.depth >= MAX_WALK_DEPTH ||
        !current.value ||
        typeof current.value !== "object"
      ) {
        continue;
      }

      if (Array.isArray(current.value)) {
        for (let index = current.value.length - 1; index >= 0; index -= 1) {
          stack.push({
            value: current.value[index],
            path: current.path,
            depth: current.depth + 1
          });
        }
        continue;
      }

      const entries = Object.entries(current.value);
      for (let index = entries.length - 1; index >= 0; index -= 1) {
        const [key, value] = entries[index];
        stack.push({ value, path: current.path.concat(key), depth: current.depth + 1 });
      }
    }
  }

  function getNotebookTitle(doc) {
    const selectors = [
      'input[placeholder*="notebook" i]',
      'textarea[placeholder*="notebook" i]',
      '[data-testid*="title" i]',
      ".title-label",
      "main h1",
      "h1"
    ];

    for (const selector of selectors) {
      const element = doc.querySelector(selector);
      const value = "value" in (element || {}) ? element.value : element?.textContent;
      if (typeof value === "string" && value.trim()) return value.trim();
    }

    const pageTitle = String(doc.title || "")
      .replace(/\s*(?:-|–|\|)\s*NotebookLM\s*$/i, "")
      .trim();
    return pageTitle || UNKNOWN_TITLE;
  }

  function readDataTitle(data) {
    if (!data || typeof data !== "object") return "";
    return firstText(
      data.title,
      data.notebookTitle,
      data.notebook?.title,
      data.project?.title
    );
  }

  function parseAppData(value) {
    const input = String(value ?? "");
    if (!input) return null;

    try {
      return JSON.parse(input);
    } catch {
      let decoded = input;
      for (let pass = 0; pass < 2; pass += 1) {
        const next = decodeHtml(decoded);
        if (next === decoded) break;
        decoded = next;
        try {
          return JSON.parse(decoded);
        } catch {
          // Some NotebookLM payloads are encoded more than once.
        }
      }
      return null;
    }
  }

  function decodeHtml(value) {
    return value.replace(
      /&(?:quot|amp|lt|gt|#39|#x27|#x2F|#(\d+)|#x([\da-f]+));/gi,
      (entity, decimal, hexadecimal) => {
        const codePoint = decimal
          ? Number(decimal)
          : hexadecimal
            ? Number.parseInt(hexadecimal, 16)
            : null;
        if (codePoint !== null) {
          return Number.isInteger(codePoint) && codePoint >= 0 && codePoint <= 0x10ffff
            ? String.fromCodePoint(codePoint)
            : entity;
        }
        return ({
          "&quot;": '"',
          "&amp;": "&",
          "&lt;": "<",
          "&gt;": ">",
          "&#39;": "'",
          "&#x27;": "'",
          "&#x2f;": "/"
        })[entity.toLowerCase()] ?? entity;
      }
    );
  }

  function sanitizeDeckName(value) {
    const name = String(value ?? "")
      .replace(/[\u0000-\u001f\u007f]/g, " ")
      .replace(/::/g, " - ")
      .replace(/\s+/g, " ")
      .trim();
    return name || UNKNOWN_TITLE;
  }

  function firstText(...values) {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
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

  global.NotebookLM2AnkiExtractor = Object.freeze({
    extractFromPage,
    extractFromData,
    sanitizeDeckName
  });
})(globalThis);
