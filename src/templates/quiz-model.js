// NotebookLM2Anki - Interactive quiz note type

export const QUIZ_MODEL_ID = 1609234567890;
export const QUIZ_MODEL_NAME = "NotebookLM Quiz";
export const QUIZ_FIELDS = Object.freeze([
  "Question", "Hint", "ArchDiagram",
  "Option1", "Flag1", "Rationale1",
  "Option2", "Flag2", "Rationale2",
  "Option3", "Flag3", "Rationale3",
  "Option4", "Flag4", "Rationale4"
].map(name => Object.freeze({ name })));

export const QUIZ_STYLING = `
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
  background: radial-gradient(circle at 20% -15%, rgba(168, 199, 250, .1), transparent 42%), #171918;
  font-size: 16px;
  line-height: 1.55;
  text-align: left;
}
.quiz-layout {
  width: 100%;
  min-height: 100vh;
  min-height: 100dvh;
  padding: clamp(22px, 5vw, 58px) 20px;
  box-sizing: border-box;
  display: grid;
  place-items: start center;
}
.quiz-panel {
  width: min(100%, 680px);
}
.question-text {
  margin-bottom: 24px;
  color: #f5f7f4;
  font-size: clamp(1.3rem, 3vw, 1.7rem);
  font-weight: 650;
  line-height: 1.38;
  letter-spacing: -.022em;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}
.hint-container { margin-bottom: 16px; }
.hint-button {
  min-height: 36px;
  padding: 0 12px;
  border: 1px solid #414942;
  border-radius: 8px;
  background: #202421;
  color: #b9c6bb;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font: 650 .78rem/1 inherit;
  cursor: pointer;
  transition: border-color 160ms ease, background-color 160ms ease, color 160ms ease, transform 120ms ease;
}
.hint-button:hover { border-color: #59635b; background: #282d29; color: #eef2ed; }
.hint-button:active { transform: translateY(1px); }
.hint-button:focus-visible,
.option-button:focus-visible { outline: 2px solid #d7e6ff; outline-offset: 2px; }
.hint-button svg {
  width: 16px;
  height: 16px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.8;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.hint-text {
  margin-top: 8px;
  padding: 12px 14px;
  border: 1px solid #3a423b;
  border-radius: 8px;
  background: #1d211e;
  color: #c7cec8;
  font-size: .9rem;
  overflow-wrap: anywhere;
}
.options-list {
  display: grid;
  gap: 8px;
}
.option-button {
  width: 100%;
  padding: 16px;
  box-sizing: border-box;
  border: 1px solid #3a413b;
  border-radius: 12px 12px 12px 4px;
  background: #202421;
  color: #eef2ed;
  display: block;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: border-color 170ms ease, background-color 170ms ease, transform 120ms ease, opacity 170ms ease;
}
.option-button:hover { border-color: #59635b; background: #272c28; }
.option-button:active { transform: translateY(1px); }
.option-content {
  display: grid;
  grid-template-columns: 28px minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}
.option-letter {
  width: 28px;
  height: 28px;
  display: grid;
  place-items: center;
  border: 1px solid #4a534b;
  border-radius: 7px;
  color: #a8c7fa;
  font-size: .72rem;
  font-weight: 750;
  line-height: 1;
}
.option-text {
  padding-top: 2px;
  font-size: 1rem;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}
.option-button.is-correct {
  border-color: rgba(155, 211, 168, .7);
  background: rgba(155, 211, 168, .08);
}
.option-button.is-correct .option-letter {
  border-color: rgba(155, 211, 168, .7);
  color: #aee0b9;
}
.option-button.is-wrong {
  border-color: rgba(240, 170, 163, .68);
  background: rgba(240, 170, 163, .07);
}
.option-button.is-wrong .option-letter {
  border-color: rgba(240, 170, 163, .68);
  color: #f4b9b3;
}
.option-button.is-dimmed { opacity: .46; }
.feedback {
  display: block;
  margin: 12px 0 0 40px;
  padding-top: 12px;
  border-top: 1px solid #3b423c;
}
.feedback-title {
  display: block;
  margin-bottom: 4px;
  color: #b8c1b9;
  font-size: .78rem;
  font-weight: 750;
}
.is-correct .feedback-title { color: #aee0b9; }
.is-wrong .feedback-title { color: #f4b9b3; }
.rationale-text {
  display: block;
  color: #b6beb7;
  font-size: .88rem;
  line-height: 1.5;
  overflow-wrap: anywhere;
}
.quiz-layout.has-diagram {
  grid-template-columns: minmax(360px, 680px) minmax(300px, 620px);
  gap: clamp(24px, 4vw, 60px);
  align-items: start;
  justify-content: center;
  justify-items: stretch;
}
.diagram-panel {
  position: sticky;
  top: 30px;
  width: 100%;
  min-width: 0;
  padding: 14px;
  box-sizing: border-box;
  border: 1px solid #3a413b;
  border-radius: 14px;
  background: #1d211e;
}
.diagram-panel img,
.diagram-panel svg {
  width: 100%;
  max-height: calc(100vh - 90px);
  object-fit: contain;
  border-radius: 8px;
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
a { color: #a8c7fa; text-underline-offset: .2em; }
[hidden] { display: none !important; }
.card.back .option-button { pointer-events: none; }
@media (max-width: 920px) {
  .quiz-layout.has-diagram { grid-template-columns: minmax(0, 680px); }
  .diagram-panel { position: static; grid-row: auto; order: -1; }
  .diagram-panel img, .diagram-panel svg { max-height: 38vh; }
}
@media (max-width: 520px) {
  .quiz-layout { padding: 20px 12px 30px; }
  .hint-button { min-height: 44px; }
  .option-button { padding: 12px; }
}
`;

