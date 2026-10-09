## Browser extension
Browser extension to download while browsing on 

# 📖 Scan Manga Image Downloader

A lightweight Chrome extension that allows you to quickly download manga chapter images directly from supported scan websites.

## ✨ Features

- 📥 Download all images from the current manga chapter page
- ⚡ Fast and simple one-click operation
- 🖼️ Preserves original image quality
- 🌐 Works directly from your browser
- 🎯 Lightweight and easy to install
- 🔒 No external dependencies required

## 📂 Project Structure

```text
Image Downloader/
├── icons/
├── background.js
├── manifest.json
├── popup.html
├── popup.css
├── popup.js
└── Readme
```

### Files Overview

| File | Description |
|--------|-------------|
| `manifest.json` | Extension configuration and permissions |
| `background.js` | Background service worker handling downloads |
| `popup.html` | Extension popup interface |
| `popup.css` | Popup styling |
| `popup.js` | Popup logic and user interactions |
| `icons/` | Extension icons |

## 🚀 Installation

### Load the Extension Manually

1. Clone the repository:

```bash
git clone https://github.com/Tipez/Scan-Manga-Image-Downloader.git
```

2. Open Chrome or any Chromium-based browser.

3. Navigate to:

```text
chrome://extensions/
```

4. Enable **Developer Mode**.

5. Click **Load unpacked**.

6. Select the folder:

```text
Scan-Manga-Image-Downloader/Image Downloader
```

7. The extension is now installed and ready to use.

## 📋 Usage

1. Open a supported manga chapter page eg :
   - https://www.scan-manga.com/
   - https://fmteam.fr/
2. Click the extension icon.
3. Press the start download button.
4. The extension will automatically detect and download chapter images. Navigate forward or backward once to start the trigeering event
5. Stop the extension

Downloaded files will be saved to your browser's default download location.
