/**
 * SignSense v2 – Root Application Module
 *
 * Orchestrates all sub-modules:
 *   HandEngine · Classifier · PredictionSmoother
 *   SessionAnalytics · WordSuggestor · AppStorage
 *
 * Features:
 *   · Real-time ASL classification with temporal smoothing
 *   · Hold-to-confirm with SVG ring animation
 *   · Confidence sparkline chart
 *   · Live session analytics strip
 *   · Word autocomplete chips
 *   · Sign history log
 *   · Settings drawer (theme / hold / threshold / camera / sound / mirror / FPS)
 *   · Onboarding 3-step tutorial
 *   · Keyboard shortcuts
 *   · PWA install prompt
 *   · 3-D parallax camera card (mouse-tracking)
 *   · Web Audio API sound effects
 *   · Service Worker registration
 */

import { HandEngine }       from './js/engine.js';
import { classifyASL, ASL_ALPHA, ASL_NUMBERS, ASL_WORDS } from './js/classifier.js';
import { PredictionSmoother } from './js/smoother.js';
import { SessionAnalytics }  from './js/analytics.js';
import { WordSuggestor }     from './js/suggestions.js';
import { AppStorage }        from './js/storage.js';

'use strict';

// ══════════════════════════════════════════════════════════════
//  DOM REFERENCES
// ══════════════════════════════════════════════════════════════
const q  = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);

const video          = q('video');
const canvas         = q('canvas');
const ctx            = canvas.getContext('2d');

const startBtn       = q('startBtn');
const stopBtn        = q('stopBtn');
const cameraSelect   = q('cameraSelect');
const statusDot      = q('statusDot');
const statusText     = q('statusText');
const fpsBadge       = q('fpsBadge');

const predBadge      = q('predBadge');
const predLetter     = q('predLetter');
const predConf       = q('predConf');
const handBadge      = q('handBadge');
const handedness     = q('handedness');
const scanLine       = q('scanLine');
const videoPlaceholder = q('videoPlaceholder');
const videoSkeleton  = q('videoSkeleton');

const sparklineCanvas = q('sparklineCanvas');
const sparklineCtx    = sparklineCanvas.getContext('2d');
const sparklineLive   = q('sparklineLive');
const confBars        = q('confBars');

const bigLetter      = q('bigLetter');
const letterGlow     = q('letterGlow');
const signName       = q('signName');
const signDesc       = q('signDesc');
const signEmoji      = q('signEmoji');
const holdArc        = q('holdArc');
const holdLabel      = q('holdLabel');
const holdContainer  = q('holdArc').closest('.hold-container');
const currentSignCard = q('currentSignCard');

const suggChips      = q('suggChips');
const suggEmpty      = q('suggEmpty');

const sentenceOutput = q('sentenceOutput');
const charCount      = q('charCount');
const wordCount      = q('wordCount');
const copyBtn        = q('copyBtn');
const speakBtn       = q('speakBtn');
const exportBtn      = q('exportBtn');
const clearBtn       = q('clearBtn');
const backspaceBtn   = q('backspaceBtn');
const spaceBtn       = q('spaceBtn');

const historyList    = q('historyList');
const historyEmpty   = q('historyEmpty');
const historyToggle  = q('historyToggle');
const historyChevron = q('historyChevron');
const historyBody    = q('historyBody');

const refGrid        = q('refGrid');
const refToggleBtn   = q('refToggleBtn');
const refChevron     = q('refChevron');
const refBody        = q('refBody');

const statTime       = q('statTime');
const statSigns      = q('statSigns');
const statRate       = q('statRate');
const statConf       = q('statConf');
const statTop        = q('statTop');

const settingsBtn    = q('settingsBtn');
const settingsDrawer = q('settingsDrawer');
const drawerOverlay  = q('drawerOverlay');
const closeSettings  = q('closeSettings');

const shortcutsBtn   = q('shortcutsBtn');
const shortcutsBackdrop = q('shortcutsBackdrop');
const closeShortcuts = q('closeShortcuts');

const themeQuickToggle = q('themeQuickToggle');
const installBtn     = q('installBtn');
const toast          = q('toast');

const onboardingBackdrop = q('onboardingBackdrop');
const onboardSlides  = q('onboardSlides');
const onboardDots    = q('onboardDots');
const onboardPrev    = q('onboardPrev');
const onboardNext    = q('onboardNext');
const onboardDone    = q('onboardDone');
const onboardSkip    = q('onboardSkip');

const settingHold      = q('settingHold');
const holdVal          = q('holdVal');
const settingConf      = q('settingConf');
const confVal          = q('confVal');
const settingCamera    = q('settingCamera');
const settingMirror    = q('settingMirror');
const settingFps       = q('settingFps');
const settingSound     = q('settingSound');
const resetPrefsBtn    = q('resetPrefsBtn');
const cameraCard       = q('cameraCard');

// ══════════════════════════════════════════════════════════════
//  APPLICATION STATE
// ══════════════════════════════════════════════════════════════
const state = {
  running:         false,
  mode:            'alpha',
  theme:           'dark',
  sentence:        '',
  currentLetter:   null,
  lastConfirmed:   null,
  holdStart:       null,
  holdDuration:    1200,
  confThreshold:   0.55,
  soundEnabled:    true,
  mirrorMode:      true,
  showFps:         false,
  onboardStep:     0,
};

// ══════════════════════════════════════════════════════════════
//  MODULE INSTANCES
// ══════════════════════════════════════════════════════════════
const engine    = new HandEngine();
const smoother  = new PredictionSmoother({ bufferSize: 12, switchMargin: 0.16, minConfidence: 0.35 });
const analytics = new SessionAnalytics();
const suggestor = new WordSuggestor();

// Hold ring constants (r=27)
const HOLD_CIRCUMFERENCE = 169.6;

// ══════════════════════════════════════════════════════════════
//  PREFERENCES LOAD
// ══════════════════════════════════════════════════════════════
function loadPrefs() {
  const prefs = AppStorage.load();
  state.theme         = prefs.theme        || 'dark';
  state.holdDuration  = prefs.holdDuration  || 1200;
  state.confThreshold = prefs.confidenceThreshold || 0.55;
  state.soundEnabled  = prefs.soundEnabled !== false;
  state.mirrorMode    = prefs.mirrorMode   !== false;
  state.showFps       = prefs.showFps      || false;
  state.mode          = prefs.lastMode     || 'alpha';

  applyTheme(state.theme);

  settingHold.value = state.holdDuration;
  holdVal.textContent = (state.holdDuration / 1000).toFixed(1) + 's';
  updateSliderFill(settingHold);

  settingConf.value = Math.round(state.confThreshold * 100);
  confVal.textContent = Math.round(state.confThreshold * 100) + '%';
  updateSliderFill(settingConf);

  settingMirror.classList.toggle('active', state.mirrorMode);
  settingMirror.setAttribute('aria-checked', state.mirrorMode);
  settingFps.classList.toggle('active', state.showFps);
  settingFps.setAttribute('aria-checked', state.showFps);
  settingSound.classList.toggle('active', state.soundEnabled);
  settingSound.setAttribute('aria-checked', state.soundEnabled);

  // Apply mirror mode
  video.style.transform  = state.mirrorMode ? 'scaleX(-1)' : 'scaleX(1)';
  canvas.style.transform = state.mirrorMode ? 'scaleX(-1)' : 'scaleX(1)';

  // Detection mode buttons
  document.querySelectorAll('.toggle-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === state.mode);
    b.setAttribute('aria-pressed', b.dataset.mode === state.mode);
  });

  // FPS badge
  fpsBadge.classList.toggle('hidden', !state.showFps);
}

// ══════════════════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════════════════
const THEME_CYCLE = ['dark', 'light', 'ocean', 'contrast'];

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  state.theme = theme;
  AppStorage.set('theme', theme);

  // Update theme buttons in drawer
  document.querySelectorAll('.theme-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.theme === theme);
  });
}

themeQuickToggle.addEventListener('click', () => {
  const idx  = THEME_CYCLE.indexOf(state.theme);
  const next = THEME_CYCLE[(idx + 1) % THEME_CYCLE.length];
  applyTheme(next);
  showToast(`Theme: ${next.charAt(0).toUpperCase() + next.slice(1)}`);
});

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => applyTheme(btn.dataset.theme));
});

// ══════════════════════════════════════════════════════════════
//  ENGINE EVENTS
// ══════════════════════════════════════════════════════════════
engine.addEventListener('status', e => {
  const { type, text } = e.detail;
  statusDot.className = `status-dot ${type === 'active' ? 'active' : type === 'loading' ? 'loading' : type === 'error' ? 'error' : ''}`;
  statusText.textContent = text;
});

engine.addEventListener('ready', () => {
  videoSkeleton.classList.add('hidden');
});

engine.addEventListener('started', async () => {
  state.running = true;
  startBtn.classList.add('hidden');
  stopBtn.classList.remove('hidden');
  videoPlaceholder.classList.add('hidden');
  video.style.display = 'block';
  scanLine.classList.remove('hidden');
  handBadge.classList.remove('hidden');

  // Populate camera selector now that permission is granted
  const cameras = await engine.getCameras();
  populateCameraSelect(cameras);
});

engine.addEventListener('stopped', () => {
  state.running = false;
  startBtn.classList.remove('hidden');
  stopBtn.classList.add('hidden');
  videoPlaceholder.classList.remove('hidden');
  video.style.display = 'none';
  scanLine.classList.add('hidden');
  handBadge.classList.add('hidden');
  predBadge.classList.remove('visible');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  clearHold(true);
  smoother.reset();
  resetPredictionUI();
});

engine.addEventListener('fps', e => {
  if (state.showFps) fpsBadge.textContent = `${e.detail.fps} fps`;
});

engine.addEventListener('result', e => {
  const { landmarks, handedness: hd, hasHand, frameCount } = e.detail;
  canvas.width  = video.videoWidth  || 1280;
  canvas.height = video.videoHeight || 720;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (hasHand && landmarks) {
    // Draw skeleton
    engine.drawHand(ctx, landmarks);

    // Handedness label
    if (hd) {
      handedness.textContent = hd.label || 'Unknown';
    }

    // Raw classification
    const raw      = classifyASL(landmarks, state.mode);
    const smoothed = smoother.push(raw);

    // Apply user confidence threshold
    const result = smoothed.confidence >= state.confThreshold
      ? smoothed
      : { letter: null, confidence: smoothed.confidence, scores: smoothed.scores };

    updatePredictionUI(result);
    updateHoldRing(result.letter, result.confidence);
    drawSparkline(smoother.getHistory(), smoothed.confidence);
    updateConfBars(result.scores);
  } else {
    const empty = { letter: null, confidence: 0, scores: {} };
    smoother.push(empty);
    updatePredictionUI(empty);
    clearHold();
    drawSparkline(smoother.getHistory(), 0);
    updateConfBars({});
  }
});

// ══════════════════════════════════════════════════════════════
//  CAMERA START / STOP
// ══════════════════════════════════════════════════════════════
startBtn.addEventListener('click', startCamera);
stopBtn.addEventListener('click',  () => engine.stopCamera(video));

