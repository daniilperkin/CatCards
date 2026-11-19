import { describe, expect, it } from 'vitest';
import {
  applyDrag,
  canvasTransform,
  cropImageBlob,
  FULL_CROP,
  fitBox,
  isFullCrop,
  isIdentityCrop,
  nextRotationCW,
  orientedSize,
  outputMimeType,
  rotateCropCW,
  toPixelCrop,
} from './crop';

function applyMatrix(m: [number, number, number, number, number, number], x: number, y: number): [number, number] {
  const [a, b, c, d, e, f] = m;
  return [a * x + c * y + e, b * x + d * y + f];
}

describe('crop', () => {
  it('identifies full and identity crops', () => {
    expect(isFullCrop(FULL_CROP)).toBe(true);
    expect(isIdentityCrop(FULL_CROP, 0)).toBe(true);
    expect(isIdentityCrop(FULL_CROP, 90)).toBe(false);
    expect(isFullCrop({ x: 0.1, y: 0, w: 0.9, h: 1 })).toBe(false);
  });

  it('computes oriented size and fitted display box', () => {
    expect(orientedSize(4000, 3000, 0)).toEqual({ width: 4000, height: 3000 });
    expect(orientedSize(4000, 3000, 90)).toEqual({ width: 3000, height: 4000 });
    expect(orientedSize(4000, 3000, 180)).toEqual({ width: 4000, height: 3000 });
    expect(orientedSize(4000, 3000, 270)).toEqual({ width: 3000, height: 4000 });

    expect(fitBox(4000, 2000, 300, 500)).toEqual({ width: 300, height: 150, scale: 0.075 });
    expect(fitBox(2000, 4000, 300, 500)).toEqual({ width: 250, height: 500, scale: 0.125 });
    expect(fitBox(0, 100, 300, 500)).toEqual({ width: 0, height: 0, scale: 0 });
  });

  it('rotates crop rectangles 90° clockwise and returns to original after 4 rotations', () => {
    expect(nextRotationCW(0)).toBe(90);
    expect(nextRotationCW(90)).toBe(180);
    expect(nextRotationCW(180)).toBe(270);
    expect(nextRotationCW(270)).toBe(0);

    const start = { x: 0.1, y: 0.2, w: 0.3, h: 0.4 };
    const r1 = rotateCropCW(start);
    expect(r1.x).toBeCloseTo(0.4);
    expect(r1.y).toBeCloseTo(0.1);
    expect(r1.w).toBeCloseTo(0.4);
    expect(r1.h).toBeCloseTo(0.3);

    const r4 = rotateCropCW(rotateCropCW(rotateCropCW(r1)));
    expect(r4.x).toBeCloseTo(start.x);
    expect(r4.y).toBeCloseTo(start.y);
    expect(r4.w).toBeCloseTo(start.w);
    expect(r4.h).toBeCloseTo(start.h);
  });

  it('moves crop rectangle while preserving dimensions and clamping to bounds', () => {
    const start = { x: 0.2, y: 0.3, w: 0.4, h: 0.5 };
    expect(applyDrag(start, 'move', 0.1, -0.1, 0.1, 0.1)).toEqual({
      x: expect.closeTo(0.3),
      y: expect.closeTo(0.2),
      w: 0.4,
      h: 0.5,
    });
    expect(applyDrag(start, 'move', 0.9, 0.9, 0.1, 0.1)).toEqual({
      x: expect.closeTo(0.6),
      y: expect.closeTo(0.5),
      w: 0.4,
      h: 0.5,
    });
    expect(applyDrag(start, 'move', -0.9, -0.9, 0.1, 0.1)).toEqual({
      x: 0,
      y: 0,
      w: 0.4,
      h: 0.5,
    });
  });

  it('resizes from corners and edges with boundary and minimum-size clamping', () => {
    const start = { x: 0.2, y: 0.2, w: 0.5, h: 0.5 };

    // Drag NW past SE corner: stops at minW / minH without inverting
    const nwPast = applyDrag(start, 'nw', 0.9, 0.9, 0.15, 0.2);
    expect(nwPast.x).toBeCloseTo(0.55);
    expect(nwPast.y).toBeCloseTo(0.5);
    expect(nwPast.w).toBeCloseTo(0.15);
    expect(nwPast.h).toBeCloseTo(0.2);

    // Drag SE past image bounds: clamps to 1
    const sePast = applyDrag(start, 'se', 0.8, 0.8, 0.1, 0.1);
    expect(sePast.x).toBeCloseTo(0.2);
    expect(sePast.y).toBeCloseTo(0.2);
    expect(sePast.w).toBeCloseTo(0.8);
    expect(sePast.h).toBeCloseTo(0.8);

    // Single-axis edge drags only change their edge
    const east = applyDrag(start, 'e', -0.1, 0.4, 0.1, 0.1);
    expect(east).toEqual({ x: 0.2, y: 0.2, w: expect.closeTo(0.4), h: 0.5 });

    const north = applyDrag(start, 'n', 0.4, -0.5, 0.1, 0.1);
    expect(north).toEqual({ x: 0.2, y: 0, w: 0.5, h: expect.closeTo(0.7) });
  });

  it('converts normalized crops to exact full-resolution pixel coordinates', () => {
    expect(toPixelCrop(FULL_CROP, 4032, 3024)).toEqual({ x: 0, y: 0, width: 4032, height: 3024 });
    expect(toPixelCrop({ x: 0.25, y: 0.5, w: 0.5, h: 0.25 }, 4000, 2000)).toEqual({
      x: 1000,
      y: 1000,
      width: 2000,
      height: 500,
    });
    // Tiny crop still produces at least 1×1 inside bounds
    expect(toPixelCrop({ x: 0.9999, y: 0.9999, w: 0.0001, h: 0.0001 }, 100, 100)).toEqual({
      x: 99,
      y: 99,
      width: 1,
      height: 1,
    });
  });

  it('maps rotated source quadrants into cropped output canvas coordinates accurately', () => {
    const natW = 400;
    const natH = 200;

    // 0°: top-left (0..200, 0..100) stays at (0..200, 0..100)
    const m0 = canvasTransform(natW, natH, { x: 50, y: 20, width: 100, height: 80 }, 0);
    expect(applyMatrix(m0, 50, 20)).toEqual([0, 0]);
    expect(applyMatrix(m0, 150, 100)).toEqual([100, 80]);

    // 90° CW: oriented size is 200×400; original bottom-left (0, 200) moves to oriented (0, 0)
    const m90 = canvasTransform(natW, natH, { x: 0, y: 0, width: 100, height: 200 }, 90);
    expect(applyMatrix(m90, 0, 200)).toEqual([0, 0]);
    expect(applyMatrix(m90, 200, 100)).toEqual([100, 200]);

    // 180°: original bottom-right (400, 200) moves to oriented (0, 0)
    const m180 = canvasTransform(natW, natH, { x: 0, y: 0, width: 200, height: 100 }, 180);
    expect(applyMatrix(m180, 400, 200)).toEqual([0, 0]);
    expect(applyMatrix(m180, 200, 100)).toEqual([200, 100]);

    // 270° CW (90° CCW): oriented size is 200×400; original top-right (400, 0) moves to oriented (0, 0)
    const m270 = canvasTransform(natW, natH, { x: 0, y: 0, width: 100, height: 200 }, 270);
    expect(applyMatrix(m270, 400, 0)).toEqual([0, 0]);
    expect(applyMatrix(m270, 200, 100)).toEqual([100, 200]);
  });

  it('normalizes output MIME types cleanly', () => {
    expect(outputMimeType('image/png')).toBe('image/png');
    expect(outputMimeType('image/webp')).toBe('image/webp');
    expect(outputMimeType('image/jpeg')).toBe('image/jpeg');
    expect(outputMimeType('image/heic')).toBe('image/jpeg');
    expect(outputMimeType('')).toBe('image/jpeg');
  });

  it('returns the original Blob untouched for identity crops', async () => {
    const original = new Blob(['raw-image-bytes'], { type: 'image/jpeg' });
    const out = await cropImageBlob(original, FULL_CROP, 0);
    expect(out).toBe(original);
  });
});
