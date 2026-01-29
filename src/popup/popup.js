// NotebookLM2Anki - Popup Script
// Handles popup UI interactions and export actions

document.addEventListener('DOMContentLoaded', async () => {
  // Set version from manifest
  const manifest = chrome.runtime.getManifest();
  const versionDisplay = document.getElementById('version-display');
  if (versionDisplay) {
    versionDisplay.textContent = `v${manifest.version}`;
  }

  // DOM Elements
  const statusIndicator = document.getElementById('status-indicator');
  const statusText = document.getElementById('status-text');
  const quizCount = document.getElementById('quiz-count');
  const flashcardCount = document.getElementById('flashcard-count');
  const contentInfo = document.getElementById('content-info');
  const noContent = document.getElementById('no-content');
  const deckNameInput = document.getElementById('deck-name');
  const messageEl = document.getElementById('message');
  
  // Buttons
  const btnAnkiConnect = document.getElementById('btn-anki-connect');
  const btnApkg = document.getElementById('btn-apkg');
  const btnCsvAll = document.getElementById('btn-csv-all');
  const btnCsvDropdown = document.getElementById('btn-csv-dropdown');
  const csvMenu = document.getElementById('csv-menu');
  const btnCsvQuizzes = document.getElementById('btn-csv-quizzes');
  const btnCsvFlashcards = document.getElementById('btn-csv-flashcards');
  const btnCsvHeaderless = document.getElementById('btn-csv-all-headerless');
  const btnCsvQuizAsFlashcard = document.getElementById('btn-csv-quiz-as-flashcard');

  const deckPreview = document.getElementById('deck-preview');
  const previewQuiz = document.getElementById('preview-quiz');
  const previewFlashcard = document.getElementById('preview-flashcard');

  // State
  let extractedData = null;
  let ankiConnected = false;

  // ==================== INITIALIZATION ====================
  
  // Check AnkiConnect status
  checkAnkiStatus();
  
  // Extract data from current page
  extractDataFromPage();

  // ==================== ANKI STATUS ====================
  
  async function checkAnkiStatus() {
    try {
      const response = await chrome.runtime.sendMessage({ action: 'checkAnki' });
      if (response && response.connected) {
        ankiConnected = true;
        statusIndicator.className = 'status connected';
        statusText.textContent = 'Anki Connected';
      } else {
        ankiConnected = false;
        statusIndicator.className = 'status disconnected';
        statusText.textContent = 'Anki Not Found';
      }
    } catch (error) {
      ankiConnected = false;
      statusIndicator.className = 'status disconnected';
      statusText.textContent = 'Connection Error';
    }
    updateButtonStates();
  }

  // ==================== DATA EXTRACTION ====================
  
  async function extractDataFromPage() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      
      if (!tab.url.includes('notebooklm.google.com')) {
        showNoContent();
        return;
      }

      // Execute extraction script in all frames
      const results = await chrome.scripting.executeScript({
        target: { tabId: tab.id, allFrames: true },
        func: extractFromPageContext
      });

      // Find the result with data
      for (const result of results) {
        if (result.result && (result.result.quizzes?.length > 0 || result.result.flashcards?.length > 0)) {
          extractedData = result.result;
          break;
        }
      }

      if (extractedData) {
        updateContentDisplay();
      } else {
        showNoContent();
      }
    } catch (error) {
      console.error('[NotebookLM2Anki] Extraction error:', error);
      showNoContent();
    }
  }

  function extractFromPageContext() {
    const appRoot = document.querySelector('[data-app-data]');
    if (!appRoot) return null;
    
    const jsonString = appRoot.getAttribute('data-app-data');
    if (!jsonString) return null;
    
    try {
      // Unescape HTML entities
      const cleanJson = jsonString
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'");
      
      const data = JSON.parse(cleanJson);
      
      // Extract title
      let title = data.title || 'Unknown Notebook';
      const titleInput = document.querySelector('input[placeholder="Notebook title"]');
      if (titleInput && titleInput.value) {
        title = titleInput.value.trim();
      }
      title = title.replace(/::/g, ' - ').trim();
      
      // Extract quizzes
      const quizData = data.quiz || (data.mostRecentQuery && data.mostRecentQuery.quiz) || [];
      const quizzes = Array.isArray(quizData) ? quizData.map(q => ({
        type: 'quiz',
        question: q.question || '',
        hint: q.hint || '',
        options: (q.answerOptions || []).map(opt => ({
          text: opt.text || '',
          isCorrect: !!opt.isCorrect,
          rationale: opt.rationale || ''
        }))
      })) : [];
      
      // Extract flashcards
      const flashcardData = data.flashcards || [];
      const flashcards = Array.isArray(flashcardData) ? flashcardData.map(card => ({
        type: 'flashcard',
        front: card.f || '',
        back: card.b || ''
      })) : [];
      
      return { title, quizzes, flashcards };
    } catch (e) {
      console.error('Parse error:', e);
      return null;
    }
  }

  function updateContentDisplay() {
    const numQuizzes = extractedData.quizzes?.length || 0;
    const numFlashcards = extractedData.flashcards?.length || 0;
    
    quizCount.textContent = `${numQuizzes} Quiz Question${numQuizzes !== 1 ? 's' : ''}`;
    flashcardCount.textContent = `${numFlashcards} Flashcard${numFlashcards !== 1 ? 's' : ''}`;
    
    deckNameInput.value = extractedData.title || '';
    
    contentInfo.classList.remove('hidden');
    noContent.classList.add('hidden');
    
    updateDeckPreview();
    updateButtonStates();
  }

  function showNoContent() {
    contentInfo.classList.add('hidden');
    noContent.classList.remove('hidden');
    updateButtonStates();
  }

  function updateButtonStates() {
    const hasContent = extractedData && 
      ((extractedData.quizzes?.length || 0) > 0 || (extractedData.flashcards?.length || 0) > 0);
    
    btnAnkiConnect.disabled = !hasContent || !ankiConnected;
    btnApkg.disabled = !hasContent;
    btnCsvAll.disabled = !hasContent;
    btnCsvDropdown.disabled = !hasContent;
  }

  // ==================== EXPORT FUNCTIONS ====================
  
  function getDeckName() {
    return deckNameInput.value.trim() || extractedData?.title || 'NotebookLM Export';
  }

  function updateDeckPreview() {
    const baseName = getDeckName();
    const hasQuizzes = extractedData?.quizzes?.length > 0;
    const hasFlashcards = extractedData?.flashcards?.length > 0;
    
    if (!hasQuizzes && !hasFlashcards) {
      deckPreview.classList.add('hidden');
      return;
    }
    
    deckPreview.classList.remove('hidden');
    
    if (hasQuizzes) {
      previewQuiz.classList.remove('hidden');
      previewQuiz.querySelector('.preview-name').textContent = `${baseName} - Quiz`;
    } else {
      previewQuiz.classList.add('hidden');
    }
    
    if (hasFlashcards) {
      previewFlashcard.classList.remove('hidden');
      previewFlashcard.querySelector('.preview-name').textContent = `${baseName} - Flashcard`;
    } else {
      previewFlashcard.classList.add('hidden');
    }
  }

  deckNameInput.addEventListener('input', updateDeckPreview);

  function showMessage(text, type = 'info') {
    messageEl.textContent = text;
    messageEl.className = `message ${type}`;
    messageEl.classList.remove('hidden');
    
    setTimeout(() => {
      messageEl.classList.add('hidden');
    }, 5000);
  }

  // Send to AnkiConnect
  btnAnkiConnect.addEventListener('click', async () => {
    if (!extractedData) return;
    
    btnAnkiConnect.disabled = true;
    btnAnkiConnect.classList.add('loading');
    
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'sendToAnki',
        data: extractedData,
        deckName: getDeckName(),
        type: 'all'
      });
      
      if (response && response.success) {
        btnAnkiConnect.classList.add('success');
        let message = `Sent ${response.count} cards to Anki!`;
        if (response.skipped > 0) {
          message += ` Skipped ${response.skipped} duplicates.`;
        }
        showMessage(message, 'success');
        setTimeout(() => btnAnkiConnect.classList.remove('success'), 2000);
      } else {
        btnAnkiConnect.classList.add('error');
        showMessage(response?.error || 'Failed to send to Anki', 'error');
        setTimeout(() => btnAnkiConnect.classList.remove('error'), 2000);
      }
    } catch (error) {
      btnAnkiConnect.classList.add('error');
      showMessage(error.message, 'error');
      setTimeout(() => btnAnkiConnect.classList.remove('error'), 2000);
    } finally {
      btnAnkiConnect.disabled = false;
      btnAnkiConnect.classList.remove('loading');
      updateButtonStates();
    }
  });

  // Download APKG
  btnApkg.addEventListener('click', async () => {
    if (!extractedData) return;
    
    btnApkg.disabled = true;
    btnApkg.classList.add('loading');
    
    try {
      const deckName = getDeckName();
      
      const response = await chrome.runtime.sendMessage({
        action: 'generateApkg',
        data: extractedData,
        deckName: deckName
      });
      
      if (response && response.success) {
        btnApkg.classList.add('success');
        showMessage(`Downloaded ${deckName}.apkg`, 'success');
        setTimeout(() => btnApkg.classList.remove('success'), 2000);
      } else {
        btnApkg.classList.add('error');
        showMessage(response?.error || 'Failed to generate APKG', 'error');
        setTimeout(() => btnApkg.classList.remove('error'), 2000);
      }
    } catch (error) {
      console.error('[NotebookLM2Anki] APKG error:', error);
      btnApkg.classList.add('error');
      showMessage(error.message, 'error');
      setTimeout(() => btnApkg.classList.remove('error'), 2000);
    } finally {
      btnApkg.disabled = false;
      btnApkg.classList.remove('loading');
      updateButtonStates();
    }
  });

  // CSV Export Functions
  function exportCSV(type, includeHeader = true) {
    if (!extractedData) return;
    
    const deckName = getDeckName().replace(/[^a-z0-9]/gi, '_');
    
    if (type === 'quizzes' || type === 'all') {
      if (extractedData.quizzes?.length > 0) {
        const csv = quizzesToCSV(extractedData.quizzes, includeHeader);
        downloadCSV(csv, `${deckName}-quizzes.csv`);
      }
    }
    
    if (type === 'flashcards' || type === 'all') {
      if (extractedData.flashcards?.length > 0) {
        const csv = flashcardsToCSV(extractedData.flashcards, includeHeader);
        downloadCSV(csv, `${deckName}-flashcards.csv`);
      }
    }
    
    showMessage('CSV downloaded!', 'success');
  }

  function quizzesToCSV(quizzes, includeHeader) {
    const headers = ['Question', 'Hint', 'Option1', 'Flag1', 'Rationale1', 'Option2', 'Flag2', 'Rationale2', 'Option3', 'Flag3', 'Rationale3', 'Option4', 'Flag4', 'Rationale4'];
    let csv = includeHeader ? headers.join(',') + '\n' : '';
    
    for (const quiz of quizzes) {
      const options = quiz.options || [];
      const row = [
        escapeCSV(quiz.question),
        escapeCSV(quiz.hint || ''),
        escapeCSV(options[0]?.text || ''),
        escapeCSV(options[0]?.isCorrect ? 'True' : 'False'),
        escapeCSV(options[0]?.rationale || ''),
        escapeCSV(options[1]?.text || ''),
        escapeCSV(options[1]?.isCorrect ? 'True' : 'False'),
        escapeCSV(options[1]?.rationale || ''),
        escapeCSV(options[2]?.text || ''),
        escapeCSV(options[2]?.isCorrect ? 'True' : 'False'),
        escapeCSV(options[2]?.rationale || ''),
        escapeCSV(options[3]?.text || ''),
        escapeCSV(options[3]?.isCorrect ? 'True' : 'False'),
        escapeCSV(options[3]?.rationale || '')
      ];
      csv += row.join(',') + '\n';
    }
    
    return csv;
  }

  function flashcardsToCSV(flashcards, includeHeader) {
    let csv = includeHeader ? 'Front,Back\n' : '';
    
    for (const card of flashcards) {
      csv += `${escapeCSV(card.front)},${escapeCSV(card.back)}\n`;
    }
    
    return csv;
  }

  function quizToFlashcardCSV(quizzes, includeHeader) {
    let csv = includeHeader ? 'Front,Back\n' : '';
    
    for (const quiz of quizzes) {
      const question = quiz.question || '';
      const options = quiz.options || [];
      const correctOption = options.find(opt => opt.isCorrect);
      const answer = correctOption ? correctOption.text : '';
      
      if (question && answer) {
        csv += `${escapeCSV(question)},${escapeCSV(answer)}\n`;
      }
    }
    
    return csv;
  }

  function exportQuizAsFlashcard() {
    if (!extractedData) return;
    
    const deckName = getDeckName().replace(/[^a-z0-9]/gi, '_');
    
    if (extractedData.quizzes?.length > 0) {
      const csv = quizToFlashcardCSV(extractedData.quizzes, true);
      downloadCSV(csv, `${deckName}-quiz-as-flashcard.csv`);
      showMessage('Quiz exported as flashcards!', 'success');
    } else {
      showMessage('No quizzes found to convert', 'error');
    }
  }

  function escapeCSV(value) {
    if (!value) return '""';
    const escaped = String(value).replace(/"/g, '""');
    return `"${escaped}"`;
  }

  function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  // CSV button event listeners
  btnCsvAll.addEventListener('click', () => exportCSV('all', true));
  
  btnCsvDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
    csvMenu.classList.toggle('hidden');
    btnCsvDropdown.classList.toggle('active');
  });
  
  btnCsvQuizzes.addEventListener('click', () => {
    exportCSV('quizzes', true);
    csvMenu.classList.add('hidden');
  });
  
  btnCsvFlashcards.addEventListener('click', () => {
    exportCSV('flashcards', true);
    csvMenu.classList.add('hidden');
  });
  
  btnCsvHeaderless.addEventListener('click', () => {
    exportCSV('all', false);
    csvMenu.classList.add('hidden');
  });

  btnCsvQuizAsFlashcard.addEventListener('click', () => {
    exportQuizAsFlashcard();
    csvMenu.classList.add('hidden');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', () => {
    csvMenu.classList.add('hidden');
    btnCsvDropdown.classList.remove('active');
  });
});
