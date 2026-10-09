/* ============================================================
 *  camera.js · 摄像头 / 屏幕截图 / 示例卷取图
 *  - enumerateDevices 列出外接与内置摄像头供选择
 *  - getUserMedia 实时取景 → capture() 拍照
 *  - getDisplayMedia 屏幕截图（截完立即停止共享）
 *  - 失败时给出中文引导，永不阻断批改流程
 * ============================================================ */

let currentStream = null;

/** 列出所有摄像头（label 需授权一次才有，函数内自动处理） */
export async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return [];
  // 先开一次流拿到 label（浏览器隐私保护）
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true });
    tmp.getTracks().forEach((t) => t.stop());
  } catch { /* 被拒绝也没关系，下面返回空 label */ }
  const devices = await navigator.mediaDevices.enumerateDevices();
  return devices
    .filter((d) => d.kind === 'videoinput')
    .map((d, i) => ({
      deviceId: d.deviceId,
      label: d.label || `摄像头 ${i + 1}`,
    }));
}

/** 打开摄像头到 video 元素；失败抛出中文错误信息 */
export async function openCamera(videoEl, deviceId) {
  stopCamera(videoEl);
  const constraints = {
    video: deviceId
      ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 960 } }
      : { width: { ideal: 1280 }, height: { ideal: 960 } },
    audio: false,
  };
  try {
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
  } catch (e) {
    throw new Error(cameraErrorText(e));
  }
  videoEl.srcObject = currentStream;
  await videoEl.play().catch(() => {});
  return currentStream;
}

export function stopCamera(videoEl) {
  if (currentStream) {
    currentStream.getTracks().forEach((t) => t.stop());
    currentStream = null;
  }
  if (videoEl) videoEl.srcObject = null;
}

export function cameraErrorText(e) {
  const name = e && e.name;
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError') {
    return '摄像头权限被拒绝了。请点击地址栏左侧的锁/相机图标 → 允许摄像头 → 刷新页面重试。';
  }
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError') {
    return '没有找到摄像头设备。可以改用「屏幕截图」或「示例试卷」。';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return '摄像头被其他程序占用（比如视频会议没关）。关掉其他程序后重试。';
  }
  if (!window.isSecureContext) {
    return '浏览器只允许在 http/localhost 下使用摄像头，请通过 start.bat 启动后再试。';
  }
  return '摄像头打开失败：' + (e && e.message ? e.message : e);
}

/** 把 video 当前帧拍成 canvas */
export function capture(videoEl) {
  const w = videoEl.videoWidth || 1280;
  const h = videoEl.videoHeight || 960;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  canvas.getContext('2d').drawImage(videoEl, 0, 0, w, h);
  return canvas;
}

/** 屏幕截图：弹系统共享选择框，取第一帧后立即停止共享 */
export async function grabScreen() {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    throw new Error('当前浏览器不支持屏幕截图，请改用摄像头或示例试卷。');
  }
  let stream;
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
  } catch (e) {
    if (e && (e.name === 'NotAllowedError' || e.name === 'AbortError')) {
      throw new Error('你取消了屏幕共享。');
    }
    throw new Error('屏幕截图失败：' + (e.message || e));
  }
  const video = document.createElement('video');
  video.muted = true;
  video.srcObject = stream;
  await video.play().catch(() => {});
  // 等一帧解码完成
  await new Promise((r) => setTimeout(r, 300));
  const canvas = capture(video);
  stream.getTracks().forEach((t) => t.stop());  // 立即结束共享
  return canvas;
}