async function startCamera() {
  if (!engine._initialized) {
    showToast('AI model still loading, please wait…');
    return;
  }
  try {
    const deviceId = cameraSelect.value || null;
    await engine.startCamera(video, deviceId);
    analytics.reset();
  } catch (err) {
    showToast('Camera access denied – please allow camera permissions', 'danger');
    console.error('[App] Camera error:', err);
  }
}

// Camera select
cameraSelect.addEventListener('change', () => {
  AppStorage.set('preferredCameraId', cameraSelect.value);
  if (state.running) {
    engine.stopCamera(video);
    setTimeout(startCamera, 300);
  }
});

async function populateCameraSelect(cameras) {
  cameraSelect.innerHTML = '';
  const savedId = AppStorage.get('preferredCameraId');
  cameras.forEach((cam, i) => {
    const opt = document.createElement('option');
    opt.value = cam.deviceId;
    opt.textContent = cam.label || `Camera ${i + 1}`;
    if (cam.deviceId === savedId) opt.selected = true;
    cameraSelect.appendChild(opt);
  });

  // Populate settings drawer camera select too
  settingCamera.innerHTML = cameraSelect.innerHTML;
}

settingCamera.addEventListener('change', () => {
  cameraSelect.value = settingCamera.value;
  cameraSelect.dispatchEvent(new Event('change'));
});

// ══════════════════════════════════════════════════════════════
//  PREDICTION UI
// ══════════════════════════════════════════════════════════════
function updatePredictionUI({ letter, confidence }) {
  // Video overlay badge
  if (letter) {
    predBadge.classList.add('visible');
    predLetter.textContent = letter;
    predConf.textContent   = Math.round(confidence * 100) + '%';
  } else {
    predBadge.classList.remove('visible');
  }

  sparklineLive.textContent = Math.round(confidence * 100) + '%';

  // Big letter
  if (letter && letter !== state.currentLetter) {
    state.currentLetter = letter;

    bigLetter.textContent = letter;
    bigLetter.classList.remove('letter-confirm');
    void bigLetter.offsetWidth;
    bigLetter.classList.add('letter-confirm');

    const dict = state.mode === 'alpha' ? ASL_ALPHA
               : state.mode === 'numbers' ? ASL_NUMBERS : ASL_WORDS;
    const info = dict[letter];
    signName.textContent  = `Sign: ${letter}`;
    signDesc.textContent  = info?.desc || '';
    signEmoji.textContent = info?.emoji || '';

    // Highlight ref grid
    document.querySelectorAll('.ref-item').forEach(el => {
      el.classList.toggle('active', el.dataset.letter === letter);
    });
  } else if (!letter) {
    resetPredictionUI();
  }
}

function resetPredictionUI() {
  state.currentLetter = null;
  bigLetter.textContent = '–';
  signName.textContent  = 'No sign detected';
  signDesc.textContent  = 'Position your hand in front of the camera';
  signEmoji.textContent = '';
  document.querySelectorAll('.ref-item.active').forEach(el => el.classList.remove('active'));
}

// ══════════════════════════════════════════════════════════════
//  HOLD RING
// ══════════════════════════════════════════════════════════════
function updateHoldRing(letter, confidence) {
  if (letter) {
    if (!state.holdStart) state.holdStart = Date.now();
    const elapsed  = Date.now() - state.holdStart;
    const progress = Math.min(elapsed / state.holdDuration, 1);
    holdArc.style.strokeDashoffset = HOLD_CIRCUMFERENCE * (1 - progress);
    holdLabel.textContent = progress >= 1 ? '✓' : 'Hold';
    holdContainer.classList.toggle('confirming', progress > 0.2);
    letterGlow.classList.toggle('active', progress > 0.5);

    if (progress >= 1 && letter !== state.lastConfirmed) {
      confirmSign(letter, confidence);
    }
  } else {
    clearHold();
  }
}

function clearHold(full = false) {
  state.holdStart = null;
  holdArc.style.strokeDashoffset = HOLD_CIRCUMFERENCE;
  holdLabel.textContent = 'Hold';
  holdContainer.classList.remove('confirming');
  letterGlow.classList.remove('active');
  if (full) state.lastConfirmed = null;
}

// ══════════════════════════════════════════════════════════════
//  CONFIRM SIGN
// ══════════════════════════════════════════════════════════════
function confirmSign(letter, confidence) {
  state.lastConfirmed = letter;

  // Add to text output
  const wasPlaceholder = sentenceOutput.querySelector('.placeholder-text');
  if (wasPlaceholder) {
    sentenceOutput.innerHTML = '';
    sentenceOutput.classList.add('has-cursor');
  }
  const span = document.createElement('span');
  span.className = 'char-flash';
  span.textContent = letter;
  sentenceOutput.appendChild(span);
  state.sentence += letter;
  sentenceOutput.scrollTop = sentenceOutput.scrollHeight;

  // Update stats & suggestions
  updateTextStats();
  updateSuggestions();

  // History log
  addHistoryItem(letter, confidence);

  // Analytics
  analytics.record(letter, confidence);

  // Sound
  if (state.soundEnabled) playConfirmSound();

  // Visual burst on current sign card
  currentSignCard.classList.remove('pulse');
  void currentSignCard.offsetWidth;
  currentSignCard.classList.add('pulse');

  // Flash letter glow
  letterGlow.classList.add('active');
  setTimeout(() => letterGlow.classList.remove('active'), 500);

  showToast(`✓ ${letter} confirmed`, 'success');

  // Reset hold cooldown
  setTimeout(() => { state.holdStart = null; state.lastConfirmed = null; }, 1600);
}

// ══════════════════════════════════════════════════════════════
//  TEXT OUTPUT
// ══════════════════════════════════════════════════════════════
function updateTextStats() {
  const text = state.sentence;
  charCount.textContent = `${text.length} chars`;
  wordCount.textContent = `${text.trim() ? text.trim().split(/\s+/).length : 0} words`;
}

function updateSuggestions() {
  // Get last "word" being typed (chars since last space)
  const parts  = state.sentence.split(/\s+/);
  const prefix = parts[parts.length - 1] || '';

  const suggestions = prefix.length >= 1 ? suggestor.getSuggestions(prefix, 4) : [];

  suggChips.innerHTML = '';
  if (suggestions.length > 0) {
    suggEmpty.style.display = 'none';
    suggestions.forEach(word => {
      const chip = document.createElement('button');
      chip.className   = 'chip';
      chip.textContent = word;
      chip.title       = `Insert "${word}"`;
      chip.addEventListener('click', () => acceptSuggestion(word, prefix));
      suggChips.appendChild(chip);
    });
  } else {
    suggEmpty.style.display = '';
    suggEmpty.textContent = prefix.length > 0 ? `No matches for "${prefix}"` : 'Type signs to see word suggestions';
  }
}

function acceptSuggestion(word, prefix) {
  // Remove prefix from state and output, then add full word + space
  const removeLen = prefix.length;
  state.sentence = state.sentence.slice(0, -removeLen) + word + ' ';

  // Rebuild text output
  rebuildSentenceOutput();
  updateTextStats();
  updateSuggestions();
  showToast(`Word: ${word}`, 'success');
}

function rebuildSentenceOutput() {
  sentenceOutput.innerHTML = '';
  if (!state.sentence) {
    sentenceOutput.innerHTML = '<span class="placeholder-text">Your translated text will appear here…</span>';
    sentenceOutput.classList.remove('has-cursor');
    return;
  }
  sentenceOutput.classList.add('has-cursor');
  const span = document.createElement('span');
  span.textContent = state.sentence;
  sentenceOutput.appendChild(span);
  sentenceOutput.scrollTop = sentenceOutput.scrollHeight;
}

copyBtn.addEventListener('click', () => {
  if (!state.sentence) { showToast('Nothing to copy'); return; }
  navigator.clipboard.writeText(state.sentence).then(() => showToast('Copied ✓', 'success'));
});

speakBtn.addEventListener('click', () => {
  if (!state.sentence) { showToast('Nothing to speak'); return; }
  const utt  = new SpeechSynthesisUtterance(state.sentence);
  utt.rate   = 0.9; utt.pitch = 1;
  speechSynthesis.cancel();
  speechSynthesis.speak(utt);
  showToast('Speaking…');
});

