import { useCallback, useEffect, useRef, useState } from 'react';
import { CardPreview, SwipeCard, type SwipeCardHandle } from '../components/SwipeCard';
import { Button, Header, Icon, IconButton, ProgressBar } from '../components/ui';
import { type Card, db } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { href, navigate, type Route } from '../lib/router';
import { answer, isDone, type SessionState, shuffle as shuffleIds, startSession, undo } from '../lib/session';
import { type Grade, review, type SrsState } from '../lib/srs';
import { selectCards } from '../lib/stats';

type StudyRoute = Extract<Route, { name: 'study' }>;

export function Study({ route }: { route: StudyRoute }) {
  const { t } = useI18n();
  const [cards, setCards] = useState<Map<string, Card> | null>(null);
  const [session, setSession] = useState<SessionState | null>(null);
  const [title, setTitle] = useState('');
  /** Previous SRS state per answer, for undo. */
  const srsHistory = useRef<SrsState[]>([]);
  const cardRef = useRef<SwipeCardHandle>(null);
  const busy = useRef(false);

  const backHref = route.deckId ? href({ name: 'deck', deckId: route.deckId }) : href({ name: 'home' });

  useEffect(() => {
    (async () => {
      const all = route.deckId
        ? await db.cards.where('deckId').equals(route.deckId).toArray()
        : await db.cards.toArray();
      const deck = route.deckId ? await db.decks.get(route.deckId) : null;
      setTitle(deck?.name ?? t.allDecks);
      let ids = selectCards(all, route.mode).map((c) => c.id);
      if (route.shuffle) ids = shuffleIds(ids);
      setCards(new Map(all.map((c) => [c.id, c])));
      setSession(startSession(ids));
    })();
  }, [route.deckId, route.mode, route.shuffle, t.allDecks]);

  const onAnswer = useCallback(
    async (grade: Grade) => {
      if (!session || !cards || busy.current) return;
      const id = session.queue[0];
      const card = id ? cards.get(id) : undefined;
      if (!card) return;
      busy.current = true;
      const next = review(card.srs, grade, Date.now());
      srsHistory.current.push(card.srs);
      await db.cards.update(card.id, { srs: next });
      setCards(new Map(cards).set(card.id, { ...card, srs: next }));
      setSession(answer(session, grade));
      busy.current = false;
    },
    [session, cards],
  );

  const onUndo = useCallback(async () => {
    if (!session || !cards || busy.current) return;
    const { state, cardId } = undo(session);
    const prev = srsHistory.current.pop();
    if (!cardId || !prev) return;
    busy.current = true;
    const card = cards.get(cardId);
    if (card) {
      await db.cards.update(cardId, { srs: prev });
      setCards(new Map(cards).set(cardId, { ...card, srs: prev }));
    }
    setSession(state);
    busy.current = false;
  }, [session, cards]);

  // Desktop keyboard shortcuts: ←/→ answer, Space flips (handled by card), Ctrl+Z undo.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') cardRef.current?.fling('know');
      else if (e.key === 'ArrowLeft') cardRef.current?.fling('dontKnow');
      else if (e.key === 'z' && (e.ctrlKey || e.metaKey)) onUndo();
      else if (e.key === ' ' && document.activeElement === document.body) {
        e.preventDefault();
        cardRef.current?.flip();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onUndo]);

  if (!session || !cards) return null;

  if (session.total === 0) {
    return (
      <>
        <Header title={title} backHref={backHref} />
        <main className="grid flex-1 place-items-center p-6 text-center text-zinc-500">{t.noCardsToStudy}</main>
      </>
    );
  }

  if (isDone(session)) {
    const known = session.firstTryKnown.length;
    const repeated = session.missed.length;
    return (
      <>
        <Header title={title} backHref={backHref} />
        <main className="safe-bottom flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
          <div className="text-6xl">😺</div>
          <h2 className="text-3xl font-bold">{t.sessionDone}</h2>
          <div className="grid w-full max-w-xs grid-cols-2 gap-3">
            <div className="rounded-2xl bg-emerald-500/10 p-4">
              <div className="text-3xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">{known}</div>
              <div className="text-sm text-zinc-500">{t.knownFirstTry}</div>
            </div>
            <div className="rounded-2xl bg-red-500/10 p-4">
              <div className="text-3xl font-bold text-red-600 tabular-nums dark:text-red-400">{repeated}</div>
              <div className="text-sm text-zinc-500">{t.neededRepeat}</div>
            </div>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            {repeated > 0 && route.deckId && (
              <Button
                onClick={() =>
                  navigate({
                    name: 'study',
                    deckId: route.deckId,
                    mode: 'unknown',
                    shuffle: route.shuffle,
                    reverse: route.reverse,
                  })
                }
              >
                {t.studyUnknown}
              </Button>
            )}
            <a
              href={backHref}
              className="inline-flex min-h-11 items-center justify-center rounded-xl bg-accent px-4 font-medium text-white"
            >
              {t.finish}
            </a>
          </div>
        </main>
      </>
    );
  }

  const currentId = session.queue[0];
  const current = currentId ? cards.get(currentId) : undefined;
  const nextId = session.queue.find((id) => id !== currentId);
  const next = nextId ? cards.get(nextId) : undefined;
  const doneCount = session.total - new Set(session.queue).size;

  return (
    <>
      <Header
        title={title}
        backHref={backHref}
        right={
          <span className="pr-2 text-sm text-zinc-500 tabular-nums">
            {session.queue.length} {t.left}
          </span>
        }
      />
      <div className="px-4">
        <ProgressBar value={doneCount / session.total} />
      </div>
      <main className="safe-bottom flex min-h-0 flex-1 flex-col gap-4 overflow-hidden px-4 pt-4">
        <div className="relative min-h-0 flex-1">
          {next && <CardPreview key={`next-${next.id}`} card={next} reverse={route.reverse} />}
          {current && (
            <SwipeCard
              key={`${current.id}-${session.history.length}`}
              ref={cardRef}
              card={current}
              reverse={route.reverse}
              onAnswer={onAnswer}
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-6 pb-1">
          <IconButton
            label={t.dontKnow}
            onClick={() => cardRef.current?.fling('dontKnow')}
            className="size-16 bg-white text-red-500 shadow-md ring-1 ring-zinc-200 hover:bg-red-50 dark:bg-zinc-800 dark:text-red-400 dark:ring-zinc-700"
          >
            <Icon.X className="size-8" />
          </IconButton>
          <IconButton
            label={t.undo}
            onClick={onUndo}
            disabled={session.history.length === 0}
            className="disabled:opacity-30"
          >
            <Icon.Undo className="size-6" />
          </IconButton>
          <IconButton
            label={t.know}
            onClick={() => cardRef.current?.fling('know')}
            className="size-16 bg-white text-emerald-500 shadow-md ring-1 ring-zinc-200 hover:bg-emerald-50 dark:bg-zinc-800 dark:text-emerald-400 dark:ring-zinc-700"
          >
            <Icon.Check className="size-8" />
          </IconButton>
        </div>
      </main>
    </>
  );
}
