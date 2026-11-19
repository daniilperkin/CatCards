import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  applyDrag,
  type CropRect,
  cropImageBlob,
  type DragHandle,
  FULL_CROP,
  fitBox,
  isIdentityCrop,
  nextRotationCW,
  orientedSize,
  type Rotation,
  rotateCropCW,
  toPixelCrop,
} from '../lib/crop';
import { useI18n } from '../lib/i18n';
import { useBlobUrl } from '../lib/useImageUrl';
import { Button, Icon, IconButton } from './ui';

const MIN_BOX_PX = 44;

interface DragState {
  handle: DragHandle;
  pointerId: number;
  startX: number;
  startY: number;
  startCrop: CropRect;
}

export function ImageCropper({
  source,
  initialCrop = FULL_CROP,
  initialRotation = 0,
  onApply,
  onCancel,
}: {
  source: Blob;
  initialCrop?: CropRect;
  initialRotation?: Rotation;
  onApply: (blob: Blob, crop: CropRect, rotation: Rotation) => void;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const url = useBlobUrl(source);
  const boundsRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const [crop, setCrop] = useState<CropRect>(initialCrop);
  const [rotation, setRotation] = useState<Rotation>(initialRotation);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  const [availSize, setAvailSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  const [dragging, setDragging] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState('');

  // Lock page scroll behind the fullscreen crop modal.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Escape closes the modal.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !applying) onCancel();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applying, onCancel]);

  // Measure the available stage area inside padding so rotated images and crop handles fit cleanly.
  useEffect(() => {
    const el = boundsRef.current;
    if (!el) return;
    const measure = () => {
      const r = el.getBoundingClientRect();
      setAvailSize({ width: r.width, height: r.height });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Catch images that finish decoding synchronously before onLoad attaches.
  const handleImageLoad = useCallback(() => {
    const img = imgRef.current;
    if (!img) return;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setError('');
    } else {
      setError(t.cropFailed);
    }
  }, [t.cropFailed]);

  useEffect(() => {
    if (url && imgRef.current?.complete && imgRef.current.naturalWidth > 0) {
      handleImageLoad();
    }
  }, [url, handleImageLoad]);

  const eff = naturalSize ? orientedSize(naturalSize.width, naturalSize.height, rotation) : null;
  const box = eff
    ? fitBox(eff.width, eff.height, availSize.width, availSize.height)
    : { width: 0, height: 0, scale: 0 };
  const ready = Boolean(eff && box.width > 0 && box.height > 0 && !error);
  const pixelCrop = eff ? toPixelCrop(crop, eff.width, eff.height) : null;

  const beginDrag = (handle: DragHandle, e: React.PointerEvent<HTMLDivElement>) => {
    if (!ready || applying) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    if (dragRef.current) return;
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      handle,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startCrop: crop,
    };
    setDragging(true);
  };

  const onDragMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId || box.width <= 0 || box.height <= 0) return;
    e.stopPropagation();
    const dxNorm = (e.clientX - d.startX) / box.width;
    const dyNorm = (e.clientY - d.startY) / box.height;
    const minW = Math.min(1, MIN_BOX_PX / box.width);
    const minH = Math.min(1, MIN_BOX_PX / box.height);
    setCrop(applyDrag(d.startCrop, d.handle, dxNorm, dyNorm, minW, minH));
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    e.stopPropagation();
    dragRef.current = null;
    setDragging(false);
  };

  const handleApply = async () => {
    if (!ready || applying) return;
    setApplying(true);
    setError('');
    try {
      const result = await cropImageBlob(source, crop, rotation, imgRef.current);
      onApply(result, crop, rotation);
    } catch {
      setError(t.cropFailed);
      setApplying(false);
    }
  };

  const dragProps = (handle: DragHandle) => ({
    'data-crop-handle': handle,
    onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => beginDrag(handle, e),
    onPointerMove: onDragMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    onLostPointerCapture: endDrag,
  });

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t.cropPhoto}
      className="fixed inset-0 z-50 flex flex-col bg-[#120b11] text-white select-none"
    >
      {/* Top bar */}
      <header className="safe-top border-b border-white/10 bg-[#191118]/90 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-xl items-center gap-2 px-3">
          <IconButton
            label={t.cancel}
            onClick={onCancel}
            disabled={applying}
            className="-ml-1 text-white hover:bg-white/10 dark:text-white"
          >
            <Icon.X className="size-6" />
          </IconButton>
          <h2 className="min-w-0 flex-1 truncate text-lg font-semibold">{t.cropPhoto}</h2>
          {pixelCrop && !error && (
            <span className="pr-1 text-xs text-pink-200/75 tabular-nums">
              {pixelCrop.width} × {pixelCrop.height}
            </span>
          )}
        </div>
      </header>

      {/* Crop stage */}
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-7 py-6 touch-none">
        <div ref={boundsRef} className="relative flex h-full w-full items-center justify-center">
          {error ? (
            <div className="space-y-3 text-center">
              <p className="text-sm text-red-300">{error}</p>
              <button
                type="button"
                onClick={onCancel}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-white/10 px-4 font-medium text-white transition hover:bg-white/20"
              >
                {t.cancel}
              </button>
            </div>
          ) : (
            <div
              className={`relative touch-none ${ready ? '' : 'pointer-events-none opacity-0'}`}
              style={ready ? { width: box.width, height: box.height } : { width: 1, height: 1 }}
            >
              {/* Clipped image & dimmed outside mask */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[2px]">
                {url && (
                  <img
                    ref={imgRef}
                    src={url}
                    alt=""
                    draggable={false}
                    onLoad={handleImageLoad}
                    onError={() => setError(t.cropFailed)}
                    className="pointer-events-none absolute top-1/2 left-1/2 max-h-none max-w-none select-none"
                    style={
                      ready && naturalSize
                        ? {
                            width: naturalSize.width * box.scale,
                            height: naturalSize.height * box.scale,
                            transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                          }
                        : undefined
                    }
                  />
                )}
                {ready && (
                  <div
                    className="absolute"
                    style={{
                      left: `${crop.x * 100}%`,
                      top: `${crop.y * 100}%`,
                      width: `${crop.w * 100}%`,
                      height: `${crop.h * 100}%`,
                      boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.62)',
                    }}
                  />
                )}
              </div>

              {/* Interactive crop frame and handles (unclipped so handles overhang cleanly) */}
              {ready && (
                <div
                  className="absolute touch-none"
                  style={{
                    left: `${crop.x * 100}%`,
                    top: `${crop.y * 100}%`,
                    width: `${crop.w * 100}%`,
                    height: `${crop.h * 100}%`,
                  }}
                >
                  {/* Interior drag-to-move area + border + rule-of-thirds grid */}
                  <div
                    {...dragProps('move')}
                    className="absolute inset-0 cursor-move touch-none border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.45)]"
                  >
                    <div
                      className={`pointer-events-none absolute inset-0 transition-opacity ${dragging ? 'opacity-90' : 'opacity-45'}`}
                    >
                      <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/75 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                      <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/75 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                      <div className="absolute top-1/3 right-0 left-0 h-px bg-white/75 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                      <div className="absolute top-2/3 right-0 left-0 h-px bg-white/75 shadow-[0_0_2px_rgba(0,0,0,0.6)]" />
                    </div>
                  </div>

                  {/* Edge handles (inset from corners so corners stay easy to grab on tiny selections) */}
                  <div
                    {...dragProps('n')}
                    className="absolute -top-3.5 right-6 left-6 z-10 flex h-7 cursor-ns-resize touch-none items-center justify-center overflow-hidden"
                  >
                    <span className="h-1 w-8 max-w-full rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.85)]" />
                  </div>
                  <div
                    {...dragProps('s')}
                    className="absolute right-6 -bottom-3.5 left-6 z-10 flex h-7 cursor-ns-resize touch-none items-center justify-center overflow-hidden"
                  >
                    <span className="h-1 w-8 max-w-full rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.85)]" />
                  </div>
                  <div
                    {...dragProps('w')}
                    className="absolute top-6 bottom-6 -left-3.5 z-10 flex w-7 cursor-ew-resize touch-none items-center justify-center overflow-hidden"
                  >
                    <span className="h-8 max-h-full w-1 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.85)]" />
                  </div>
                  <div
                    {...dragProps('e')}
                    className="absolute top-6 -right-3.5 bottom-6 z-10 flex w-7 cursor-ew-resize touch-none items-center justify-center overflow-hidden"
                  >
                    <span className="h-8 max-h-full w-1 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.85)]" />
                  </div>

                  {/* Corner handles (44x44px hit targets with bold L-brackets) */}
                  <div
                    {...dragProps('nw')}
                    className="absolute -top-5 -left-5 z-20 size-11 cursor-nwse-resize touch-none"
                  >
                    <span className="pointer-events-none absolute top-[18px] left-[18px] size-5 rounded-tl-[2px] border-t-4 border-l-4 border-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]" />
                  </div>
                  <div
                    {...dragProps('ne')}
                    className="absolute -top-5 -right-5 z-20 size-11 cursor-nesw-resize touch-none"
                  >
                    <span className="pointer-events-none absolute top-[18px] right-[18px] size-5 rounded-tr-[2px] border-t-4 border-r-4 border-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]" />
                  </div>
                  <div
                    {...dragProps('sw')}
                    className="absolute -bottom-5 -left-5 z-20 size-11 cursor-nesw-resize touch-none"
                  >
                    <span className="pointer-events-none absolute bottom-[18px] left-[18px] size-5 rounded-bl-[2px] border-b-4 border-l-4 border-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]" />
                  </div>
                  <div
                    {...dragProps('se')}
                    className="absolute -right-5 -bottom-5 z-20 size-11 cursor-nwse-resize touch-none"
                  >
                    <span className="pointer-events-none absolute right-[18px] bottom-[18px] size-5 rounded-br-[2px] border-r-4 border-b-4 border-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.85)]" />
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Bottom controls */}
      <footer className="safe-bottom border-t border-white/10 bg-[#191118]/90 px-4 pt-3 backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-xl items-center gap-2">
          <IconButton
            label={t.rotatePhoto}
            disabled={applying || Boolean(error)}
            onClick={() => {
              if (!ready || applying) return;
              setRotation((r) => nextRotationCW(r));
              setCrop((c) => rotateCropCW(c));
            }}
            className="bg-white/10 text-white hover:bg-white/20 disabled:opacity-35 dark:text-white"
          >
            <Icon.RotateCw className="size-5" />
          </IconButton>
          <button
            type="button"
            disabled={!ready || applying || isIdentityCrop(crop, rotation)}
            onClick={() => {
              setCrop(FULL_CROP);
              setRotation(0);
            }}
            className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 font-medium text-pink-100 transition hover:bg-white/10 disabled:opacity-40"
          >
            {t.resetCrop}
          </button>
          <div className="flex-1" />
          <Button variant="primary" disabled={applying || Boolean(error)} onClick={handleApply} className="px-5">
            <Icon.Check className="size-5" />
            {t.applyCrop}
          </Button>
        </div>
      </footer>
    </div>,
    document.body,
  );
}