exportBtn.addEventListener('click', () => {
  const content  = analytics.export(state.sentence);
  const blob     = new Blob([content], { type: 'text/plain' });
  const url      = URL.createObjectURL(blob);
  const a        = document.createElement('a');
  a.href         = url;
  a.download     = `signsense-session-${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Session exported ✓', 'success');
});

clearBtn.addEventListener('click', () => {
  state.sentence = '';
  rebuildSentenceOutput();
  updateTextStats();
  updateSuggestions();
  clearHold(true);
  showToast('Cleared');
});

backspaceBtn.addEventListener('click', doBackspace);
function doBackspace() {
  if (!state.sentence) return;
  state.sentence = state.sentence.slice(0, -1);
  rebuildSentenceOutput();
  updateTextStats();
  updateSuggestions();
}

spaceBtn.addEventListener('click', doSpace);
function doSpace() {
  if (state.sentence.endsWith(' ')) return;
  state.sentence += ' ';
  rebuildSentenceOutput();
  updateTextStats();
  updateSuggestions();
}

// ══════════════════════════════════════════════════════════════
//  HISTORY LOG
// ══════════════════════════════════════════════════════════════
function addHistoryItem(letter, confidence) {
  if (historyEmpty) historyEmpty.style.display = 'none';

  const item = document.createElement('div');
  item.className = 'history-item';
  item.innerHTML = `
    <span class="history-letter">${letter}</span>
    <span class="history-time">${new Date().toLocaleTimeString()}</span>
    <span class="history-conf">${Math.round(confidence * 100)}%</span>
  `;
  historyList.insertBefore(item, historyList.firstChild);

  // Limit to 30 items
  if (historyList.children.length > 30) {
    historyList.removeChild(historyList.lastChild);
  }
}

historyToggle.addEventListener('click', () => {
  const isOpen = historyBody.classList.toggle('open');
  historyChevron.classList.toggle('open', isOpen);
  historyToggle.setAttribute('aria-expanded', isOpen);
});

// ══════════════════════════════════════════════════════════════
//  REFERENCE GRID
// ══════════════════════════════════════════════════════════════
function buildRefGrid(mode) {
  refGrid.innerHTML = '';
  const dict = mode === 'alpha'   ? ASL_ALPHA
             : mode === 'numbers' ? ASL_NUMBERS : ASL_WORDS;
  Object.entries(dict).forEach(([letter, info]) => {
    const item = document.createElement('div');
    item.className = 'ref-item';
    item.dataset.letter = letter;
    item.title = info.desc;
    item.setAttribute('role', 'listitem');
    item.innerHTML = `
      <span class="ref-letter">${letter}</span>
      <span class="ref-desc">${info.desc.substring(0, 13)}…</span>
    `;
    refGrid.appendChild(item);
  });
}

refToggleBtn.addEventListener('click', () => {
  const isOpen = refBody.classList.toggle('open');
  refChevron.classList.toggle('open', isOpen);
  refToggleBtn.setAttribute('aria-expanded', isOpen);
});

// ══════════════════════════════════════════════════════════════
//  SPARKLINE CHART
// ══════════════════════════════════════════════════════════════
function drawSparkline(history, currentConf) {
  const w = sparklineCanvas.width  = sparklineCanvas.offsetWidth  || 200;
  const h = sparklineCanvas.height = sparklineCanvas.offsetHeight || 32;
  sparklineCtx.clearRect(0, 0, w, h);

  const len = history.length;
  if (!len) return;

  const step = w / (len - 1);
  const grad = sparklineCtx.createLinearGradient(0, 0, w, 0);
  grad.addColorStop(0, getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#7c3aed');
  grad.addColorStop(1, getComputedStyle(document.documentElement).getPropertyValue('--accent-2').trim() || '#06b6d4');

  sparklineCtx.beginPath();
  history.forEach((v, i) => {
    const x = i * step;
    const y = h - v * h;
    i === 0 ? sparklineCtx.moveTo(x, y) : sparklineCtx.lineTo(x, y);
  });
  sparklineCtx.strokeStyle = grad;
  sparklineCtx.lineWidth   = 1.5;
  sparklineCtx.lineJoin    = 'round';
  sparklineCtx.lineCap     = 'round';
  sparklineCtx.stroke();

  // Fill area under line
  sparklineCtx.lineTo(w, h); sparklineCtx.lineTo(0, h); sparklineCtx.closePath();
  const fillGrad = sparklineCtx.createLinearGradient(0, 0, 0, h);
  fillGrad.addColorStop(0, 'rgba(124,58,237,0.18)');
  fillGrad.addColorStop(1, 'rgba(124,58,237,0)');
  sparklineCtx.fillStyle = fillGrad;
  sparklineCtx.fill();
}

// ══════════════════════════════════════════════════════════════
//  CONFIDENCE BARS
// ══════════════════════════════════════════════════════════════
function updateConfBars(scores) {
  const entries = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 5);
  confBars.innerHTML = '';
  if (!entries.length) return;

  entries.forEach(([letter, val]) => {
    const pct = Math.round(val * 100);
    const row = document.createElement('div');
    row.className = 'conf-bar-row';
    row.setAttribute('role', 'listitem');
    row.innerHTML = `
      <span class="conf-bar-letter">${letter}</span>
      <div class="conf-bar-track" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
        <div class="conf-bar-fill" style="width:${pct}%"></div>
      </div>
      <span class="conf-bar-pct">${pct}%</span>
    `;
    confBars.appendChild(row);
  });
}

// ══════════════════════════════════════════════════════════════
//  ANALYTICS STRIP UPDATE
// ══════════════════════════════════════════════════════════════
function updateAnalyticsStrip() {
  const snap = analytics.getSnapshot();
  statTime.textContent  = snap.duration;
  statSigns.textContent = snap.signCount;
  statRate.textContent  = snap.signsPerMin;
  statConf.textContent  = snap.signCount ? snap.avgConf + '%' : '—';
  statTop.textContent   = snap.topSign;
}
setInterval(updateAnalyticsStrip, 1000);

// ══════════════════════════════════════════════════════════════
//  DETECTION MODE
// ══════════════════════════════════════════════════════════════
document.querySelectorAll('.toggle-btn[data-mode]').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.toggle-btn[data-mode]').forEach(b => {
      b.classList.remove('active');
      b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('active');
    btn.setAttribute('aria-pressed', 'true');
    state.mode = btn.dataset.mode;
    AppStorage.set('lastMode', state.mode);
    buildRefGrid(state.mode);
    smoother.reset();
    clearHold(true);
    resetPredictionUI();
    updateSuggestions();
  });
});

// ══════════════════════════════════════════════════════════════
//  SETTINGS DRAWER
// ══════════════════════════════════════════════════════════════
function openSettings() {
  settingsDrawer.classList.add('open');
  drawerOverlay.classList.add('open');
  drawerOverlay.setAttribute('aria-hidden', 'false');
}
function closeSettingsDrawer() {
  settingsDrawer.classList.remove('open');
  drawerOverlay.classList.remove('open');
  drawerOverlay.setAttribute('aria-hidden', 'true');
}
settingsBtn.addEventListener('click', openSettings);
closeSettings.addEventListener('click', closeSettingsDrawer);
drawerOverlay.addEventListener('click', closeSettingsDrawer);

// Hold Duration
settingHold.addEventListener('input', () => {
  const v = parseInt(settingHold.value);
  state.holdDuration  = v;
  holdVal.textContent = (v / 1000).toFixed(1) + 's';
  AppStorage.set('holdDuration', v);
  updateSliderFill(settingHold);
});

// Confidence Threshold
settingConf.addEventListener('input', () => {
  const v = parseInt(settingConf.value);
  state.confThreshold = v / 100;
  confVal.textContent = v + '%';
  AppStorage.set('confidenceThreshold', v / 100);
  updateSliderFill(settingConf);
});

// Mirror toggle
settingMirror.addEventListener('click', () => {
  state.mirrorMode = !state.mirrorMode;
  settingMirror.classList.toggle('active', state.mirrorMode);
  settingMirror.setAttribute('aria-checked', state.mirrorMode);
  video.style.transform  = state.mirrorMode ? 'scaleX(-1)' : 'scaleX(1)';
  canvas.style.transform = state.mirrorMode ? 'scaleX(-1)' : 'scaleX(1)';
  AppStorage.set('mirrorMode', state.mirrorMode);
});

// FPS toggle
settingFps.addEventListener('click', () => {
  state.showFps = !state.showFps;
  settingFps.classList.toggle('active', state.showFps);
  settingFps.setAttribute('aria-checked', state.showFps);
  fpsBadge.classList.toggle('hidden', !state.showFps);
  AppStorage.set('showFps', state.showFps);
});

// Sound toggle
settingSound.addEventListener('click', () => {
  state.soundEnabled = !state.soundEnabled;
  settingSound.classList.toggle('active', state.soundEnabled);
  settingSound.setAttribute('aria-checked', state.soundEnabled);
  AppStorage.set('soundEnabled', state.soundEnabled);
  if (state.soundEnabled) playConfirmSound();
});

// Reset prefs
resetPrefsBtn.addEventListener('click', () => {
  AppStorage.reset();
  loadPrefs();
  showToast('Preferences reset to defaults');
});

function updateSliderFill(slider) {
  const min = parseFloat(slider.min);
  const max = parseFloat(slider.max);
  const val = parseFloat(slider.value);
  const pct = ((val - min) / (max - min)) * 100;
  slider.style.setProperty('--pct', pct + '%');
}

// ══════════════════════════════════════════════════════════════
//  SHORTCUTS MODAL
// ══════════════════════════════════════════════════════════════
function openShortcuts() {
  shortcutsBackdrop.classList.remove('hidden');
}
function closeShortcutsModal() {
  shortcutsBackdrop.classList.add('hidden');
}
shortcutsBtn.addEventListener('click', openShortcuts);
closeShortcuts.addEventListener('click', closeShortcutsModal);
shortcutsBackdrop.addEventListener('click', e => {
  if (e.target === shortcutsBackdrop) closeShortcutsModal();
});

// ══════════════════════════════════════════════════════════════
//  KEYBOARD SHORTCUTS
// ══════════════════════════════════════════════════════════════
document.addEventListener('keydown', e => {
  // Skip when inside inputs
  if (e.target.matches('input, select, textarea')) return;
  if (onboardingBackdrop && !onboardingBackdrop.classList.contains('hidden')) return;

  switch (e.key) {
    case ' ':
    case 'Spacebar':
      e.preventDefault();
      doSpace();
      break;
    case 'Backspace':
      e.preventDefault();
      doBackspace();
      break;
    case 'Enter':
      state.running ? engine.stopCamera(video) : startCamera();
      break;
    case 'c': case 'C':
      if (!e.ctrlKey && !e.metaKey) copyBtn.click();
      break;
    case 's': case 'S':
      speakBtn.click();
      break;
    case 'x': case 'X':
      clearBtn.click();
      break;
    case ',':
      openSettings();
      break;
    case '?':
      openShortcuts();
      break;
    case 'Escape':
      closeSettingsDrawer();
      closeShortcutsModal();
      break;
  }
});

// ══════════════════════════════════════════════════════════════
//  ONBOARDING
// ══════════════════════════════════════════════════════════════
const TOTAL_STEPS = 3;

function showOnboardStep(step) {
  state.onboardStep = step;
  const slides = onboardSlides.querySelectorAll('.onboard-slide');
  const dots   = onboardDots.querySelectorAll('.dot');

  slides.forEach((s, i) => s.classList.toggle('active', i === step));
  dots.forEach((d, i)   => d.classList.toggle('active', i === step));

  onboardPrev.disabled = step === 0;
  onboardNext.classList.toggle('hidden', step === TOTAL_STEPS - 1);
  onboardDone.classList.toggle('hidden', step !== TOTAL_STEPS - 1);
}

function closeOnboarding() {
  onboardingBackdrop.classList.add('hidden');
  AppStorage.set('hasSeenOnboarding', true);
}

onboardNext.addEventListener('click', () => {
  if (state.onboardStep < TOTAL_STEPS - 1) showOnboardStep(state.onboardStep + 1);
});
onboardPrev.addEventListener('click', () => {
  if (state.onboardStep > 0) showOnboardStep(state.onboardStep - 1);
});
onboardDone.addEventListener('click', closeOnboarding);
onboardSkip.addEventListener('click', closeOnboarding);
onboardDots.querySelectorAll('.dot').forEach((dot, i) => {
  dot.addEventListener('click', () => showOnboardStep(i));
});

function shouldShowOnboarding() {
  return !AppStorage.get('hasSeenOnboarding');
}

// ══════════════════════════════════════════════════════════════
//  3-D PARALLAX CAMERA CARD
// ══════════════════════════════════════════════════════════════
let parallaxRaf;
cameraCard.addEventListener('mousemove', e => {
  cancelAnimationFrame(parallaxRaf);
  parallaxRaf = requestAnimationFrame(() => {
    const rect = cameraCard.getBoundingClientRect();
    const x    = (e.clientX - rect.left) / rect.width  - 0.5;
    const y    = (e.clientY - rect.top)  / rect.height - 0.5;
    cameraCard.style.transform  = `perspective(900px) rotateY(${x * 7}deg) rotateX(${-y * 5}deg)`;
    cameraCard.style.transition = 'transform 0.08s linear';
  });
});
cameraCard.addEventListener('mouseleave', () => {
  cancelAnimationFrame(parallaxRaf);
  cameraCard.style.transform  = '';
  cameraCard.style.transition = 'transform 0.6s var(--spring)';
});

// ══════════════════════════════════════════════════════════════
//  SOUND EFFECTS (Web Audio API)
// ══════════════════════════════════════════════════════════════
let audioCtx;
function getAudioCtx() {
  if (!audioCtx) {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  return audioCtx;
}

function playConfirmSound() {
  try {
    const ctx  = getAudioCtx();
    const osc  = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(660, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.06);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.22);
  } catch { /* AudioContext not available */ }
}

// ══════════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════════
let toastTimer;
function showToast(msg, type = '') {
  toast.textContent = msg;
  toast.className   = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2400);
}

// ══════════════════════════════════════════════════════════════
//  PWA INSTALL PROMPT
// ══════════════════════════════════════════════════════════════
let deferredInstall;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  deferredInstall = e;
  installBtn.style.display = '';
});

installBtn.addEventListener('click', async () => {
  if (!deferredInstall) return;
  deferredInstall.prompt();
  const { outcome } = await deferredInstall.userChoice;
  if (outcome === 'accepted') {
    installBtn.style.display = 'none';
    showToast('App installed! 🚀', 'success');
  }
  deferredInstall = null;
});

// ══════════════════════════════════════════════════════════════
//  SERVICE WORKER
// ══════════════════════════════════════════════════════════════
function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').then(reg => {
      console.log('[SW] Registered:', reg.scope);
    }).catch(err => console.warn('[SW] Registration failed:', err));
  }
}

// ══════════════════════════════════════════════════════════════
//  INITIALISE
// ══════════════════════════════════════════════════════════════
async function init() {
  // Load persisted preferences
  loadPrefs();

  // Build reference grid
  buildRefGrid(state.mode);
  refBody.classList.add('open');
  refChevron.classList.add('open');

  // Initial suggestions state
  updateSuggestions();

  // Show skeleton while model loads
  videoSkeleton.classList.remove('hidden');

  // Init MediaPipe (fires 'ready' event which hides skeleton)
  await engine.init();

  // Populate cameras (basic list before permission)
  const cams = await engine.getCameras();
  if (cams.length > 1) populateCameraSelect(cams);

  // Check for ?action=start shortcut (from PWA shortcuts)
  if (new URLSearchParams(location.search).get('action') === 'start') {
    startCamera();
  }

  // Onboarding
  if (shouldShowOnboarding()) {
    onboardingBackdrop.classList.remove('hidden');
    showOnboardStep(0);
  } else {
    onboardingBackdrop.classList.add('hidden');
  }

  // PWA / SW
  registerServiceWorker();

  // Animate hold demo arc in onboarding
  animateHoldDemo();
}

function animateHoldDemo() {
  const arc  = document.getElementById('demoArc');
  if (!arc) return;
  let pct = 0;
  let dir = 1;
  const circ = 188.5;
  setInterval(() => {
    pct += dir * 2;
    if (pct >= 100) { pct = 100; dir = -1; }
    if (pct <= 0)   { pct = 0;   dir =  1; }
    arc.style.strokeDashoffset = circ * (1 - pct / 100);
  }, 40);
}

// Kick off when DOM + CDN scripts are all loaded
window.addEventListener('load', () => setTimeout(init, 250));

// ══════════════════════════════════════════════════════════════
//  TUTORIAL — DATA
// ══════════════════════════════════════════════════════════════
// finger states: 'up' | 'curl' | 'curve' | 'side' | 'touch' | 'in' | 'hook' | 'down' | 'over'
const ASL_TUTORIAL = {
  A: { steps: ['Curl all four fingers into a tight fist', 'Press fingers firmly against your palm', 'Rest your thumb alongside your index finger (not over it)', 'Face your palm outward toward the camera'], fingers: { thumb: 'side', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'Thumb is beside fingers — the key difference from S where thumb goes over.', mistake: "Don't wrap your thumb over the fingers — that's S, not A.", emoji: '✊' },
  B: { steps: ['Hold all four fingers straight up and tightly together', 'Tuck your thumb firmly across your palm', 'Keep all four fingers perfectly parallel and flat', 'Face your palm outward'], fingers: { thumb: 'in', index: 'up', middle: 'up', ring: 'up', pinky: 'up' }, tip: 'Think of a flat wall — fingers squeezed together like a blade.', mistake: "Don't spread fingers apart. They must be touching side-by-side.", emoji: '🖐️' },
  C: { steps: ['Gently curve all your fingers as if holding a tennis ball', 'Curve your thumb to mirror the arc of your fingers', 'Leave a round C-shaped opening between thumb and fingers', 'Hold your hand so the opening faces the camera'], fingers: { thumb: 'curve', index: 'curve', middle: 'curve', ring: 'curve', pinky: 'curve' }, tip: "Imagine gripping a large ball. That natural curve is perfect.", mistake: "Don't over-curl or full-extend. The gap must look like the letter C.", emoji: '🤙' },
  D: { steps: ['Extend your index finger straight up', 'Touch your thumb tip to the tips of middle, ring, and pinky fingers', 'Those three fingers and thumb form the round part of the D', 'Index finger stands tall and straight as the vertical stroke'], fingers: { thumb: 'touch', index: 'up', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'Index = stem of D, other fingers form the bulge.', mistake: "The thumb must visibly touch the other three fingertips.", emoji: '☝️' },
  E: { steps: ['Bend all four fingers down so fingertips point toward the palm', 'Fold your fingers into a tight claw shape', 'Tuck your thumb underneath all four bent fingertips', 'Your thumb hides under the curved fingertip row'], fingers: { thumb: 'in', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'A "closed claw" — thumb disappears under the bent fingers.', mistake: "Don't make a full fist. There's a slight gap — it's a claw, not a tight ball.", emoji: '✊' },
  F: { steps: ['Touch your index fingertip to your thumb tip, forming a circle', 'Let middle, ring, and pinky fingers extend straight up', 'Keep those three fingers together and pointing up', 'Face the hand so the circle is visible in front'], fingers: { thumb: 'touch', index: 'touch', middle: 'up', ring: 'up', pinky: 'up' }, tip: 'Three fingers stand like soldiers, index-thumb make a perfect O.', mistake: "Don't let the three extended fingers curl. Keep them perfectly straight.", emoji: '👌' },
  G: { steps: ['Extend your index finger horizontally, pointing to the side', 'Extend your thumb upward parallel to the index finger', 'Curl middle, ring, and pinky into your palm', 'Point sideways — like a gun aimed to the side'], fingers: { thumb: 'up', index: 'side', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'Finger-gun pointing sideways, not forward.', mistake: "Don't point forward. The index should point horizontally to the side.", emoji: '👉' },
  H: { steps: ['Extend index and middle fingers together, pointing sideways', 'Keep both fingers pressed side-by-side, not spread', 'Curl ring and pinky fingers into your palm', 'Rotate so both fingers point horizontally'], fingers: { thumb: 'in', index: 'side', middle: 'side', ring: 'curl', pinky: 'curl' }, tip: 'A sideways peace sign with fingers touching.', mistake: "Fingers must be side by side, not spread like V.", emoji: '✌️' },
  I: { steps: ['Make a fist with all four fingers', 'Extend only your pinky (little finger) straight up', 'Keep all other fingers tightly curled in', 'Hold the pinky up alone — it represents the thin letter I'], fingers: { thumb: 'in', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'up' }, tip: 'Just the pinky! Alone and standing tall.', mistake: "Only the pinky should be up. Everything else stays curled.", emoji: '🤙' },
  J: { steps: ['Start in the I position with only pinky extended', 'Trace the shape of the letter J in the air with your pinky', 'Start at the top, curve downward, then hook back left', 'This is a motion sign — the tracing IS the letter'], fingers: { thumb: 'side', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'up' }, tip: 'J is one of only two letters requiring motion. Trace it clearly!', mistake: "Without the motion, it's just I. The J path in the air is essential.", emoji: '🤙' },
  K: { steps: ['Raise index and middle fingers upward and slightly apart', 'Bring your thumb up between the two extended fingers', 'Curl ring and pinky into your palm', 'The thumb separates the two fingers — three points form K'], fingers: { thumb: 'up', index: 'up', middle: 'up', ring: 'curl', pinky: 'curl' }, tip: 'Three fingers forming a K. Thumb is the middle diagonal stroke.', mistake: "Don't forget the thumb — it must point up between the other two fingers.", emoji: '✌️' },
  L: { steps: ['Extend your index finger straight up', 'Extend your thumb out horizontally to the side', 'Curl middle, ring, and pinky into your palm', 'Your hand literally forms the letter L!'], fingers: { thumb: 'side', index: 'up', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'Your hand makes a perfect L shape. Trust the shape!', mistake: "Thumb must be fully extended outward, not angled forward.", emoji: '👆' },
  M: { steps: ['Place your thumb across your palm', 'Fold your index, middle, and ring fingers down over the thumb', 'Your pinky curls in as well', 'You see three knuckle bumps = three peaks of M'], fingers: { thumb: 'in', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'Three fingers fold over thumb = M (3 humps). Two fingers = N.', mistake: "M uses THREE fingers over the thumb, N uses only TWO.", emoji: '✊' },
  N: { steps: ['Place your thumb across your palm', 'Fold only index and middle fingers down over the thumb', 'Ring and pinky curl in normally', 'Two knuckle bumps visible = two humps of N'], fingers: { thumb: 'in', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'N = two fingers over thumb. M = three. Remember: N has 2 bumps.', mistake: "Don't use three fingers — that becomes M instead of N.", emoji: '✊' },
  O: { steps: ['Bring all fingertip to meet your thumb tip', 'All fingers curve inward forming an egg/O shape', 'The shape should look perfectly round from the front', 'Hold upright with the O opening facing outward'], fingers: { thumb: 'touch', index: 'touch', middle: 'touch', ring: 'touch', pinky: 'touch' }, tip: 'Loose fist where every tip gently meets the thumb. Smooth egg shape.', mistake: "Don't squeeze too tight — the O should look round, not squashed.", emoji: '👌' },
  P: { steps: ['Make the K handshape first (index + middle up, thumb between)', 'Now tilt your wrist down so fingers point toward the floor', 'Index and middle point downward, thumb still between them', 'Think of K rotated 90° downward'], fingers: { thumb: 'up', index: 'down', middle: 'down', ring: 'curl', pinky: 'curl' }, tip: 'P = K but tilted down. Same fingers, pointing at the ground.', mistake: "Rotate from the wrist. The whole K shape tilts, not just the fingers.", emoji: '✌️' },
  Q: { steps: ['Make the G handshape (index + thumb out)', 'Now tilt wrist down so index and thumb point toward floor', 'Both index finger and thumb should point downward', 'Like a gun pointed at the floor'], fingers: { thumb: 'down', index: 'down', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'Q = G rotated down. Imagine pointing at something on the ground.', mistake: "Both index AND thumb must point down — not just one of them.", emoji: '👇' },
  R: { steps: ['Extend your index and middle fingers upward', 'Cross your middle finger over the top of your index finger', 'Curl ring and pinky fingers down', 'The crossed fingers make the R shape'], fingers: { thumb: 'in', index: 'up', middle: 'up', ring: 'curl', pinky: 'curl' }, tip: 'Crossed fingers — like crossing fingers for good luck!', mistake: "Fingers must actually cross and overlap, not just be close together.", emoji: '🤞' },
  S: { steps: ['Curl all four fingers into a fist', 'Wrap your thumb across the front of your curled fingers (over them)', 'This differs from A where thumb rests beside fingers', 'Keep palm facing outward'], fingers: { thumb: 'over', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'Thumb crosses OVER the front of the fingers. A = thumb beside fingers.', mistake: "Don't confuse with A (thumb beside) or E (claw shape).", emoji: '✊' },
  T: { steps: ['Make a fist', 'Insert your thumb between your index and middle fingers', 'Thumb tip peeks out between those two fingers from the front', 'All other fingers stay tightly curled'], fingers: { thumb: 'between', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'Thumb sandwiched between index and middle, peeking out the front.', mistake: "Thumb goes BETWEEN the fingers — not over the fist.", emoji: '✊' },
  U: { steps: ['Extend index and middle fingers straight up together', 'Keep the two fingers pressed tightly side-by-side', 'Curl ring and pinky fingers down', 'Unlike V, these fingers touch each other'], fingers: { thumb: 'in', index: 'up', middle: 'up', ring: 'curl', pinky: 'curl' }, tip: 'Peace sign but with fingers pressed together. Touching = U.', mistake: "If fingers spread apart, it becomes V. Keep them touching.", emoji: '✌️' },
  V: { steps: ['Raise index and middle fingers in a wide V shape', 'Spread them clearly and noticeably apart', 'Curl ring and pinky fingers down', 'Classic peace sign ✌️'], fingers: { thumb: 'in', index: 'up', middle: 'up', ring: 'curl', pinky: 'curl' }, tip: 'Spread them apart — that spread is exactly what makes it V not U.', mistake: "Fingers must have a clear gap. Touching fingers = U.", emoji: '✌️' },
  W: { steps: ['Extend index, middle, and ring fingers upward and spread evenly', 'Curl your pinky finger down', 'Thumb tucks against the palm or pinky', 'Three spread fingers form three peaks of W'], fingers: { thumb: 'in', index: 'up', middle: 'up', ring: 'up', pinky: 'curl' }, tip: 'Three spread fingers = three points of W. Like a crown!', mistake: "All three fingers must be spread apart — not together.", emoji: '🖖' },
  X: { steps: ['Extend your index finger', 'Bend (hook) only the index finger at the middle joint', 'Curl all other fingers into a fist', 'The hooked index looks like a hook or bent X'], fingers: { thumb: 'in', index: 'hook', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'Think of a crooked beckoning finger or a fishhook.', mistake: "The finger is half-bent (hooked), not fully extended or fully curled.", emoji: '☝️' },
  Y: { steps: ['Extend your thumb outward to the side', 'Extend your pinky straight up', 'Curl index, middle, ring fingers into your palm', 'Thumb and pinky spread wide — both are out!'], fingers: { thumb: 'side', index: 'curl', middle: 'curl', ring: 'curl', pinky: 'up' }, tip: 'Hang loose! 🤙 That IS the Y sign. Both thumb and pinky out.', mistake: "Both thumb AND pinky must be extended. Just pinky = I.", emoji: '🤙' },
  Z: { steps: ['Extend only your index finger (like pointing)', 'Trace the letter Z in the air with your fingertip', 'Go: horizontal right → diagonal down-left → horizontal right again', 'This motion sign literally draws Z in the air'], fingers: { thumb: 'in', index: 'up', middle: 'curl', ring: 'curl', pinky: 'curl' }, tip: 'Draw Z clearly in the air. The trace must be visible.', mistake: "Without the Z motion it looks like D, 1, or G. The trace is everything.", emoji: '☝️' },
};

const TUTORIAL_LETTERS = Object.keys(ASL_TUTORIAL);

// ══════════════════════════════════════════════════════════════
//  TUTORIAL — FINGER DIAGRAM SVG GENERATOR
// ══════════════════════════════════════════════════════════════
function generateFingerDiagram(states) {
  const uid = Math.random().toString(36).slice(2, 6);
  const gid = `fg_${uid}`;

  const PALM_Y  = 148;
  const HEIGHTS = { thumb: 55, index: 82, middle: 92, ring: 80, pinky: 65 };
  const WIDTHS  = { thumb: 17, index: 20, middle: 20, ring: 19, pinky: 16 };
  const XS      = { thumb: 30, index: 68, middle: 96, ring: 124, pinky: 150 };
  const LABELS  = { thumb: 'T', index: 'I', middle: 'M', ring: 'R', pinky: 'P' };

  const STATE_FILL = {
    up:      `url(#${gid})`,
    side:    `url(#${gid})`,
    down:    `url(#${gid})`,
    touch:   `url(#${gid})`,
    over:    `url(#${gid})`,
    between: `url(#${gid})`,
    hook:    `url(#${gid})`,
    curve:   `rgba(124,58,237,0.52)`,
    curl:    `rgba(124,58,237,0.14)`,
    in:      `rgba(124,58,237,0.10)`,
  };

  function drawFinger(name) {
    const state = states[name] || 'curl';
    const x     = XS[name];
    const maxH  = HEIGHTS[name];
    const w     = WIDTHS[name];
    const r     = w / 2;
    const fill  = STATE_FILL[state] || 'rgba(124,58,237,0.1)';
    const bY    = name === 'thumb' ? PALM_Y + 14 : PALM_Y;

    if (state === 'up') {
      const h = maxH; const y = bY - h;
      return `<rect x="${x-r}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="0.9"/>
              <circle cx="${x}" cy="${y + r}" r="${r}" fill="${fill}" opacity="0.9"/>`;
    }
    if (state === 'curl' || state === 'in') {
      const h = 18;
      return `<rect x="${x-r}" y="${bY-h}" width="${w}" height="${h}" rx="${r}" fill="${fill}"/>`;
    }
    if (state === 'curve') {
      const h = Math.round(maxH * 0.58);
      const y = bY - h;
      return `<rect x="${x-r}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="0.75"/>`;
    }
    if (state === 'side') {
      // horizontal extension (thumb mostly)
      const dir = name === 'thumb' ? -1 : 1;
      const len = 48;
      return `<rect x="${dir === -1 ? x - len : x}" y="${bY - r - 4}" width="${len}" height="${w}" rx="${r}" fill="${fill}" opacity="0.85"/>`;
    }
    if (state === 'touch') {
      const h = 14;
      return `<rect x="${x-r}" y="${bY-h}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="0.6"/>
              <circle cx="${x}" cy="${bY-h}" r="${r+1}" fill="none" stroke="rgba(6,182,212,0.6)" stroke-width="1.5"/>`;
    }
    if (state === 'hook') {
      const h = maxH * 0.65;
      const y = bY - h;
      return `<rect x="${x-r}" y="${y}" width="${w}" height="${h * 0.6}" rx="${r}" fill="${fill}" opacity="0.85"/>
              <path d="M${x-r} ${y + h*0.6} h${w} a${r} ${r *1.2} 0 0 1 0 ${h*0.4} h-${w} z" fill="${fill}" opacity="0.6"/>`;
    }
    if (state === 'down') {
      const h = maxH * 0.7;
      return `<rect x="${x-r}" y="${bY}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="0.75" transform="rotate(20 ${x} ${bY})"/>`;
    }
    if (state === 'over') {
      // sits on top of the curl row
      const h = 20;
      return `<rect x="${x-r-2}" y="${bY-h-4}" width="${w+4}" height="${h}" rx="${r+2}" fill="${fill}" opacity="0.65"/>`;
    }
    if (state === 'between') {
      // tiny peeking thumb
      const h = 22;
      return `<rect x="${x-r}" y="${bY-h}" width="${w}" height="${h}" rx="${r}" fill="${fill}" opacity="0.8"/>
              <circle cx="${x}" cy="${bY-h}" r="${r+1.5}" fill="${fill}" opacity="0.9"/>`;
    }
    return '';
  }

  const fingers = Object.keys(XS);
  const parts   = fingers.map(drawFinger).join('');
  const labels  = fingers.map(n =>
    `<text x="${XS[n]}" y="225" text-anchor="middle" font-size="9" fill="rgba(124,58,237,0.45)" font-family="monospace">${LABELS[n]}</text>`
  ).join('');

  return `<svg viewBox="0 0 190 235" fill="none" xmlns="http://www.w3.org/2000/svg" class="finger-svg" aria-hidden="true">
    <defs>
      <linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#7c3aed"/>
        <stop offset="100%" stop-color="#06b6d4"/>
      </linearGradient>
    </defs>
    <!-- base line -->
    <line x1="12" y1="${PALM_Y}" x2="172" y2="${PALM_Y}" stroke="rgba(124,58,237,0.09)" stroke-width="1" stroke-dasharray="4 3"/>
    <!-- palm -->
    <rect x="40" y="${PALM_Y}" width="120" height="65" rx="20" fill="rgba(124,58,237,0.07)" stroke="rgba(124,58,237,0.18)" stroke-width="1.2"/>
    <!-- wrist -->
    <path d="M52 ${PALM_Y+65} Q100 ${PALM_Y+80} 148 ${PALM_Y+65}" stroke="rgba(124,58,237,0.15)" stroke-width="1.5" fill="none"/>
    <!-- fingers -->
    ${parts}
    <!-- labels -->
    ${labels}
  </svg>`;
}

// ══════════════════════════════════════════════════════════════
//  TUTORIAL — STATE
// ══════════════════════════════════════════════════════════════
const tutState = {
  open:          false,
  tab:           'learn',   // 'learn' | 'practice'
  letterIndex:   0,
  masteredSet:   new Set(),
  practiceHoldStart: null,
  practiceSuccessShown: false,
};

// Grab DOM refs
const tutorialBackdrop  = q('tutorialBackdrop');
const tutorialBtn       = q('tutorialBtn');
const closeTutorial     = q('closeTutorial');
const letterNavBar      = q('letterNavBar');
const tutLearnPanel     = q('tutLearnPanel');
const tutPracticePanel  = q('tutPracticePanel');
const tabLearn          = q('tabLearn');
const tabPractice       = q('tabPractice');
const tutBigLetter      = q('tutBigLetter');
const tutLetterName     = q('tutLetterName');
const fingerDiagramWrap = q('fingerDiagramWrap');
const tutSteps          = q('tutSteps');
const tutTip            = q('tutTip');
const tutMistake        = q('tutMistake');
const tutEmoji          = q('tutEmoji');
const goToPractice      = q('goToPractice');
const tutPrevBtn        = q('tutPrevBtn');
const tutNextBtn        = q('tutNextBtn');
const tutProgressPills  = q('tutProgressPills');

const practiceBigLetter = q('practiceBigLetter');
const practiceHint      = q('practiceHint');
const practiceNoCam     = q('practiceNoCam');
const practiceCamOn     = q('practiceCamOn');
const practiceStartCam  = q('practiceStartCam');
const matchArc          = q('matchArc');
const matchPct          = q('matchPct');
const matchIcon         = q('matchIcon');
const matchText         = q('matchText');
const detectedPractice  = q('detectedPractice');
const successBanner     = q('successBanner');
const successLetter     = q('successLetter');
const practiceProgFill  = q('practiceProgFill');
const practiceProgText  = q('practiceProgText');

const MATCH_CIRC = 207.3;

// ── Open / Close ──────────────────────────────────────────────
function openTutorial(letterOrIndex = 0) {
  const idx = typeof letterOrIndex === 'string'
    ? TUTORIAL_LETTERS.indexOf(letterOrIndex)
    : letterOrIndex;
  tutState.open = true;
  tutState.letterIndex = Math.max(0, idx);
  tutorialBackdrop.classList.remove('hidden');
  buildTutorialNav();
  renderLearnContent(tutState.letterIndex);
  switchTutTab('learn');
}

function closeTutorialModal() {
  tutState.open = false;
  tutState.practiceHoldStart = null;
  tutorialBackdrop.classList.add('hidden');
}

tutorialBtn.addEventListener('click', () => openTutorial(tutState.letterIndex));
closeTutorial.addEventListener('click', closeTutorialModal);
tutorialBackdrop.addEventListener('click', e => {
  if (e.target === tutorialBackdrop) closeTutorialModal();
});

// ── Keyboard ──────────────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (!tutState.open) {
    if ((e.key === 'l' || e.key === 'L') && !e.ctrlKey && !e.metaKey) {
      if (!e.target.matches('input,select,textarea')) openTutorial();
    }
    return;
  }
  if (e.key === 'Escape') closeTutorialModal();
  if (e.key === 'ArrowRight') tutGoNext();
  if (e.key === 'ArrowLeft')  tutGoPrev();
}, { capture: false });

