<div align="center">

# ✋ SignSense

### Real-time American Sign Language Translator — Built for the Browser

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Visit_App-7c3aed?style=for-the-badge)](https://YOUR_USERNAME.github.io/Sign_Language_Translator)
[![License: MIT](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![PRs Welcome](https://img.shields.io/badge/PRs-Welcome-brightgreen?style=for-the-badge)](CONTRIBUTING.md)
[![Made with JS](https://img.shields.io/badge/Made_with-Vanilla_JS-f7df1e?style=for-the-badge&logo=javascript&logoColor=black)](https://developer.mozilla.org/en-US/docs/Web/JavaScript)
[![PWA Ready](https://img.shields.io/badge/PWA-Ready-5a0fc8?style=for-the-badge&logo=googlechrome&logoColor=white)](https://web.dev/progressive-web-apps/)

<br/>

**SignSense** is a privacy-first, zero-install, real-time ASL translator that runs entirely inside your browser.  
Point your webcam at your hand. Watch ASL become text — instantly.

<br/>

</div>

---

## 📸 Overview

SignSense uses your device's camera to detect hand landmarks in real time, classify them against the full ASL alphabet, number system, and common words — then streams the output as natural English. No server. No data upload. No accounts. No installs. Just open the URL and start signing.

---

## ✨ Features

| Feature | Description |
|---|---|
| 🤚 **Real-Time ASL Recognition** | Translates the full A–Z alphabet, numbers 0–9, and 10 common words live via webcam |
| 🎯 **Hold-to-Confirm** | Animated ring UI locks in a sign only after you hold it steady — prevents accidental inputs |
| 🧠 **NLP Sentence Polish** | Raw sign sequences are auto-corrected into grammatical English sentences |
| 🔊 **Text-to-Speech** | Every confirmed word is read aloud using the Web Speech API |
| 🎮 **Gamified Tutorial** | Step-by-step guided practice mode with XP, streaks, and live gesture feedback |
| 🎨 **4 UI Themes** | Dark, Light, Ocean, and High-Contrast — all switchable on the fly |
| 📱 **Progressive Web App** | Install directly to your home screen. Works offline. |
| 🔒 **100% Private** | Your webcam feed never leaves your device. Zero telemetry. |

---

## 🏗️ Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                          SignSense App                           │
│                                                                  │
│  ┌─────────────┐    ┌──────────────┐    ┌────────────────────┐  │
│  │   engine.js │    │ classifier.js│    │    smoother.js     │  │
│  │             │───▶│              │───▶│                    │  │
│  │  MediaPipe  │    │ Rule-Based   │    │ Temporal Smoothing │  │
│  │  21 Lmks    │    │ Heuristics   │    │ Exponential Decay  │  │
│  │  (60fps)    │    │ (A-Z + 0-9)  │    │ Hysteresis Gate    │  │
│  └─────────────┘    └──────────────┘    └────────────────────┘  │
│         │                                         │              │
│         ▼                                         ▼              │
│  ┌─────────────┐                       ┌────────────────────┐   │
│  │   Canvas    │                       │      app.js        │   │
│  │  Skeleton   │                       │   NLP · TTS · UI   │   │
│  │  Overlay    │                       │  Hold-Ring Timer   │   │
│  └─────────────┘                       └────────────────────┘   │
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │ suggestions  │  │  analytics   │  │     storage.js     │    │
│  │    .js       │  │     .js      │  │  Session History   │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🧠 How It Works

### 1. Hand Detection — `engine.js`
Uses **Google's MediaPipe Hands** model (loaded via CDN) to extract **21 3D hand landmarks** at up to 60 frames per second. The landmarks are drawn as a skeletal overlay on a `<canvas>` element overlaid on the live webcam feed.

### 2. Classification — `classifier.js`
A purely rule-based classifier built on geometric analysis of the 21 landmark coordinates:
- **`normalize(lm)`** — Translates landmarks to wrist-origin, scaled by wrist→middle-MCP distance. Makes classification invariant to hand size and camera distance.
- **`fingerExtensions(lm)`** — Derives boolean extension state `[thumb, index, middle, ring, pinky]` using tip-to-PIP comparisons.
- **`fingerCurl(lm)`** — Computes curl `[0=straight, 1=curled]` for each finger using the ratio of tip-to-MCP distance vs the sum of segment lengths.
- **`tipsTouching(lm, a, b)`** — Checks if two landmark tips are within a Euclidean threshold.
- A **score() function** computes what fraction of a set of geometric conditions are met, producing a `0–1` confidence per sign.

### 3. Temporal Smoothing — `smoother.js`
Raw per-frame predictions are inherently jittery. The `PredictionSmoother` class applies a 12-frame rolling window with:
- **Exponential decay weighting** — more recent frames carry higher vote weight (`base^(i/n)`)
- **Hysteresis** — a competing sign must *lead the current one by ≥ 0.18* before the output switches, preventing flicker
- **Minimum confidence gate** — suppresses low-confidence frames entirely

### 4. Output Pipeline — `app.js`
- A **hold-ring UI** (animated SVG stroke-dashoffset) requires a sign to be held for ~1.2s before committing it
- Raw committed signs are buffered, then passed through an **NLP polishing** layer that corrects grammar
- Final output is piped to the **Web Speech API** for text-to-speech

---

## 🛠️ Tech Stack

| Layer | Technology |
|---|---|
| **Language** | Vanilla HTML5 · CSS3 · JavaScript (ES Modules) |
| **AI / Computer Vision** | [MediaPipe Hands](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker) |
| **Audio** | Web Speech API (TTS) · Web Audio API (sound effects) |
| **Storage** | localStorage (session history, user preferences) |
| **PWA** | Service Worker · Web Manifest |
| **Hosting** | GitHub Pages (static) |

> **Zero dependencies.** No npm packages, no bundlers, no build step required.

---

## 🚀 Getting Started

### Option 1 — Live Web App (Recommended)
Click the **Live Demo** badge at the top of this page. Requires a browser with webcam access (Chrome or Edge recommended).

### Option 2 — Run Locally (Windows)
```bat
# Double-click this file to launch instantly:
Start_SignSense.bat
```

### Option 3 — Run Locally (Any OS)
```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/Sign_Language_Translator.git
cd Sign_Language_Translator

# Start a local server (requires Node.js)
npx serve .

# Or use Python
python -m http.server 8080
```
Then open `http://localhost:8080` in your browser.

> ⚠️ **Important:** You must serve the app over HTTP (not open the file directly). Browsers block webcam access on `file://` URLs due to security policies.

---

## 📁 Project Structure

```
Sign_Language_Translator/
│
├── index.html              # App shell — single-page layout
├── app.js                  # Core app logic: hold-ring, NLP, TTS, event wiring
├── style.css               # All styling: themes, glassmorphism, animations
├── sw.js                   # Service Worker for PWA offline support
├── manifest.json           # PWA manifest (icons, shortcuts, theme colors)
│
├── js/
│   ├── engine.js           # MediaPipe hand tracking & canvas rendering
│   ├── classifier.js       # Rule-based ASL gesture classifier (21 landmarks)
│   ├── smoother.js         # Temporal prediction smoother (exp. decay + hysteresis)
│   ├── suggestions.js      # Word suggestions engine
│   ├── analytics.js        # In-session analytics & usage tracking
│   └── storage.js          # LocalStorage wrapper for history & preferences
│
└── Start_SignSense.bat     # One-click Windows launcher
```

---

## 🌍 Browser Support

| Browser | Status |
|---|---|
| Chrome 90+ | ✅ Fully Supported |
| Edge 90+ | ✅ Fully Supported |
| Firefox 110+ | ⚠️ Supported (some MediaPipe caveats) |
| Safari 16+ | ⚠️ Supported (webcam permission flow differs) |
| Mobile Chrome | ✅ Supported (front camera) |

---

## 🤝 Contributing

Contributions are warmly welcome! Here are some great ideas to work on:

- 🌐 **More languages** — BSL (British), LSE (Spanish), ISL (Indian) sign dictionaries
- 🤖 **ML-based classifier** — Replace heuristics with a trained TensorFlow.js model
- 📝 **More ASL words** — Expand beyond the current 10 common phrases
- ♿ **Accessibility** — Keyboard navigation, screen reader improvements
- 📊 **Progress tracking** — Persistent XP and learning streaks

### How to Contribute
1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Commit your changes: `git commit -m "feat: add my feature"`
4. Push and open a Pull Request

---

## 📄 License

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

Built with ❤️ for accessibility and open communication.

*If SignSense helped you, consider giving it a ⭐ — it helps others find it!*

</div>