export const QUIZ_FRONT_TEMPLATE = `<div class="quiz-layout">
  <main class="quiz-panel">
    <div class="question-text" id="question-text"></div>
    <div class="hint-container" id="hint-container">
      <button class="hint-button" id="hint-toggle" type="button" aria-expanded="false" aria-controls="hint-text">
        <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M9 18h6M10 22h4"/><path d="M8.3 14.5a7 7 0 1 1 7.4 0c-.5.4-.7.9-.7 1.5H9c0-.6-.2-1.1-.7-1.5Z"/></svg>
        Show hint
      </button>
      <div class="hint-text" id="hint-text" hidden></div>
    </div>
    <div class="options-list" id="front-options"></div>
  </main>
</div>
<div id="raw-data" hidden>
  <div id="raw-question">{{Question}}</div>
  <div id="raw-hint">{{Hint}}</div>
  <div class="raw-option" data-letter="A"><span class="raw-option-text">{{Option1}}</span><span class="raw-option-flag">{{Flag1}}</span><span class="raw-option-rationale">{{Rationale1}}</span></div>
  <div class="raw-option" data-letter="B"><span class="raw-option-text">{{Option2}}</span><span class="raw-option-flag">{{Flag2}}</span><span class="raw-option-rationale">{{Rationale2}}</span></div>
  <div class="raw-option" data-letter="C"><span class="raw-option-text">{{Option3}}</span><span class="raw-option-flag">{{Flag3}}</span><span class="raw-option-rationale">{{Rationale3}}</span></div>
  <div class="raw-option" data-letter="D"><span class="raw-option-text">{{Option4}}</span><span class="raw-option-flag">{{Flag4}}</span><span class="raw-option-rationale">{{Rationale4}}</span></div>
</div>
<script>
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
  function isTrue(value) {
    return /^(true|yes|1)$/i.test(String(value || "").trim());
  }

  var question = document.getElementById("question-text");
  var hint = document.getElementById("hint-text");
  var rawQuestion = document.getElementById("raw-question");
  var rawHint = document.getElementById("raw-hint");
  question.innerHTML = cleanMath(rawQuestion.innerHTML);

  var hintMarkup = rawHint.innerHTML.trim();
  var hintContainer = document.getElementById("hint-container");
  var hintToggle = document.getElementById("hint-toggle");
  if (hintMarkup) {
    hint.innerHTML = cleanMath(hintMarkup);
    hintToggle.addEventListener("click", function () {
      var opening = hint.hidden;
      hint.hidden = !opening;
      hintToggle.setAttribute("aria-expanded", String(opening));
      hintToggle.lastChild.textContent = opening ? " Hide hint" : " Show hint";
      if (opening) typeset([hint]);
    });
  } else {
    hintContainer.hidden = true;
  }

  var list = document.getElementById("front-options");
  document.querySelectorAll("#raw-data .raw-option").forEach(function (item) {
    var rawText = item.querySelector(".raw-option-text").innerHTML.trim();
    var rawRationale = item.querySelector(".raw-option-rationale").innerHTML.trim();
    if (!rawText) return;

    var correct = isTrue(item.querySelector(".raw-option-flag").textContent);
    var button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    button.setAttribute("aria-pressed", "false");
    button.innerHTML = '<span class="option-content"><span class="option-letter"></span><span class="option-text"></span></span><span class="feedback" hidden><span class="feedback-title"></span><span class="rationale-text"></span></span>';
    button.querySelector(".option-letter").textContent = item.dataset.letter;
    button.querySelector(".option-text").innerHTML = cleanMath(rawText);
    button.querySelector(".feedback-title").textContent = correct ? "Correct" : "Not quite";
    button.querySelector(".rationale-text").innerHTML = cleanMath(
      rawRationale || (correct ? "This is the correct answer." : "This option is not correct.")
    );

    button.addEventListener("click", function () {
      list.querySelectorAll(".option-button").forEach(function (option) {
        option.classList.remove("is-correct", "is-wrong");
        option.setAttribute("aria-pressed", "false");
        option.querySelector(".feedback").hidden = true;
      });
      button.classList.add(correct ? "is-correct" : "is-wrong");
      button.setAttribute("aria-pressed", "true");
      var feedback = button.querySelector(".feedback");
      feedback.hidden = false;
      typeset([feedback]);
    });
    list.appendChild(button);
  });

  setTimeout(function () { typeset([question, list]); }, 80);
})();
<\/script>`;