// Add L to existing keydown listener (non-conflicting — existing handler checks tutState.open)
// (already handled above via the capture flag)

// ── Tab Switching ─────────────────────────────────────────────
function switchTutTab(tab) {
  tutState.tab = tab;
  const isLearn = tab === 'learn';
  tabLearn.classList.toggle('active', isLearn);
  tabPractice.classList.toggle('active', !isLearn);
  tabLearn.setAttribute('aria-selected', isLearn);
  tabPractice.setAttribute('aria-selected', !isLearn);
  tutLearnPanel.classList.toggle('hidden', !isLearn);
  tutPracticePanel.classList.toggle('hidden', isLearn);

  if (!isLearn) renderPracticeTarget();
}

tabLearn.addEventListener('click',    () => switchTutTab('learn'));
tabPractice.addEventListener('click', () => switchTutTab('practice'));
goToPractice.addEventListener('click',() => switchTutTab('practice'));

// ── Letter Nav ────────────────────────────────────────────────
function buildTutorialNav() {
  letterNavBar.innerHTML = '';
  TUTORIAL_LETTERS.forEach((letter, i) => {
    const btn = document.createElement('button');
    btn.className = 'nav-letter-btn' + (tutState.masteredSet.has(letter) ? ' mastered' : '') + (i === tutState.letterIndex ? ' active' : '');
    btn.textContent = letter;
    btn.title = `Sign: ${letter}`;
    btn.addEventListener('click', () => {
      tutState.letterIndex = i;
      renderLearnContent(i);
      updateNavActive(i);
      if (tutState.tab === 'practice') renderPracticeTarget();
    });
    letterNavBar.appendChild(btn);
  });

  // Scroll active into view
  const activeBtn = letterNavBar.querySelectorAll('.nav-letter-btn')[tutState.letterIndex];
  activeBtn?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function updateNavActive(idx) {
  letterNavBar.querySelectorAll('.nav-letter-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === idx);
  });
  const pill = letterNavBar.querySelectorAll('.nav-letter-btn')[idx];
  pill?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
  buildProgressPills();
}

