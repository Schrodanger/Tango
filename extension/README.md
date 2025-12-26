# LinkedIn Tango Puzzle Solver - Chrome Extension

A Chrome extension that automatically solves LinkedIn Tango puzzles!

## 🎯 Features

- **Auto-detect** Tango puzzles on LinkedIn
- **One-click solve** - fills in the solution automatically
- **Floating button** appears on puzzle pages
- **Popup interface** for manual control

## 📦 Installation

### Step 1: Open Chrome Extensions
1. Open Google Chrome
2. Go to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)

### Step 2: Load the Extension
1. Click **"Load unpacked"**
2. Navigate to: `c:\Users\souravsharma\Desktop\projects\Tango\extension`
3. Select the folder and click "Select Folder"

### Step 3: Done!
The extension icon should appear in your Chrome toolbar.

## 🎮 How to Use

### Method 1: Floating Button
1. Go to LinkedIn and open a Tango puzzle
2. A **"🧩 Solve Tango"** button appears in the bottom-right
3. Click it to auto-solve!

### Method 2: Extension Popup
1. Click the extension icon in Chrome toolbar
2. Click **"Read Puzzle"** to scan the current puzzle
3. Click **"Solve & Fill"** to automatically fill the solution

## 🧩 How It Works

The solver uses a **backtracking algorithm** that:
1. Reads the current grid state (filled suns/moons)
2. Identifies constraints (= and ×)
3. Solves using rules:
   - Each row/column has exactly 3 suns and 3 moons
   - No more than 2 consecutive same symbols
   - Respects = (same) and × (opposite) constraints
4. Clicks cells to fill in the solution

## ⚠️ Troubleshooting

**"No puzzle found"**
- Make sure you're on the LinkedIn Tango puzzle page
- The puzzle grid should be visible on screen

**Doesn't click cells correctly**
- LinkedIn may have updated their DOM structure
- Try refreshing the page

**Extension not working**
- Check if Developer mode is enabled
- Try reloading the extension

## 📁 Files

```
extension/
├── manifest.json      # Extension configuration
├── popup.html         # Popup UI
├── popup.js           # Popup logic
├── content.js         # Page injection script
├── content.css        # Floating button styles
├── icon16.png         # Toolbar icon
├── icon48.png         # Extension icon
└── icon128.png        # Large icon
```

## 🔧 Development

To modify the solver:
1. Edit `content.js` or `popup.js`
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension
4. Reload the LinkedIn page

Enjoy solving Tango puzzles instantly! 🎉
