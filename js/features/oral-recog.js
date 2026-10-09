/* ============================================================
 *  oral-recog.js · 英语口语识别封装
 *  - 能力探测：仅 Chromium 系支持，且国内可能网络超时
 *  - 任何失败都自动降级（由页面切到"跟读自评"模式）
 * ============================================================ */

const SR = window.SpeechRecognition || window.webkitSpeechRecognition;

export function recognitionSupported() {
  return !!SR;
}

/**
 * 录音识别一段话
 * @returns Promise<{text, error}> error 存在时表示失败（调用方降级）
 */
export function recognizeOnce(lang = 'en-US', timeoutMs = 8000) {
  return new Promise((resolve) => {
    if (!SR) { resolve({ text: '', error: 'unsupported' }); return; }

    let rec;
    try {
      rec = new SR();
    } catch (e) {
      resolve({ text: '', error: 'init-failed' });
      return;
    }

    rec.lang = lang;
    rec.interimResults = false;
    rec.maxAlternatives = 1;
    rec.continuous = false;

    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      try { rec.stop(); } catch { /* ignore */ }
      clearTimeout(timer);
      resolve(result);
    };

    const timer = setTimeout(() => finish({ text: '', error: 'timeout' }), timeoutMs);

    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript || '';
      finish({ text, error: null });
    };
    rec.onerror = (e) => {
      // not-allowed: 麦克风权限；network: 走了网络服务失败（国内常见）
      finish({ text: '', error: e.error || 'error' });
    };
    rec.onend = () => {
      // 没有 onresult 就结束 = 没听到
      finish({ text: '', error: 'no-speech' });
    };

    try {
      rec.start();
    } catch (e) {
      finish({ text: '', error: 'start-failed' });
    }
  });
}