// ── Learn Content Renderer ────────────────────────────────────
function renderLearnContent(idx) {
  const letter = TUTORIAL_LETTERS[idx];
  const data   = ASL_TUTORIAL[letter];
  if (!data) return;

  // Big letter pop animation
  tutBigLetter.textContent = letter;
  tutBigLetter.classList.remove('pop');
  void tutBigLetter.offsetWidth;
  tutBigLetter.classList.add('pop');

  tutLetterName.textContent    = `Sign: ${letter}`;
  fingerDiagramWrap.innerHTML  = generateFingerDiagram(data.fingers);

  // Steps
  tutSteps.innerHTML = data.steps.map(s => `<li>${s}</li>`).join('');

  tutTip.textContent     = data.tip;
  tutMistake.textContent = data.mistake;
  tutEmoji.textContent   = data.emoji;

  // Nav state
  tutPrevBtn.disabled = idx === 0;
  tutNextBtn.disabled = idx === TUTORIAL_LETTERS.length - 1;

  buildProgressPills();
}

function buildProgressPills() {
  const total = TUTORIAL_LETTERS.length;
  // Show 7 pills max for readability
  const maxPills = Math.min(total, 9);
  const step     = Math.max(1, Math.floor(total / maxPills));
  tutProgressPills.innerHTML = '';
  for (let i = 0; i < total; i += step) {
    const pill = document.createElement('div');
    pill.className = 'tut-pill' +
      (i === tutState.letterIndex ? ' active' : '') +
      (tutState.masteredSet.has(TUTORIAL_LETTERS[i]) ? ' mastered' : '');
    tutProgressPills.appendChild(pill);
  }
}

