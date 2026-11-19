import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../lib/i18n';
import type { PdfLayout } from '../lib/pdf';
import { Button, Icon, IconButton } from './ui';

export function PdfExportDialog({
  deckId,
  deckName,
  cardCount,
  onClose,
}: {
  deckId: string;
  deckName: string;
  cardCount: number;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const [layout, setLayout] = useState<PdfLayout>('sheet');
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !exporting) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [exporting, onClose]);

  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);
    setError('');
    try {
      const { shareOrDownloadDeckPdf } = await import('../lib/pdf');
      await shareOrDownloadDeckPdf(deckId, deckName, layout, {
        front: t.front,
        back: t.backSide,
        cards: t.cards,
        fronts: t.pdfFronts,
        backs: t.pdfBacks,
      });
      onClose();
    } catch {
      setError(t.exportPdfFailed);
      setExporting(false);
    }
  };

  const options: { id: PdfLayout; title: string; desc: string }[] = [
    { id: 'sheet', title: t.pdfLayoutSheet, desc: t.pdfLayoutSheetDesc },
    { id: 'cards', title: t.pdfLayoutCards, desc: t.pdfLayoutCardsDesc },
  ];

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-4">
      <button
        type="button"
        aria-label={t.cancel}
        disabled={exporting}
        onClick={onClose}
        className="fixed inset-0 bg-black/55 backdrop-blur-[2px]"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t.exportPdf}
        className="safe-bottom relative z-10 w-full max-w-md space-y-4 rounded-t-3xl bg-white p-5 shadow-2xl ring-1 ring-pink-200/80 sm:rounded-3xl dark:bg-[#261a24] dark:ring-pink-900/60"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold">{t.exportPdf}</h2>
            <p className="truncate text-sm text-zinc-500">
              {deckName} · {cardCount} {t.cards}
            </p>
          </div>
          <IconButton label={t.cancel} onClick={onClose} disabled={exporting} className="-mt-1 -mr-1">
            <Icon.X className="size-5" />
          </IconButton>
        </div>

        <div className="space-y-2.5">
          {options.map((opt) => {
            const active = layout === opt.id;
            return (
              <button
                key={opt.id}
                type="button"
                aria-pressed={active}
                disabled={exporting}
                onClick={() => setLayout(opt.id)}
                className={`flex w-full items-center gap-3.5 rounded-2xl p-3.5 text-left transition ${
                  active
                    ? 'bg-pink-50/90 ring-2 ring-accent dark:bg-pink-950/40'
                    : 'bg-zinc-50/80 ring-1 ring-pink-200/70 hover:bg-pink-50/50 dark:bg-[#191118] dark:ring-pink-900/50 dark:hover:bg-pink-950/25'
                }`}
              >
                <LayoutThumb kind={opt.id} active={active} />
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{opt.title}</div>
                  <div className="mt-0.5 text-xs leading-snug text-zinc-500 dark:text-pink-200/70">{opt.desc}</div>
                </div>
              </button>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

        <div className="flex gap-2 pt-1">
          <Button variant="ghost" className="flex-1" disabled={exporting} onClick={onClose}>
            {t.cancel}
          </Button>
          <Button variant="primary" className="flex-[1.6]" disabled={exporting} onClick={handleExport}>
            <Icon.FileText className="size-5" />
            {exporting ? t.exportingPdf : t.exportPdf}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function LayoutThumb({ kind, active }: { kind: PdfLayout; active: boolean }) {
  const stroke = active ? 'var(--color-accent)' : 'currentColor';
  return (
    <svg
      viewBox="0 0 40 52"
      className={`h-13 w-10 shrink-0 rounded-md bg-white p-1 shadow-xs ring-1 dark:bg-[#261a24] ${
        active ? 'ring-accent/50' : 'text-zinc-400 ring-pink-200/70 dark:text-zinc-500 dark:ring-pink-900/50'
      }`}
      fill="none"
      aria-hidden
    >
      {kind === 'sheet' ? (
        <>
          <rect x="4" y="5" width="32" height="5" rx="1" fill={stroke} opacity="0.25" />
          <rect x="4" y="13" width="15" height="9" rx="1.2" stroke={stroke} strokeWidth="1.4" />
          <rect x="21" y="13" width="15" height="9" rx="1.2" stroke={stroke} strokeWidth="1.4" />
          <rect x="4" y="25" width="15" height="9" rx="1.2" stroke={stroke} strokeWidth="1.4" />
          <rect x="21" y="25" width="15" height="9" rx="1.2" stroke={stroke} strokeWidth="1.4" />
          <rect x="4" y="37" width="15" height="9" rx="1.2" stroke={stroke} strokeWidth="1.4" />
          <rect x="21" y="37" width="15" height="9" rx="1.2" stroke={stroke} strokeWidth="1.4" />
        </>
      ) : (
        <>
          <rect x="4" y="4" width="15" height="9.5" rx="1" stroke={stroke} strokeWidth="1.3" strokeDasharray="2 1.5" />
          <rect x="21" y="4" width="15" height="9.5" rx="1" stroke={stroke} strokeWidth="1.3" strokeDasharray="2 1.5" />
          <rect
            x="4"
            y="15.5"
            width="15"
            height="9.5"
            rx="1"
            stroke={stroke}
            strokeWidth="1.3"
            strokeDasharray="2 1.5"
          />
          <rect
            x="21"
            y="15.5"
            width="15"
            height="9.5"
            rx="1"
            stroke={stroke}
            strokeWidth="1.3"
            strokeDasharray="2 1.5"
          />
          <rect x="4" y="27" width="15" height="9.5" rx="1" stroke={stroke} strokeWidth="1.3" strokeDasharray="2 1.5" />
          <rect
            x="21"
            y="27"
            width="15"
            height="9.5"
            rx="1"
            stroke={stroke}
            strokeWidth="1.3"
            strokeDasharray="2 1.5"
          />
          <rect
            x="4"
            y="38.5"
            width="15"
            height="9.5"
            rx="1"
            stroke={stroke}
            strokeWidth="1.3"
            strokeDasharray="2 1.5"
          />
          <rect
            x="21"
            y="38.5"
            width="15"
            height="9.5"
            rx="1"
            stroke={stroke}
            strokeWidth="1.3"
            strokeDasharray="2 1.5"
          />
        </>
      )}
    </svg>
  );
}