export const QUIZ_BACK_TEMPLATE = `{{FrontSide}}
<div id="back-data" hidden>
  <span class="back-flag">{{Flag1}}</span>
  <span class="back-flag">{{Flag2}}</span>
  <span class="back-flag">{{Flag3}}</span>
  <span class="back-flag">{{Flag4}}</span>
  <span id="diagram-data">{{ArchDiagram}}</span>
</div>
<script>
(function () {
  function isTrue(value) {
    return /^(true|yes|1)$/i.test(String(value || "").trim());
  }
  function typeset(elements) {
    if (typeof MathJax === "undefined") return;
    if (MathJax.typesetPromise) MathJax.typesetPromise(elements).catch(function () {});
    else if (MathJax.Hub) MathJax.Hub.Queue(["Typeset", MathJax.Hub, document.body]);
  }

  var card = document.querySelector(".card");
  if (card) card.classList.add("back");
  var buttons = Array.from(document.querySelectorAll("#front-options .option-button"));
  document.querySelectorAll("#back-data .back-flag").forEach(function (flag, index) {
    var button = buttons[index];
    if (!button) return;
    var correct = isTrue(flag.textContent);
    button.classList.remove("is-wrong");
    button.classList.toggle("is-correct", correct);
    button.classList.toggle("is-dimmed", !correct);
    button.setAttribute("aria-disabled", "true");
    button.tabIndex = -1;
    var feedback = button.querySelector(".feedback");
    if (feedback) feedback.hidden = false;
  });

  var diagramData = document.getElementById("diagram-data");
  var hasDiagram = diagramData && (
    diagramData.textContent.trim() || diagramData.querySelector("img, svg, picture, canvas")
  );
  if (hasDiagram) {
    var layout = document.querySelector(".quiz-layout");
    var panel = document.createElement("aside");
    panel.className = "diagram-panel";
    panel.setAttribute("aria-label", "Question diagram");
    panel.innerHTML = diagramData.innerHTML;
    layout.classList.add("has-diagram");
    layout.appendChild(panel);
  }
  setTimeout(function () { typeset([document.body]); }, 80);
})();
<\/script>`;

export function getQuizModel() {
  return {
    name: QUIZ_MODEL_NAME,
    id: QUIZ_MODEL_ID.toString(),
    flds: QUIZ_FIELDS,
    req: [[0, "all", [0]]],
    tmpls: [{
      name: "Quiz Card",
      qfmt: QUIZ_FRONT_TEMPLATE,
      afmt: QUIZ_BACK_TEMPLATE
    }],
    css: QUIZ_STYLING
  };
}