// ── Prev / Next ───────────────────────────────────────────────
function tutGoNext() {
  if (tutState.letterIndex < TUTORIAL_LETTERS.length - 1) {
    tutState.letterIndex++;
    renderLearnContent(tutState.letterIndex);
    updateNavActive(tutState.letterIndex);
    if (tutState.tab === 'practice') {
      resetPracticeSuccess();
      renderPracticeTarget();
    }
  }
}
function tutGoPrev() {
  if (tutState.letterIndex > 0) {
    tutState.letterIndex--;
    renderLearnContent(tutState.letterIndex);
    updateNavActive(tutState.letterIndex);
    if (tutState.tab === 'practice') {
      resetPracticeSuccess();
      renderPracticeTarget();
    }
  }
}
tutPrevBtn.addEventListener('click', tutGoPrev);
tutNextBtn.addEventListener('click', tutGoNext);

// ── Practice Mode ─────────────────────────────────────────────
function renderPracticeTarget() {
  const letter = TUTORIAL_LETTERS[tutState.letterIndex];
  practiceBigLetter.textContent = letter;
  successLetter.textContent     = letter;
  resetPracticeSuccess();
  updatePracticeProgress();

  // Show/hide camera state
  const camActive = state.running;
  practiceNoCam.classList.toggle('hidden', camActive);
  practiceCamOn.classList.toggle('hidden', !camActive);
  practiceHint.textContent = camActive
    ? 'Hold the sign steady until the ring fills!'
    : 'Start the camera to begin practicing';
}

practiceStartCam.addEventListener('click', () => {
  closeTutorialModal();
  startCamera().then(() => {
    setTimeout(() => {
      openTutorial(tutState.letterIndex);
      switchTutTab('practice');
    }, 800);
  });
});

function resetPracticeSuccess() {
  tutState.practiceHoldStart     = null;
  tutState.practiceSuccessShown  = false;
  successBanner.classList.add('hidden');
  matchArc.style.strokeDashoffset = MATCH_CIRC;
  matchPct.textContent   = '0%';
  matchIcon.textContent  = '🤔';
  matchText.textContent  = 'Keep trying…';
  detectedPractice.textContent = '–';
}

function updatePracticeDetection(smoothed) {
  if (!tutState.open || tutState.tab !== 'practice') return;
  if (tutState.practiceSuccessShown) return;

  const targetLetter = TUTORIAL_LETTERS[tutState.letterIndex];
  const rawScore = smoothed.scores?.[targetLetter] || 0;
  const pct      = Math.round(rawScore * 100);

  // Update match ring
  matchArc.style.strokeDashoffset = MATCH_CIRC * (1 - rawScore);
  matchPct.textContent = pct + '%';
  detectedPractice.textContent = smoothed.letter || '–';

  // Camera visibility
  practiceNoCam.classList.toggle('hidden', true);
  practiceCamOn.classList.toggle('hidden', false);

  // Status text
  if (pct >= 80) {
    matchIcon.textContent = '🔥';
    matchText.textContent = 'So close!';
  } else if (pct >= 55) {
    matchIcon.textContent = '😊';
    matchText.textContent = 'Getting there!';
  } else if (pct >= 30) {
    matchIcon.textContent = '🤔';
    matchText.textContent = 'Keep adjusting…';
  } else {
    matchIcon.textContent = '✋';
    matchText.textContent = 'Show the sign!';
  }

  // Hold logic
  if (smoothed.letter === targetLetter && rawScore >= 0.60) {
    if (!tutState.practiceHoldStart) tutState.practiceHoldStart = Date.now();
    const elapsed = Date.now() - tutState.practiceHoldStart;
    if (elapsed >= 1000 && !tutState.practiceSuccessShown) {
      showPracticeSuccess(targetLetter);
    }
  } else {
    tutState.practiceHoldStart = null;
  }
}

function showPracticeSuccess(letter) {
  tutState.practiceSuccessShown = true;
  tutState.masteredSet.add(letter);
  successBanner.classList.remove('hidden');
  matchIcon.textContent = '🎉';
  matchText.textContent = 'Perfect!';
  matchArc.style.strokeDashoffset = 0;
  matchPct.textContent = '100%';

  if (state.soundEnabled) playConfirmSound();

  // Update nav to show mastery
  const navBtn = letterNavBar.querySelectorAll('.nav-letter-btn')[tutState.letterIndex];
  if (navBtn) navBtn.classList.add('mastered');
  buildProgressPills();
  updatePracticeProgress();

  // Auto-advance after 2.5 seconds
  setTimeout(() => {
    if (tutState.practiceSuccessShown && tutState.tab === 'practice') tutGoNext();
  }, 2500);
}

function updatePracticeProgress() {
  const total    = TUTORIAL_LETTERS.length;
  const mastered = tutState.masteredSet.size;
  const pct      = (mastered / total) * 100;
  practiceProgFill.style.width = pct + '%';
  practiceProgText.textContent = `${mastered} / ${total} mastered`;
}

// ── Hook into engine result for practice mode ─────────────────
// Wrap existing 'result' handler to also feed practice mode
engine.addEventListener('result', e => {
  if (!tutState.open || tutState.tab !== 'practice' || !e.detail.hasHand) return;
  // Use the smoothed value already computed by main handler
  // We listen AFTER the main handler fires, so smoother already ran
  // Re-apply smoother output (already saved to state via updatePredictionUI)
  // We directly re-classify and compare to target
  const { landmarks } = e.detail;
  if (!landmarks) return;
  const raw      = classifyASL(landmarks, state.mode);
  const smoothed = smoother.push(raw);
  updatePracticeDetection(smoothed);
});

// ── Wire ref-grid clicks to open tutorial ─────────────────────
// Extend the existing buildRefGrid to add click handlers
const _originalBuildRefGrid = buildRefGrid;
window._tutorialRefGrid = true; // flag so we only do this once

// Override buildRefGrid post-init to add tutorial clicks
function enhanceRefGridClicks() {
  document.querySelectorAll('.ref-item').forEach(item => {
    item.style.cursor = 'pointer';
    item.title        = `Click to learn how to sign "${item.dataset.letter}"`;
    item.addEventListener('click', () => {
      openTutorial(item.dataset.letter);
    });
  });
}

// Also add "Learn Signs" link in the reference card's collapsible header
const refCard = document.querySelector('.reference-card');
if (refCard) {
  const learnBadge = document.createElement('button');
  learnBadge.className = 'btn-sm';
  learnBadge.style.cssText = 'font-size:0.7rem;padding:0.2rem 0.55rem;margin-left:0.4rem';
  learnBadge.textContent = '📖 Learn';
  learnBadge.title = 'Open ASL Tutorial';
  learnBadge.addEventListener('click', e => { e.stopPropagation(); openTutorial(); });
  const refHeader = refCard.querySelector('.collapsible-header .collapsible-title');
  if (refHeader) refHeader.appendChild(learnBadge);
}

