// Client-side image resize for avatar uploads.
// Reads a File, decodes via <img>, draws the centred square crop into a 256×256
// canvas, exports JPEG. No server-side image libraries required.

const TARGET_SIZE = 256;
const QUALITY = 0.85;

/**
 * @param {File|Blob} file
 * @returns {Promise<string>} JPEG data URL (~20–30 KB)
 */
export function resizeToAvatarDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file || !file.type?.startsWith('image/')) {
      reject(new Error('Не похоже на картинку'));
      return;
    }

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      try {
        const { naturalWidth: w, naturalHeight: h } = img;
        if (!w || !h) { reject(new Error('Не удалось прочитать картинку')); return; }

        // Centred square crop, then scale to TARGET_SIZE.
        const side = Math.min(w, h);
        const sx = (w - side) / 2;
        const sy = (h - side) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = TARGET_SIZE;
        canvas.height = TARGET_SIZE;
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, sx, sy, side, side, 0, 0, TARGET_SIZE, TARGET_SIZE);

        const dataUrl = canvas.toDataURL('image/jpeg', QUALITY);
        URL.revokeObjectURL(url);
        resolve(dataUrl);
      } catch (e) {
        URL.revokeObjectURL(url);
        reject(e);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Не удалось загрузить картинку'));
    };
    img.src = url;
  });
}
