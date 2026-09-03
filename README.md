# Notebook2Anki

**Notebook2Anki** is a Chrome extension that exports **Quizzes** and **Flashcards** from [Gemini Notebook](https://notebook.google.com/) (formerly NotebookLM) directly to [Anki](https://apps.ankiweb.net/).

## Features

- 📚 **Quiz Support**: Export multiple-choice questions with hints, options, and rationales
- 🗂️ **Flashcard Support**: Export simple front/back flashcards
- ⚡ **AnkiConnect Integration**: Send cards directly to Anki (requires Anki open)
- 📦 **APKG Export**: Download as `.apkg` file (works offline, import anywhere)
- 📄 **CSV Export**: Export as CSV for manual import or other tools
- 🔢 **LaTeX/Math Support**: Cards render mathematical notation via MathJax
- 🎨 **Beautiful Dark Theme**: Matching Gemini Notebook's aesthetic
- 🔘 **UI Button Injection**: Export button appears directly in Gemini Notebook

## Installation

### From Source (Developer Mode)

1. Clone or download this repository
2. Open Chrome and go to `chrome://extensions/`
3. Enable "Developer mode" (toggle in top right)
4. Click "Load unpacked"
5. Select the `Notebook2Anki` folder

### From Chrome Web Store

*Coming soon*

## Usage

### Method 1: Popup Menu (Recommended)

1. Navigate to a notebook in [Gemini Notebook](https://notebook.google.com/)
2. Generate a Quiz or Flashcards using Gemini Notebook's features
3. Click the extension icon in Chrome toolbar
4. Choose your export method:
   - **Send to Anki**: Requires Anki desktop open with [AnkiConnect](https://ankiweb.net/shared/info/2055492159)
   - **Download .apkg**: Creates a portable Anki package file
   - **Export CSV**: Creates CSV files for quizzes and/or flashcards

### Method 2: Injected Button

1. When viewing quiz/flashcard content in Gemini Notebook, an "Anki Export" button appears
2. Click the button to send directly to Anki via AnkiConnect

## Requirements

### For AnkiConnect Export
- [Anki Desktop](https://apps.ankiweb.net/) installed and running
- [AnkiConnect](https://ankiweb.net/shared/info/2055492159) add-on installed

### For APKG/CSV Export
- No additional requirements (works in browser)

## Anki Note Types

The extension creates two note types in Anki:

### NotebookLM Quiz
15 fields for multiple-choice questions:
- Question, Hint, ArchDiagram (for images)
- Option1-4, Flag1-4 (True/False), Rationale1-4

### NotebookLM Flashcard
2 fields for simple flashcards:
- Front, Back

Both include dark theme styling and MathJax support.

## Export Formats

### AnkiConnect
- Creates deck under `NotebookLM::` parent deck
- Creates note types automatically if missing
- Best for direct integration

### APKG File
- Portable Anki package
- Import on any device (desktop, mobile, AnkiWeb)
- No Anki instance required during export

### CSV
- Universal format
- Can import into Anki, Quizlet, or other tools
- Separate files for quizzes and flashcards

## Project Structure

```
Notebook2Anki/
├── manifest.json           # Chrome extension manifest
├── src/
│   ├── background/         # Service worker for AnkiConnect
│   ├── content/            # Content scripts for UI injection
│   ├── popup/              # Extension popup UI
│   ├── lib/                # Shared utilities
│   └── templates/          # Anki card templates
├── vendor/                 # Third-party libraries
│   ├── sql.js              # SQLite in browser
│   ├── jszip.min.js        # ZIP creation
│   ├── FileSaver.min.js    # File downloads
│   └── genanki.js          # Anki deck generation
└── icons/                  # Extension icons
```

## Development

### Building
No build step required. Load the extension directly in developer mode.

### Testing
1. Load extension in Chrome
2. Navigate to Gemini Notebook
3. Create quizzes/flashcards
4. Test each export method

## Credits

This project integrates functionality from:
- [notebooklm-anki-extension](https://github.com/searchswapnil-prog/notebooklm-anki-extension): Quiz export with AnkiConnect
- [flashcardConverter](https://github.com/Sahal03/flashcardConverter): Flashcard extraction and APKG generation

### Libraries Used
- [sql.js](https://github.com/sql-js/sql.js): SQLite compiled to WebAssembly
- [JSZip](https://stuk.github.io/jszip/): ZIP file creation
- [FileSaver.js](https://github.com/eligrey/FileSaver.js/): File downloads
- [genanki-js](https://github.com/krmanik/genanki-js): Anki deck generation

## License

MIT License

## Contributing

Contributions welcome! Please open an issue or pull request.

## Troubleshooting

### "Anki Not Found"
- Make sure Anki Desktop is open
- Verify AnkiConnect is installed: Tools → Add-ons → Check for "AnkiConnect"
- AnkiConnect uses port 8765 by default

### "0 Cards Added"
- The note type might have field mismatches
- Try deleting and recreating the note type in Anki
- Or use APKG export which creates fresh note types

### No content found
- Make sure you've generated a Quiz or Flashcards in Gemini Notebook first
- Refresh the page and try again
- Some notebooks may have different data structures

### Math not rendering
- Make sure MathJax is configured in Anki
- Cards use `\(...\)` for inline math and `\[...\]` for display math
