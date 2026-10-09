/* ============================================================
 *  storage-guard.js · 存储守卫
 *  - 图片压缩（最长边 1280 / JPEG 0.7）后再入库，控制体积
 *  - 配额预警（navigator.storage.estimate）
 * ============================================================ */

const MAX_EDGE = 1280;
const QUALITY = 0.7;

/** canvas 压缩为 dataURL（超大图缩到 1280 边内） */
export function compressCanvas(canvas) {
  let { width: w, height: h } = canvas;
  const long = Math.max(w, h);
  if (long > MAX_EDGE) {
    const k = MAX_EDGE / long;
    w = Math.round(w * k);
    h = Math.round(h * k);
  }
  if (w === canvas.width && h === canvas.height) {
    return canvas.toDataURL('image/jpeg', QUALITY);
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(canvas, 0, 0, w, h);
  return out.toDataURL('image/jpeg', QUALITY);
}

/** 估算当前存档体积（KB） */
export function usageKB() {
  try {
    const raw = localStorage.getItem('ai-school-v1') || '';
    return Math.round(raw.length / 1024);
  } catch {
    return 0;
  }
}

/**
 * 配额检查：接近上限时通过事件提示用户清理
 * 返回 {supported, usage, quota} 或 null
 */
export async function checkQuota() {
  if (!navigator.storage?.estimate) return null;
  try {
    const { usage = 0, quota = 0 } = await navigator.storage.estimate();
    if (quota && usage / quota > 0.75) {
      window.dispatchEvent(new CustomEvent('aischool:error', {
        detail: '浏览器存储空间快满了（' + Math.round(usage / quota * 100) + '%）。请到「AI 学习课桌」删除或清理已导出的试卷。',
      }));
    }
    return { usage, quota };
  } catch {
    return null;
  }
}
