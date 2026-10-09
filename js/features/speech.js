/* ============================================================
 *  speech.js · 真人语音（浏览器语音合成 speechSynthesis）
 *  - speak(text, lang) 朗读（中文老师讲解 / 英文范读）
 *  - 停止、可用音色探测
 * ============================================================ */

let voicesCache = [];

function loadVoices() {
  if (!window.speechSynthesis) return;
  voicesCache = window.speechSynthesis.getVoices() || [];
}

if (window.speechSynthesis) {
  loadVoices();
  window.speechSynthesis.onvoiceschanged = loadVoices;
}

export function speechSupported() {
  return !!window.speechSynthesis;
}

/** 选一个匹配 lang 的音色 */
function pickVoice(lang) {
  if (!voicesCache.length) loadVoices();
  const want = lang.startsWith('zh') ? 'zh' : 'en';
  return voicesCache.find((v) => v.lang.toLowerCase().startsWith(want)) || null;
}

/**
 * 朗读文本
 * @param text  文本
 * @param lang  'zh-CN' | 'en-US'
 * @returns Promise：朗读结束 resolve
 */
export function speak(text, lang = 'zh-CN') {
  if (!window.speechSynthesis || !text) {
    return Promise.resolve(false);
  }
  return new Promise((resolve) => {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = lang.startsWith('zh') ? 1 : 0.95;
    u.pitch = 1;
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    window.speechSynthesis.speak(u);
    // 兜底：部分浏览器 onend 不触发
    setTimeout(() => resolve(true), Math.min(15000, 1200 + text.length * 90));
  });
}

export function stopSpeak() {
  if (window.speechSynthesis) window.speechSynthesis.cancel();
}
