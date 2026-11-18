import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { DeckForm } from '../components/DeckForm';
import { Button, CatMascot, Header, Icon, IconButton, ProgressBar, Toggle } from '../components/ui';
import { shareOrDownloadBackup } from '../lib/backup';
import { type Card, db, deleteDeck, resetDeckProgress } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { href, navigate, type StudyMode } from '../lib/router';
import { deckStats, selectCards } from '../lib/stats';
import { useImageUrl } from '../lib/useImageUrl';
import { useNow } from '../lib/useNow';

export function DeckView({ deckId }: { deckId: string }) {
  const { t } = useI18n();
  const now = useNow();
  const deck = useLiveQuery(() => db.decks.get(deckId), [deckId]);
  const cards = useLiveQuery(() => db.cards.where('deckId').equals(deckId).sortBy('createdAt'), [deckId]);
  const [mode, setMode] = useState<StudyMode>('due');
  const [shuffle, setShuffle] = useState(false);
  const [reverse, setReverse] = useState(false);
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);

  if (deck === undefined && cards !== undefined) {
    // deck deleted or unknown id
    return <Header title="" backHref={href({ name: 'home' })} />;
  }
  if (!deck || !cards) return null;

  const s = deckStats(cards, now);
  const studyCount = selectCards(cards, mode, now).length;
  const q = query.trim().toLowerCase();
  const visibleCards = q
    ? cards.filter((c) => c.frontText.toLowerCase().includes(q) || c.backText.toLowerCase().includes(q))
    : cards;
  const modes: { id: StudyMode; label: string; count: number }[] = [
    { id: 'due', label: t.studyDue, count: s.due },
    { id: 'unknown', label: t.studyUnknown, count: s.unknown },
    { id: 'all', label: t.studyAll, count: s.total },
  ];

  return (
    <>
      <Header
        title={deck.name}
        backHref={href({ name: 'home' })}
        right={
          <IconButton label={t.edit} onClick={() => setEditing((v) => !v)}>
            <Icon.Pencil className="size-5" />
          </IconButton>
        }
      />
      <main className="safe-bottom flex-1 space-y-4 px-4 pb-24">
        {editing && (
          <div className="space-y-2">
            <DeckForm
              initialName={deck.name}
              initialColor={deck.color}
              submitLabel={t.save}
              onCancel={() => setEditing(false)}
              onSubmit={async (name, color) => {
                await db.decks.update(deck.id, { name, color });
                setEditing(false);
              }}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                disabled={exporting}
                onClick={async () => {
                  setExporting(true);
                  try {
                    await shareOrDownloadBackup(deck.id, deck.name);
                  } finally {
                    setExporting(false);
                  }
                }}
              >
                <Icon.Download className="size-4" />
                {t.exportDeck}
              </Button>
              <Button
                variant="ghost"
                onClick={async () => {
                  if (confirm(t.confirmReset)) await resetDeckProgress(deck.id);
                }}
              >
                {t.resetProgress}
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (confirm(t.confirmDeleteDeck)) {
                    await deleteDeck(deck.id);
                    navigate({ name: 'home' }, true);
                  }
                }}
              >
                <Icon.Trash className="size-4" />
                {t.delete}
              </Button>
            </div>
          </div>
        )}

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-pink-200/80 dark:bg-[#261a24] dark:ring-pink-900/50">
          <div className="grid grid-cols-3 text-center">
            <Stat value={s.total} label={t.cards} />
            <Stat value={s.due} label={t.due} />
            <Stat value={s.mastered} label={t.mastered} />
          </div>
          <div className="flex items-center gap-3 text-sm text-zinc-500">
            <ProgressBar value={s.progress} color={deck.color} />
            <span className="tabular-nums">{Math.round(s.progress * 100)}%</span>
          </div>

          <div className="grid grid-cols-3 gap-1 rounded-xl bg-pink-50/80 p-1 dark:bg-[#191118]">
            {modes.map((m) => (
              <button
                key={m.id}
                type="button"
                aria-pressed={mode === m.id}
                onClick={() => setMode(m.id)}
                className={`min-h-11 rounded-lg px-1 text-sm leading-tight font-medium transition ${
                  mode === m.id ? 'bg-white shadow-sm dark:bg-[#352232]' : 'text-zinc-500'
                }`}
              >
                {m.label}
                <span className="block text-xs opacity-70">{m.count}</span>
              </button>
            ))}
          </div>
          <Toggle checked={shuffle} onChange={setShuffle} label={t.shuffle} />
          <Toggle checked={reverse} onChange={setReverse} label={t.reverse} />
          <Button
            variant="primary"
            className="h-12 w-full"
            disabled={!studyCount}
            onClick={() => navigate({ name: 'study', deckId, mode, shuffle, reverse })}
          >
            <Icon.Paw className="size-5" />
            {studyCount ? `${t.start} (${studyCount})` : t.noCardsToStudy}
          </Button>
        </section>

        <h2 className="pt-2 text-sm font-semibold tracking-wide text-zinc-500 uppercase">
          {t.cards} ({cards.length})
        </h2>
        {cards.length > 0 && (
          <div className="relative">
            <Icon.Search className="pointer-events-none absolute top-1/2 left-3 size-5 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t.searchCards}
              aria-label={t.searchCards}
              className="h-11 w-full rounded-xl bg-white pr-10 pl-10 text-base shadow-sm ring-1 ring-pink-200/80 outline-none focus:ring-2 focus:ring-accent dark:bg-[#261a24] dark:ring-pink-900/50"
            />
            {query && (
              <IconButton
                label={t.cancel}
                onClick={() => setQuery('')}
                className="absolute top-1/2 right-1 size-9 -translate-y-1/2"
              >
                <Icon.X className="size-4" />
              </IconButton>
            )}
          </div>
        )}
        {cards.length === 0 && (
          <div className="rounded-2xl border border-dashed border-pink-300 bg-white/60 p-6 text-center text-zinc-500 dark:border-pink-900/60 dark:bg-[#261a24]/60">
            <CatMascot mood="curious" className="mb-2 size-24" />
            <p>{t.noCards}</p>
          </div>
        )}
        {cards.length > 0 && visibleCards.length === 0 && (
          <p className="rounded-2xl border border-dashed border-pink-300 p-8 text-center text-zinc-500 dark:border-pink-900/60">
            {t.noSearchResults}
          </p>
        )}
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {visibleCards.map((c) => (
            <CardThumb key={c.id} card={c} />
          ))}
        </ul>
      </main>

      <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 mx-auto flex max-w-xl justify-end px-4">
        <a
          href={href({ name: 'card', deckId, cardId: null })}
          aria-label={t.newCard}
          className="pointer-events-auto grid size-14 place-items-center rounded-full bg-accent text-white shadow-lg shadow-pink-500/30 hover:bg-accent-strong"
        >
          <Icon.Plus className="size-7" />
        </a>
      </div>
    </>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-zinc-500">{label}</div>
    </div>
  );
}

function CardThumb({ card }: { card: Card }) {
  const url = useImageUrl(card.frontImageId);
  return (
    <li>
      <a
        href={href({ name: 'card', deckId: card.deckId, cardId: card.id })}
        className="flex aspect-[3/4] flex-col overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-pink-200/80 dark:bg-[#261a24] dark:ring-pink-900/50"
      >
        {url ? (
          <img src={url} alt="" className="min-h-0 flex-1 object-cover" loading="lazy" />
        ) : (
          <div className="flex min-h-0 flex-1 items-center justify-center p-3 text-center font-medium break-words">
            <span className="line-clamp-5">{card.frontText}</span>
          </div>
        )}
        {url && card.frontText && <div className="truncate px-2 py-1.5 text-sm">{card.frontText}</div>}
      </a>
    </li>
  );
}
