# SignSense ✋

SignSense is a sleek, real-time American Sign Language (ASL) translator built right into the browser. I built this to bridge the communication gap using AI, allowing anyone to translate hand gestures into text instantly without needing special hardware or clunky installations.

Everything runs entirely locally in your browser to maintain privacy. The app leverages MediaPipe for lightning-fast hand tracking and some custom smoothing logic to make sure the predictions are stable and accurate.

## ✨ Features
* **Real-Time Translation**: Translates ASL letters (A-Z), numbers, and common words on the fly using your webcam.
* **Interactive Tutorial Mode**: Built-in gamified practice modes with live feedback and XP to help beginners learn ASL step-by-step.
* **Hold-to-Confirm**: An intuitive hold-ring animation that confirms signs once you hold them steady.
* **NLP Polishing**: Automatically cleans up raw ASL signs (which don't use strict English grammar) into natural-sounding English sentences.
* **Smart UI & Theming**: Includes Dark, Light, Ocean, and High-Contrast themes. The UI uses glassmorphism and runs incredibly smooth.
* **100% Privacy**: No video data is ever sent to a server. Processing happens entirely on your device.

## 🛠️ Tech Stack
* **Frontend**: Vanilla HTML5, CSS3, and JavaScript (ES Modules). No heavy frameworks!
* **AI & Vision**: MediaPipe Hands API for local skeletal hand tracking.
* **Audio**: SpeechSynthesis API for text-to-speech, and Web Audio API for UI sound effects.
* **PWA**: Fully functional as a Progressive Web App (Service Workers & Manifest included).

## 🚀 How to Run Locally
Getting it running is super simple. You just need to serve it over a local server since browser security policies block webcam access from raw file paths.

If you're on Windows:
Just double-tap `Start_SignSense.bat` to launch the app instantly!

Or, if you prefer the terminal:
```bash
# 1. Clone the repo
git clone https://github.com/YOUR_USERNAME/Sign_Language_Translator.git

# 2. Go into the project directory
cd Sign_Language_Translator

# 3. Serve it using any local server (requires Node.js)
npx serve .
```

## 🧠 How it Works
1. **Detection**: `engine.js` loads the MediaPipe models and draws the skeletal hands on out a `<canvas>`.
2. **Classification**: We look at the landmark coordinates (fingers, wrist) and use rule-based heuristics in `classifier.js` to determine which ASL sign is currently held.
3. **Smoothing**: ASL can be jittery, so `smoother.js` takes a temporal slice of predictions to filter out any "false positives" before confirming a gesture.

## 🤝 Contributing
Feel free to open an issue or submit a pull request if you want to add more signs, improve the NLP grammar logic, or optimize the UX! 

---
*Built with ❤️ for better accessibility.*
