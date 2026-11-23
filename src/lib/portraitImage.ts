const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB source limit
const MAX_DATA_URL_LENGTH = 160_000; // ~115 KB binary JPEG safety bound
const TARGET_SIZE_PX = 240;

export function isValidPortraitDataUrl(value?: string | null): value is string {
  if (typeof value !== 'string') return false;
  if (value.length === 0 || value.length > MAX_DATA_URL_LENGTH) return false;
  return /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(value);
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
      } else {
        reject(new Error('Unable to read image file.'));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file.'));
    reader.readAsDataURL(file);
  });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
    img.src = src;
  });
}

/**
 * Downscales and center-crops a portrait photo client-side into a compact JPEG Data URL
 * before AES-256-GCM encryption inside the member's SensitiveMemberPayload.
 */
export async function compressImageToPortraitDataUrl(file: File): Promise<string> {
  if (!ALLOWED_MIME_TYPES.has(file.type)) {
    throw new Error('Please choose a JPEG, PNG, or WebP portrait image.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('Image file exceeds 10 MB upload limit.');
  }

  const rawDataUrl = await readFileAsDataUrl(file);
  const img = await loadHtmlImage(rawDataUrl);
  const srcW = img.naturalWidth || img.width;
  const srcH = img.naturalHeight || img.height;
  if (!srcW || !srcH) {
    throw new Error('Unable to determine image dimensions.');
  }

  // Center-crop to square
  const cropSide = Math.min(srcW, srcH);
  const sx = Math.max(0, Math.floor((srcW - cropSide) / 2));
  const sy = Math.max(0, Math.floor((srcH - cropSide) / 2));

  const outSide = Math.min(TARGET_SIZE_PX, cropSide);
  const canvas = document.createElement('canvas');
  canvas.width = outSide;
  canvas.height = outSide;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas 2D processing is unavailable in this browser.');
  }

  // Soft archival warm paper matte behind transparent PNGs
  ctx.fillStyle = '#FBF9F5';
  ctx.fillRect(0, 0, outSide, outSide);
  ctx.drawImage(img, sx, sy, cropSide, cropSide, 0, 0, outSide, outSide);

  let dataUrl = canvas.toDataURL('image/jpeg', 0.78);
  if (dataUrl.length > 90_000) {
    dataUrl = canvas.toDataURL('image/jpeg', 0.62);
  }
  if (dataUrl.length > MAX_DATA_URL_LENGTH) {
    const smallCanvas = document.createElement('canvas');
    smallCanvas.width = 160;
    smallCanvas.height = 160;
    const sCtx = smallCanvas.getContext('2d');
    if (sCtx) {
      sCtx.fillStyle = '#FBF9F5';
      sCtx.fillRect(0, 0, 160, 160);
      sCtx.drawImage(canvas, 0, 0, 160, 160);
      dataUrl = smallCanvas.toDataURL('image/jpeg', 0.58);
    }
  }

  if (!isValidPortraitDataUrl(dataUrl)) {
    throw new Error('Compressed portrait exceeds maximum encrypted record budget.');
  }
  return dataUrl;
}
