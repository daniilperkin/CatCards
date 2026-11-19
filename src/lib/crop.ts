export type Rotation = 0 | 90 | 180 | 270;

/** Normalized crop rectangle in [0, 1] coordinates of the oriented image. */
export interface CropRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type DragHandle = 'move' | 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

export interface PixelCrop {
  x: number;
  y: number;
  width: number;
  height: number;
}

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));

export function isFullCrop(rect: CropRect, epsilon = 1e-4): boolean {
  return (
    Math.abs(rect.x) <= epsilon &&
    Math.abs(rect.y) <= epsilon &&
    Math.abs(rect.w - 1) <= epsilon &&
    Math.abs(rect.h - 1) <= epsilon
  );
}

export function isIdentityCrop(rect: CropRect, rotation: Rotation): boolean {
  return rotation === 0 && isFullCrop(rect);
}

export function orientedSize(
  naturalWidth: number,
  naturalHeight: number,
  rotation: Rotation,
): { width: number; height: number } {
  return rotation % 180 === 0
    ? { width: naturalWidth, height: naturalHeight }
    : { width: naturalHeight, height: naturalWidth };
}

export function fitBox(
  contentW: number,
  contentH: number,
  availW: number,
  availH: number,
): { width: number; height: number; scale: number } {
  if (contentW <= 0 || contentH <= 0 || availW <= 0 || availH <= 0) {
    return { width: 0, height: 0, scale: 0 };
  }
  const scale = Math.min(availW / contentW, availH / contentH);
  return { width: contentW * scale, height: contentH * scale, scale };
}

export function nextRotationCW(rotation: Rotation): Rotation {
  return ((rotation + 90) % 360) as Rotation;
}

/** Rotates a normalized crop rectangle 90° clockwise along with the image. */
export function rotateCropCW(rect: CropRect): CropRect {
  return {
    x: clamp(1 - rect.y - rect.h, 0, 1),
    y: clamp(rect.x, 0, 1),
    w: clamp(rect.h, 0, 1),
    h: clamp(rect.w, 0, 1),
  };
}

/**
 * Applies a pointer drag delta (in normalized [0, 1] image coordinates) to a starting crop rect.
 * Always keeps the rectangle inside [0, 1]² and at least minW × minH.
 */
export function applyDrag(
  start: CropRect,
  handle: DragHandle,
  dxNorm: number,
  dyNorm: number,
  minW: number,
  minH: number,
): CropRect {
  if (handle === 'move') {
    return {
      x: clamp(start.x + dxNorm, 0, Math.max(0, 1 - start.w)),
      y: clamp(start.y + dyNorm, 0, Math.max(0, 1 - start.h)),
      w: start.w,
      h: start.h,
    };
  }

  const effMinW = clamp(minW, 0, 1);
  const effMinH = clamp(minH, 0, 1);

  const touchesX = handle.includes('w') || handle.includes('e');
  const touchesY = handle.includes('n') || handle.includes('s');

  let x = start.x;
  let w = start.w;
  if (touchesX) {
    let left = start.x;
    let right = start.x + start.w;
    if (handle.includes('w')) left = clamp(start.x + dxNorm, 0, right - effMinW);
    if (handle.includes('e')) right = clamp(start.x + start.w + dxNorm, left + effMinW, 1);
    x = left;
    w = right - left;
  }

  let y = start.y;
  let h = start.h;
  if (touchesY) {
    let top = start.y;
    let bottom = start.y + start.h;
    if (handle.includes('n')) top = clamp(start.y + dyNorm, 0, bottom - effMinH);
    if (handle.includes('s')) bottom = clamp(start.y + start.h + dyNorm, top + effMinH, 1);
    y = top;
    h = bottom - top;
  }

  return { x, y, w, h };
}

/** Converts a normalized crop rectangle to clamped integer source pixels (no downscaling). */
export function toPixelCrop(rect: CropRect, effWidth: number, effHeight: number): PixelCrop {
  const maxW = Math.max(1, Math.round(effWidth));
  const maxH = Math.max(1, Math.round(effHeight));
  const x = clamp(Math.round(rect.x * maxW), 0, maxW - 1);
  const y = clamp(Math.round(rect.y * maxH), 0, maxH - 1);
  const right = clamp(Math.round((rect.x + rect.w) * maxW), x + 1, maxW);
  const bottom = clamp(Math.round((rect.y + rect.h) * maxH), y + 1, maxH);
  return { x, y, width: right - x, height: bottom - y };
}

/**
 * Exact integer 2D canvas transform [a, b, c, d, e, f] that maps source pixels (0..natW, 0..natH)
 * directly into the cropped output canvas (0..crop.width, 0..crop.height) after CW rotation.
 */
export function canvasTransform(
  natW: number,
  natH: number,
  crop: PixelCrop,
  rotation: Rotation,
): [number, number, number, number, number, number] {
  switch (rotation) {
    case 0:
      return [1, 0, 0, 1, -crop.x, -crop.y];
    case 90:
      return [0, 1, -1, 0, natH - crop.x, -crop.y];
    case 180:
      return [-1, 0, 0, -1, natW - crop.x, natH - crop.y];
    case 270:
      return [0, -1, 1, 0, -crop.x, natW - crop.y];
  }
}

export function outputMimeType(inputType: string): 'image/png' | 'image/webp' | 'image/jpeg' {
  if (inputType === 'image/png') return 'image/png';
  if (inputType === 'image/webp') return 'image/webp';
  return 'image/jpeg';
}

function loadImageElement(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to decode image'));
    };
    img.src = url;
  });
}

/**
 * Crops (and optionally rotates) an image Blob at full original source pixel resolution.
 * Returns the original Blob untouched when the crop is the full unrotated image.
 */
export async function cropImageBlob(
  source: Blob,
  rect: CropRect,
  rotation: Rotation = 0,
  loadedImage?: HTMLImageElement | null,
): Promise<Blob> {
  if (isIdentityCrop(rect, rotation)) return source;

  const img = loadedImage?.complete && loadedImage.naturalWidth > 0 ? loadedImage : await loadImageElement(source);

  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (natW <= 0 || natH <= 0) throw new Error('Image has invalid dimensions');

  const eff = orientedSize(natW, natH, rotation);
  const pixelCrop = toPixelCrop(rect, eff.width, eff.height);

  // If rounding snapped back to the entire unrotated image, return the untouched original.
  if (
    rotation === 0 &&
    pixelCrop.x === 0 &&
    pixelCrop.y === 0 &&
    pixelCrop.width === natW &&
    pixelCrop.height === natH
  ) {
    return source;
  }

  const canvas = document.createElement('canvas');
  canvas.width = pixelCrop.width;
  canvas.height = pixelCrop.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context unavailable');

  const mime = outputMimeType(source.type);
  if (mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  const [a, b, c, d, e, f] = canvasTransform(natW, natH, pixelCrop, rotation);
  ctx.setTransform(a, b, c, d, e, f);
  ctx.drawImage(img, 0, 0);

  const quality = mime === 'image/png' ? undefined : 0.95;
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, quality));
  if (!blob) throw new Error('Failed to encode cropped image');
  return blob;
}