// Run after init builds the grid
const _origInit = init;
// Patch init to call enhanceRefGridClicks afterwards
window.addEventListener('load', () => {
  setTimeout(enhanceRefGridClicks, 1200);
});

// ══════════════════════════════════════════════════════════════
//  PHASE 1 — NLP SENTENCE POLISHER
// ══════════════════════════════════════════════════════════════
let nlpEnabled = false;
const nlpToggleBtn = q('nlpToggleBtn');

// Rule-based ASL-to-English grammar transformer
function polishSentence(raw) {
  if (!raw.trim()) return raw;
  let text = raw.toLowerCase().trim();

  // Pronoun fix
  text = text.replace(/\bme\b/g, 'i').replace(/\bmy\b/g, 'my');

  // Contraction fixes
  text = text.replace(/\bnot want\b/g, "don't want")
             .replace(/\bnot go\b/g, "am not going")
             .replace(/\bnot like\b/g, "don't like")
             .replace(/\bnot have\b/g, "don't have");

  // Verb tense / progressive
  const verbMap = {
    go:    'am going',    eat:   'am eating',   walk:  'am walking',
    run:   'am running',  want:  'want to',      like:  'like',
    have:  'have',        need:  'need',         see:   'see',
    know:  'know',        work:  'am working',   play:  'am playing',
    come:  'am coming',   help:  'need help',    buy:   'want to buy',
    drink: 'am drinking', sleep: 'am sleeping',
  };
  Object.entries(verbMap).forEach(([v, fix]) => {
    const rx = new RegExp(`\\b${v}\\b`, 'g');
    text = text.replace(rx, fix);
  });

  // Add articles before common nouns
  const nouns = ['market', 'store', 'school', 'hospital', 'doctor', 'home', 'park', 'library'];
  nouns.forEach(n => {
    text = text.replace(new RegExp(`\\b(to )(${n})\\b`, 'g'), `$1the $2`);
    text = text.replace(new RegExp(`(?<!the )\\b(${n})\\b`, 'g'), `the $1`);
  });

  // Capitalize first letter of each sentence
  text = text.replace(/(^|[.!?]\s+)([a-z])/g, (_, p, c) => p + c.toUpperCase());
  // Capitalize I
  text = text.replace(/\bi\b/g, 'I');

  return text.trim();
}

nlpToggleBtn.addEventListener('click', () => {
  nlpEnabled = !nlpEnabled;
  nlpToggleBtn.classList.toggle('active', nlpEnabled);
  nlpToggleBtn.setAttribute('aria-pressed', nlpEnabled);

  // Show/hide badge
  let badge = nlpToggleBtn.querySelector('.nlp-active-badge');
  if (nlpEnabled && !badge) {
    badge = document.createElement('span');
    badge.className = 'nlp-active-badge';
    badge.textContent = 'ON';
    nlpToggleBtn.appendChild(badge);
  } else if (!nlpEnabled && badge) {
    badge.remove();
  }

  showToast(nlpEnabled ? '🧠 NLP Polish: ON' : 'NLP Polish: OFF');
  // Re-render current sentence
  if (nlpEnabled && state.sentence) {
    rebuildSentenceOutput(true);
  } else if (!nlpEnabled && state.sentence) {
    rebuildSentenceOutput(false);
  }
});

// Patch rebuildSentenceOutput to accept nlp flag
const _origRebuild = rebuildSentenceOutput;
rebuildSentenceOutput = function(useNlp) {
  const apply = useNlp !== undefined ? useNlp : nlpEnabled;
  const displayText = apply ? polishSentence(state.sentence) : state.sentence;

  sentenceOutput.innerHTML = '';
  if (!state.sentence) {
    sentenceOutput.innerHTML = '<span class="placeholder-text">Your translated text will appear here…</span>';
    sentenceOutput.classList.remove('has-cursor');
    return;
  }
  sentenceOutput.classList.add('has-cursor');
  const span = document.createElement('span');
  span.textContent = displayText;
  sentenceOutput.appendChild(span);
  sentenceOutput.scrollTop = sentenceOutput.scrollHeight;
}

// ══════════════════════════════════════════════════════════════
//  PHASE 1 — SPEECH-TO-SIGN PLAYER
// ══════════════════════════════════════════════════════════════
const signItToggle   = q('signItToggle');
const signItChevron  = q('signItChevron');
const signItBody     = q('signItBody');
const signItInput    = q('signItInput');
const signItMicBtn   = q('signItMicBtn');
const signItRunBtn   = q('signItRunBtn');
const signPlayer     = q('signPlayer');
const signCardsRow   = q('signCardsRow');
const spCurrent      = q('spCurrent');
const spTotal        = q('spTotal');
const spPlayPause    = q('spPlayPause');
const spPrev         = q('spPrev');
const spNext         = q('spNext');
const spSpeed        = q('spSpeed');

const signItState = {
  letters:    [],  // array of {char, isSpace}
  index:      0,
  playing:    false,
  timer:      null,
};

// Toggle panel
signItToggle.addEventListener('click', () => {
  const isOpen = signItBody.classList.toggle('open');
  signItChevron.classList.toggle('open', isOpen);
  signItToggle.setAttribute('aria-expanded', isOpen);
});

// Build sign player from text
function buildSignPlayer(text) {
  if (!text.trim()) { showToast('Enter some text first'); return; }
  const upperText = text.toUpperCase();
  signItState.letters = [];

  for (const ch of upperText) {
    if (ch === ' ') {
      signItState.letters.push({ char: '⎵', isSpace: true });
    } else if (ASL_TUTORIAL[ch]) {
      signItState.letters.push({ char: ch, isSpace: false });
    }
  }

  if (!signItState.letters.length) { showToast('No signable characters found'); return; }

  signItState.index  = 0;
  signItState.playing = false;
  clearSignTimer();

  // Build cards
  signCardsRow.innerHTML = '';
  signItState.letters.forEach((item, i) => {
    const card = document.createElement('div');
    card.className = 'sign-card' + (item.isSpace ? ' space-card' : '') + (i === 0 ? ' active' : '');
    card.dataset.idx = i;

    if (item.isSpace) {
      card.innerHTML = `<div class="sc-letter">SPACE</div><div class="sc-label">word break</div>`;
    } else {
      const data = ASL_TUTORIAL[item.char];
      card.innerHTML = `
        <div class="sc-letter">${item.char}</div>
        <div class="sc-diagram">${generateFingerDiagram(data.fingers)}</div>
        <div class="sc-label">${data.steps[0].substring(0,28)}…</div>
      `;
    }
    card.addEventListener('click', () => jumpToSign(i));
    signCardsRow.appendChild(card);
  });

  spTotal.textContent = signItState.letters.length;
  spCurrent.textContent = 1;
  signPlayer.classList.remove('hidden');

  // Auto-open panel
  signItBody.classList.add('open');
  signItChevron.classList.add('open');
  signItToggle.setAttribute('aria-expanded', 'true');

  // Scroll card 0 into view
  signCardsRow.children[0]?.scrollIntoView({ block: 'nearest', inline: 'start' });
}

function jumpToSign(idx) {
  if (idx < 0 || idx >= signItState.letters.length) return;
  // Remove active
  signCardsRow.querySelectorAll('.sign-card').forEach((c, i) => {
    c.classList.toggle('active', i === idx);
  });
  signItState.index = idx;
  spCurrent.textContent = idx + 1;
  // Scroll card into view
  signCardsRow.children[idx]?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' });
}

function advanceSign() {
  if (signItState.index < signItState.letters.length - 1) {
    jumpToSign(signItState.index + 1);
  } else {
    // End of sequence
    stopSignPlayer();
    showToast('✓ Sign sequence complete!', 'success');
  }
}

function startSignPlayer() {
  signItState.playing = true;
  spPlayPause.classList.add('playing');
  spPlayPause.innerHTML = '&#9646;&#9646;';
  spPlayPause.setAttribute('aria-label', 'Pause');
  const speed = parseInt(spSpeed.value);
  signItState.timer = setInterval(advanceSign, speed);
}

function stopSignPlayer() {
  signItState.playing = false;
  spPlayPause.classList.remove('playing');
  spPlayPause.innerHTML = '&#9654;';
  spPlayPause.setAttribute('aria-label', 'Play');
  clearSignTimer();
}

function clearSignTimer() {
  if (signItState.timer) { clearInterval(signItState.timer); signItState.timer = null; }
}

spPlayPause.addEventListener('click', () => {
  if (signItState.playing) stopSignPlayer();
  else startSignPlayer();
});
spPrev.addEventListener('click', () => { stopSignPlayer(); jumpToSign(signItState.index - 1); });
spNext.addEventListener('click', () => { stopSignPlayer(); jumpToSign(signItState.index + 1); });
spSpeed.addEventListener('input', () => {
  if (signItState.playing) { stopSignPlayer(); startSignPlayer(); }
});

signItRunBtn.addEventListener('click', () => buildSignPlayer(signItInput.value));
signItInput.addEventListener('keydown', e => { if (e.key === 'Enter') signItRunBtn.click(); });

// Voice input for Sign-It
let signSpeechRecognition = null;
signItMicBtn.addEventListener('click', () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) { showToast('Speech recognition not supported in this browser', 'danger'); return; }

  if (!signSpeechRecognition) {
    signSpeechRecognition = new SpeechRecognition();
    signSpeechRecognition.lang = 'en-US';
    signSpeechRecognition.interimResults = false;
    signSpeechRecognition.maxAlternatives = 1;
    signSpeechRecognition.onresult = e => {
      const transcript = e.results[0][0].transcript;
      signItInput.value = transcript;
      signItMicBtn.classList.remove('recording');
      buildSignPlayer(transcript);
      showToast(`🎤 Got: "${transcript}"`, 'success');
    };
    signSpeechRecognition.onerror = () => signItMicBtn.classList.remove('recording');
    signSpeechRecognition.onend   = () => signItMicBtn.classList.remove('recording');
  }

  signItMicBtn.classList.add('recording');
  showToast('🎤 Listening…');
  signSpeechRecognition.start();
});

// ══════════════════════════════════════════════════════════════
//  PHASE 1 — REAL-TIME ERROR HINTS
// ══════════════════════════════════════════════════════════════
const hintBox  = q('hintBox');
const hintText = q('hintText');

// Common confused-sign pairs → actionable hint
const SIGN_HINTS = {
  'A-S': 'Move your thumb to the side of your fingers (not over them)',
  'S-A': 'Wrap thumb across the front of your curled fingers',
  'U-V': 'Keep index & middle fingers pressed tightly together',
  'V-U': 'Spread your index & middle fingers further apart',
  'B-4': 'Tuck your thumb across the palm for B',
  'D-1': 'Touch thumb to your middle, ring & pinky for D',
  'I-Y': 'Also extend your thumb outward for Y',
  'Y-I': 'Curl your thumb in — only pinky should be out for I',
  'G-L': 'Point your index sideways (not up) for G',
  'L-G': 'Keep thumb horizontal, raise index up for L',
  'R-U': 'Cross your middle finger over your index finger for R',
  'K-U': 'Bring your thumb up between the two fingers for K',
  'M-N': 'M = three fingers over thumb, N = only two',
  'N-M': 'Use only index & middle over the thumb for N',
  'E-A': 'Bend fingers into a claw (tight claw = E, fist = A)',
  'C-O': 'Open the curve more — O is fully closed, C has a gap',
  'F-9': 'Keep middle, ring & pinky pointing straight up for F',
  'H-G': 'Both index AND middle should point sideways for H',
  'P-K': 'Tilt your wrist down — the K shape pointing at the floor = P',
  'Q-G': 'Tilt wrist down so both index & thumb point at the floor for Q',
};

