import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Card } from '../lib/db';
import { useI18n } from '../lib/i18n';
import type { Grade } from '../lib/srs';
import { useImageUrl } from '../lib/useImageUrl';

export interface SwipeCardHandle {
  fling: (grade: Grade) => void;
  flip: () => void;
}

const THRESHOLD = 0.28; // fraction of card width
const FLING_MS = 220;

/**
 * Tap → flip. Drag right → "know", drag left → "don't know".
 * Vertical scrolling stays possible (touch-action: pan-y) for long back text.
 */
export const SwipeCard = forwardRef<SwipeCardHandle, { card: Card; reverse: boolean; onAnswer: (g: Grade) => void }>(
  function SwipeCard({ card, reverse, onAnswer }, ref) {
    const { t } = useI18n();
    const [flipped, setFlipped] = useState(false);
    const [dx, setDx] = useState(0);
    const [dragging, setDragging] = useState(false);
    const [leaving, setLeaving] = useState<Grade | null>(null);
    const start = useRef<{ x: number; y: number; t: number; id: number } | null>(null);
    const moved = useRef(false);
    const el = useRef<HTMLDivElement>(null);

    const fling = (g: Grade) => {
      if (leaving) return;
      setLeaving(g);
      setDragging(false);
      const w = el.current?.offsetWidth ?? 400;
      setDx(g === 'know' ? w * 1.6 : -w * 1.6);
      setTimeout(() => onAnswer(g), FLING_MS);
    };
    useImperativeHandle(ref, () => ({ fling, flip: () => setFlipped((f) => !f) }));

    // Reset state if the same component instance is reused for another card.
    // biome-ignore lint/correctness/useExhaustiveDependencies: reset on card change only
    useEffect(() => {
      setFlipped(false);
      setDx(0);
      setLeaving(null);
    }, [card.id]);

    const onPointerDown = (e: React.PointerEvent) => {
      if (leaving || (e.pointerType === 'mouse' && e.button !== 0)) return;
      start.current = { x: e.clientX, y: e.clientY, t: performance.now(), id: e.pointerId };
      moved.current = false;
    };
    const onPointerMove = (e: React.PointerEvent) => {
      const s = start.current;
      if (!s || s.id !== e.pointerId) return;
      const ddx = e.clientX - s.x;
      const ddy = e.clientY - s.y;
      if (!moved.current && Math.hypot(ddx, ddy) > 8) {
        moved.current = true;
        if (Math.abs(ddx) > Math.abs(ddy)) {
          setDragging(true);
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        } else {
          start.current = null; // vertical gesture → let the page/text scroll
          return;
        }
      }
      if (dragging || moved.current) setDx(ddx);
    };
    const onPointerUp = (e: React.PointerEvent) => {
      const s = start.current;
      start.current = null;
      if (!s || s.id !== e.pointerId) return;
      if (!moved.current) {
        setFlipped((f) => !f);
        return;
      }
      setDragging(false);
      const w = el.current?.offsetWidth ?? 400;
      const ddx = e.clientX - s.x;
      const velocity = ddx / Math.max(1, performance.now() - s.t); // px/ms
      if (Math.abs(ddx) > w * THRESHOLD || (Math.abs(velocity) > 0.6 && Math.abs(ddx) > 40)) {
        fling(ddx > 0 ? 'know' : 'dontKnow');
      } else {
        setDx(0);
      }
    };
    const onPointerCancel = () => {
      start.current = null;
      setDragging(false);
      if (!leaving) setDx(0);
    };

    const w = el.current?.offsetWidth ?? 400;
    const ratio = Math.max(-1, Math.min(1, dx / (w * THRESHOLD)));
    const frontSide = { text: card.frontText, imageId: card.frontImageId };
    const backSide = { text: card.backText, imageId: card.backImageId };
    const [a, b] = reverse ? [backSide, frontSide] : [frontSide, backSide];

    return (
      // biome-ignore lint/a11y/useSemanticElements: swipe surface with scrollable content; a <button> would block text scrolling
      <div
        ref={el}
        className="flip-scene relative h-full w-full touch-pan-y select-none"
        style={{
          transform: `translateX(${dx}px) rotate(${dx / 22}deg)`,
          transition: dragging ? 'none' : `transform ${FLING_MS}ms ease-out`,
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        role="button"
        tabIndex={0}
        aria-label={t.tapToFlip}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') {
            e.preventDefault();
            setFlipped((f) => !f);
          }
        }}
      >
        <div className={`flip-inner ${flipped ? 'is-flipped' : ''}`}>
          <Face side={a} hint={t.tapToFlip} />
          <Face side={b} back />
        </div>
        {/* swipe feedback */}
        <div
          className="pointer-events-none absolute top-6 left-6 -rotate-12 rounded-xl border-4 border-emerald-500 bg-white/80 px-3 py-1 text-2xl font-extrabold text-emerald-500 dark:bg-zinc-900/80"
          style={{ opacity: Math.max(0, ratio) }}
        >
          {t.know}
        </div>
        <div
          className="pointer-events-none absolute top-6 right-6 rotate-12 rounded-xl border-4 border-red-500 bg-white/80 px-3 py-1 text-2xl font-extrabold text-red-500 dark:bg-zinc-900/80"
          style={{ opacity: Math.max(0, -ratio) }}
        >
          {t.dontKnow}
        </div>
      </div>
    );
  },
);

/** Static, non-interactive preview of the next card (shown under the swiping card). */
export function CardPreview({ card, reverse }: { card: Card; reverse: boolean }) {
  const side = reverse
    ? { text: card.backText, imageId: card.backImageId }
    : { text: card.frontText, imageId: card.frontImageId };
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 scale-[0.95] opacity-70">
      <Face side={side} />
    </div>
  );
}

function Face({
  side,
  back = false,
  hint,
}: {
  side: { text: string; imageId: string | null };
  back?: boolean;
  hint?: string;
}) {
  const url = useImageUrl(side.imageId);
  const textOnly = !url;
  return (
    <div
      className={`flip-face flex flex-col overflow-hidden rounded-3xl bg-white shadow-xl ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700 ${back ? 'flip-back' : ''}`}
    >
      {url && (
        <div className="min-h-0 flex-1 bg-zinc-100 dark:bg-zinc-900">
          <img src={url} alt="" draggable={false} className="h-full w-full object-contain" />
        </div>
      )}
      {side.text && (
        <div
          className={`overflow-y-auto p-5 break-words whitespace-pre-wrap ${
            textOnly
              ? 'flex flex-1 items-center justify-center text-center text-2xl font-semibold'
              : 'max-h-[45%] text-lg'
          }`}
        >
          {textOnly ? <div className="max-h-full">{side.text}</div> : side.text}
        </div>
      )}
      {!url && !side.text && <div className="flex-1" />}
      {hint && <div className="pb-3 text-center text-xs text-zinc-400">{hint}</div>}
    </div>
  );
}
