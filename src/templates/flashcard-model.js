// NotebookLM2Anki - Flashcard note type

export const FLASHCARD_MODEL_ID = 1609234567891;
export const FLASHCARD_MODEL_NAME = "NotebookLM Flashcard";
export const FLASHCARD_FIELDS = Object.freeze([
  Object.freeze({ name: "Front" }),
  Object.freeze({ name: "Back" })
]);

export const FLASHCARD_STYLING = `
html { overflow-x: hidden; }
body {
  margin: 0;
  background: #171918;
  color: #eef2ed;
  font-family: "Segoe UI Variable", "Aptos", "Segoe UI", system-ui, sans-serif;
}
.card {
  min-height: 100vh;
  min-height: 100dvh;
  margin: 0;
  padding: 28px 18px;
  display: grid;
  place-items: center;
  box-sizing: border-box;
  background: radial-gradient(circle at 50% -20%, rgba(168, 199, 250, .12), transparent 44%), #171918;
  font-size: 18px;
  line-height: 1.65;
  text-align: left;
}
.flashcard-shell {
  width: min(100%, 640px);
  padding: clamp(24px, 5vw, 42px);
  box-sizing: border-box;
  border: 1px solid #3b423c;
  border-radius: 18px 18px 18px 6px;
  background: #1f2320;
  box-shadow: 0 18px 50px rgba(7, 10, 8, .3);
}
.card-label {
  margin-bottom: 17px;
  color: #8e998f;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .1em;
  text-transform: uppercase;
}
.front-section {
  color: #f5f7f4;
  font-size: clamp(1.25rem, 4vw, 1.55rem);
  font-weight: 620;
  line-height: 1.45;
  letter-spacing: -.018em;
  text-wrap: pretty;
}
.answer-divider {
  height: 1px;
  margin: 28px 0 25px;
  background: #3b423c;
}
.back-section {
  color: #c7dcff;
  font-size: clamp(1.08rem, 3.3vw, 1.3rem);
  line-height: 1.6;
  text-wrap: pretty;
}
.front-repeat {
  color: #aeb7af;
  font-size: .96rem;
  line-height: 1.55;
}
.latex-snippet,
code {
  padding: .12em .36em;
  border: 1px solid #454d46;
  border-radius: 5px;
  background: #292e2a;
  color: #f0cf83;
  font-family: "SFMono-Regular", Consolas, monospace;
  font-size: .9em;
}
img { max-width: 100%; height: auto; border-radius: 10px; }
a { color: #a8c7fa; text-underline-offset: .2em; }
@media (max-width: 520px) {
  .card { padding: 12px; }
  .flashcard-shell { padding: 24px 20px; border-radius: 14px 14px 14px 5px; }
}
`;

export const FLASHCARD_FRONT_TEMPLATE = `<div class="flashcard-shell">
  <div class="card-label">Question</div>
  <div class="front-section" id="front-content">{{Front}}</div>
</div>
${createMathScript(["front-content"])}`;

export const FLASHCARD_BACK_TEMPLATE = `<div class="flashcard-shell">
  <div class="card-label">Question</div>
  <div class="front-repeat" id="back-front">{{Front}}</div>
  <div class="answer-divider" aria-hidden="true"></div>
  <div class="card-label">Answer</div>
  <div class="back-section" id="back-content">{{Back}}</div>
</div>
${createMathScript(["back-front", "back-content"])}`;

export function getFlashcardModel() {
  return {
    name: FLASHCARD_MODEL_NAME,
    id: FLASHCARD_MODEL_ID.toString(),
    flds: FLASHCARD_FIELDS,
    req: [[0, "all", [0]]],
    tmpls: [{
      name: "Flashcard",
      qfmt: FLASHCARD_FRONT_TEMPLATE,
      afmt: FLASHCARD_BACK_TEMPLATE
    }],
    css: FLASHCARD_STYLING
  };
}

function createMathScript(elementIds) {
  return `<script>
(function () {
  function cleanMath(value) {
    if (!value) return "";
    return value
      .replace(/\\$\\$(.*?)\\$\\$/gs, "\\\\[$1\\\\]")
      .replace(/\\$((?:[^$]|\\\\\\$)+?)\\$/g, "\\\\($1\\\\)")
      .replace(/\u0060([^\u0060]+)\u0060/g, '<code class="latex-snippet">$1</code>');
  }
  function typeset(elements) {
    if (typeof MathJax === "undefined") return;
    if (MathJax.typesetPromise) MathJax.typesetPromise(elements).catch(function () {});
    else if (MathJax.Hub) MathJax.Hub.Queue(["Typeset", MathJax.Hub, document.body]);
  }
  var elements = ${JSON.stringify(elementIds)}.map(function (id) {
    return document.getElementById(id);
  }).filter(Boolean);
  elements.forEach(function (element) {
    element.innerHTML = cleanMath(element.innerHTML);
  });
  setTimeout(function () { typeset(elements); }, 80);
})();
<\\/script>`;
}