let lastHintKey    = null;
let hintHideTimer  = null;

function updateHintBox(scores) {
  // Only show hints when there's a close second-place candidate
  const entries = Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  if (entries.length < 2) { hideHint(); return; }

  const [topLetter, topScore] = entries[0];
  const [runnerUp]            = entries[1];
  const gap = topScore - entries[1][1];

  // Hint zone: top score 0.35–0.65, gap < 0.15
  if (topScore < 0.35 || topScore > 0.68 || gap > 0.16) { hideHint(); return; }

  const key1 = `${topLetter}-${runnerUp}`;
  const key2 = `${runnerUp}-${topLetter}`;
  const hint  = SIGN_HINTS[key1] || SIGN_HINTS[key2];
  if (!hint) { hideHint(); return; }

  const hintKey = key1;
  if (hintKey !== lastHintKey) {
    lastHintKey = hintKey;
    hintText.textContent = hint;
    hintBox.classList.remove('hidden');
    clearTimeout(hintHideTimer);
    hintHideTimer = setTimeout(hideHint, 5000);
  }
}

function hideHint() {
  hintBox.classList.add('hidden');
  lastHintKey = null;
}

// Inject hint updates into the existing engine result event
engine.addEventListener('result', e => {
  if (!e.detail.hasHand) { hideHint(); return; }
  // The smoother has already been called by the primary handler.
  // Access current scores from the smoother's last output.
  const snap = smoother.getSnapshot?.();
  if (snap?.scores) updateHintBox(snap.scores);
});

// ══════════════════════════════════════════════════════════════
//  PHASE 1 — REFERENCE DICTIONARY SEARCH
// ══════════════════════════════════════════════════════════════
const refSearch     = q('refSearch');
const refMatchCount = q('refMatchCount');

refSearch.addEventListener('input', () => {
  const term = refSearch.value.trim().toUpperCase();
  const items = refGrid.querySelectorAll('.ref-item');
  let visible = 0;
  items.forEach(item => {
    const letter = item.dataset.letter || '';
    const desc   = (item.querySelector('.ref-desc')?.textContent || '').toUpperCase();
    const match  = !term || letter.startsWith(term) || desc.includes(term);
    item.classList.toggle('hidden', !match);
    if (match) visible++;
  });
  refMatchCount.textContent = term ? `${visible} match${visible !== 1 ? 'es' : ''}` : '';
});

// ══════════════════════════════════════════════════════════════
//  PHASE 1 — GAMIFIED TUTORIAL LEVELS + XP
// ══════════════════════════════════════════════════════════════
const LEVELS = {
  beginner:     { label: '🌱 Beginner',     letters: ['A','B','C','D','E','F','G','H','I'], color: '#22c55e', xpPer: 10 },
  intermediate: { label: '🔥 Intermediate', letters: ['J','K','L','M','N','O','P','Q','R'], color: '#f59e0b', xpPer: 15 },
  advanced:     { label: '⚡ Advanced',     letters: ['S','T','U','V','W','X','Y','Z'],     color: '#ef4444', xpPer: 20 },
};

const xpState = {
  xp:          parseInt(AppStorage.get('tutXP') || '0'),
  level:       AppStorage.get('tutLevel') || 'all',
};

// Inject level row + XP bar into tutorial modal header
function injectTutorialLevelUI() {
  const footer = q('tutorial-footer') || document.querySelector('.tutorial-footer');
  const header  = document.querySelector('.tutorial-modal-header');
  if (!header || document.getElementById('tutLevelRow')) return;

  // Level filter row
  const levelRow = document.createElement('div');
  levelRow.className = 'tut-level-row';
  levelRow.id = 'tutLevelRow';
  levelRow.innerHTML = `
    <span style="font-size:0.7rem;color:var(--text-sub);font-weight:700;margin-right:0.25rem">Filter:</span>
    <button class="level-badge${xpState.level === 'all' ? '' : ''}" data-level="all">All</button>
    <button class="level-badge beginner${xpState.level === 'beginner' ? ' active' : ''}" data-level="beginner">🌱 A–I</button>
    <button class="level-badge intermediate${xpState.level === 'intermediate' ? ' active' : ''}" data-level="intermediate">🔥 J–R</button>
    <button class="level-badge advanced${xpState.level === 'advanced' ? ' active' : ''}" data-level="advanced">⚡ S–Z</button>
    <span style="flex:1"></span>
    <button class="level-badge" id="dailyChallengeBtn" title="Random sign challenge">🎲 Daily</button>
  `;

  // XP row
  const xpRow = document.createElement('div');
  xpRow.className = 'xp-bar-row';
  xpRow.id = 'xpBarRow';
  const xpMax  = 260; // 26 letters × 10 avg
  const xpPct  = Math.min((xpState.xp / xpMax) * 100, 100);
  xpRow.innerHTML = `
    <span class="xp-level-name" id="xpLevelName">${getLevelName(xpState.xp)}</span>
    <div class="xp-bar"><div class="xp-fill" id="xpFill" style="width:${xpPct}%"></div></div>
    <span class="xp-label" id="xpLabel">${xpState.xp} XP</span>
  `;

  // Insert after header
  header.after(xpRow);
  xpRow.before(levelRow);
  // Actually put levelRow after the letter-nav-bar
  const navBar = q('letterNavBar');
  if (navBar) navBar.after(levelRow);
  navBar.after(xpRow);

  // Wire level badges
  levelRow.querySelectorAll('.level-badge[data-level]').forEach(btn => {
    btn.addEventListener('click', () => {
      xpState.level = btn.dataset.level;
      AppStorage.set('tutLevel', xpState.level);
      levelRow.querySelectorAll('.level-badge[data-level]').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      filterTutorialByLevel(xpState.level);
    });
  });

  // Daily challenge
  q('dailyChallengeBtn')?.addEventListener('click', () => {
    const letters = Object.keys(ASL_TUTORIAL);
    const rand    = letters[Math.floor(Math.random() * letters.length)];
    showToast(`🎲 Today's challenge: Sign "${rand}"!`);
    openTutorial(rand);
    setTimeout(() => switchTutTab('practice'), 400);
  });
}

function getLevelName(xp) {
  if (xp >= 200) return '⚡ Expert';
  if (xp >= 100) return '🔥 Intermediate';
  if (xp >= 40)  return '🌱 Beginner';
  return '🐣 Newcomer';
}

function filterTutorialByLevel(level) {
  const allowed = level === 'all' ? null : LEVELS[level]?.letters;
  const navBtns = document.querySelectorAll('.nav-letter-btn');
  navBtns.forEach(btn => {
    const visible = !allowed || allowed.includes(btn.textContent.trim());
    btn.style.display = visible ? '' : 'none';
  });
  // Jump to first visible letter if current is filtered out
  if (allowed && !allowed.includes(TUTORIAL_LETTERS[tutState.letterIndex])) {
    const firstIdx = TUTORIAL_LETTERS.findIndex(l => allowed.includes(l));
    if (firstIdx >= 0) {
      tutState.letterIndex = firstIdx;
      renderLearnContent(firstIdx);
      updateNavActive(firstIdx);
    }
  }
}

// Award XP when a sign is mastered in practice mode
const _origShowPracticeSuccess = showPracticeSuccess;
function awardXP(letter) {
  // Find which level this letter belongs to
  let xpGain = 10;
  Object.values(LEVELS).forEach(lv => {
    if (lv.letters.includes(letter)) xpGain = lv.xpPer;
  });
  xpState.xp += xpGain;
  AppStorage.set('tutXP', xpState.xp);
  updateXPUI(xpGain);
}

function updateXPUI(gained) {
  const xpFill      = q('xpFill');
  const xpLabel     = q('xpLabel');
  const xpLevelName = q('xpLevelName');
  if (!xpFill) return;
  const xpMax = 260;
  const pct   = Math.min((xpState.xp / xpMax) * 100, 100);
  xpFill.style.width = pct + '%';
  xpLabel.textContent = `${xpState.xp} XP`;
  xpLevelName.textContent = getLevelName(xpState.xp);
  if (gained) showToast(`+${gained} XP earned! 🎉`, 'success');
}

// Patch showPracticeSuccess to also award XP
engine.addEventListener('result', () => {}); // placeholder to ensure order
// We hook into the tutState mastered set via the existing showPracticeSuccess

// Use MutationObserver to detect when tutorial opens and inject level UI
const tutObs = new MutationObserver(() => {
  if (!tutorialBackdrop.classList.contains('hidden')) {
    injectTutorialLevelUI();
    if (xpState.level !== 'all') filterTutorialByLevel(xpState.level);
  }
});
tutObs.observe(tutorialBackdrop, { attributes: true, attributeFilter: ['class'] });

// Patch mastery to award XP (since showPracticeSuccess is already defined in tutorial section)
// Intercept via the masteredSet size change
let prevMasteredSize = 0;
setInterval(() => {
  if (tutState.masteredSet.size > prevMasteredSize) {
    const diff = tutState.masteredSet.size - prevMasteredSize;
    const masteredArr = [...tutState.masteredSet];
    const newest = masteredArr[masteredArr.length - 1];
    for (let i = 0; i < diff; i++) awardXP(newest);
    prevMasteredSize = tutState.masteredSet.size;
  }
}, 500);

// ══════════════════════════════════════════════════════════════
//  PHASE 1 — DAILY CHALLENGE BADGE IN HEADER
// ══════════════════════════════════════════════════════════════
(function addDailyChallenge() {
  const today    = new Date().toDateString();
  const lastDay  = AppStorage.get('challengeDay')  || '';
  const daily    = AppStorage.get('challengeLetter') || '';

  let todayLetter;
  if (lastDay === today && daily) {
    todayLetter = daily;
  } else {
    const letters   = Object.keys(ASL_TUTORIAL);
    todayLetter     = letters[Math.floor(Math.random() * letters.length)];
    AppStorage.set('challengeDay',    today);
    AppStorage.set('challengeLetter', todayLetter);
  }

  // Add small badge in header near logo
  const logo = document.querySelector('.logo-text');
  if (logo && todayLetter) {
    const pill = document.createElement('span');
    pill.className = 'badge-new';
    pill.style.cssText = 'cursor:pointer;font-size:0.62rem;';
    pill.textContent   = `🎲 Daily: ${todayLetter}`;
    pill.title         = `Today's challenge: Sign "${todayLetter}"`;
    pill.addEventListener('click', () => {
      openTutorial(todayLetter);
      setTimeout(() => switchTutTab('practice'), 400);
    });
    logo.parentElement.appendChild(pill);
  }
})();

