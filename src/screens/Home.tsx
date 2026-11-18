import { useLiveQuery } from 'dexie-react-hooks';
import { useState } from 'react';
import { DeckForm } from '../components/DeckForm';
import { Button, CatMascot, Header, Icon, IconButton, ProgressBar } from '../components/ui';
import { createDeck, db } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { href, navigate } from '../lib/router';
import { deckStats } from '../lib/stats';
import { useNow } from '../lib/useNow';

export function Home() {
  const { t } = useI18n();
  const now = useNow();
  const decks = useLiveQuery(() => db.decks.orderBy('createdAt').toArray(), []);
  const cards = useLiveQuery(() => db.cards.toArray(), []);
  const [creating, setCreating] = useState(false);

  const totalDue = cards ? deckStats(cards, now).due : 0;

  return (
    <>
      <Header
        title={t.appName}
        right={
          <a
            href={href({ name: 'settings' })}
            aria-label={t.settings}
            className="grid size-10 place-items-center rounded-full hover:bg-pink-100/70 dark:hover:bg-pink-950/50"
          >
            <Icon.Settings className="size-5" />
          </a>
        }
      />
      <main className="safe-bottom flex-1 space-y-4 px-4 pb-24">
        <Button
          variant="primary"
          className="h-14 w-full text-base"
          disabled={!totalDue}
          onClick={() => navigate({ name: 'study', deckId: null, mode: 'due', shuffle: false, reverse: false })}
        >
          <Icon.Paw className="size-5" />
          {totalDue ? `${t.studyAllDue} (${totalDue})` : t.nothingDue}
        </Button>

        <h2 className="pt-2 text-sm font-semibold tracking-wide text-zinc-500 uppercase">{t.decks}</h2>

        {decks && decks.length === 0 && !creating && (
          <div className="rounded-2xl border border-dashed border-pink-300 bg-white/60 p-6 text-center text-zinc-500 dark:border-pink-900/60 dark:bg-[#261a24]/60">
            <CatMascot mood="curious" className="mb-2 size-28" />
            <p>{t.noDecks}</p>
          </div>
        )}

        <ul className="space-y-3">
          {decks?.map((d) => {
            const s = deckStats(cards?.filter((c) => c.deckId === d.id) ?? [], now);
            return (
              <li key={d.id}>
                <a
                  href={href({ name: 'deck', deckId: d.id })}
                  className="block rounded-2xl bg-white p-4 shadow-sm ring-1 ring-pink-200/80 transition active:scale-[0.99] dark:bg-[#261a24] dark:ring-pink-900/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="size-3 shrink-0 rounded-full" style={{ background: d.color }} />
                    <span className="min-w-0 flex-1 truncate font-semibold">{d.name}</span>
                    {s.due > 0 && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-sm font-medium text-accent-strong dark:text-accent">
                        {s.due} {t.due}
                      </span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center gap-3 text-sm text-zinc-500">
                    <span className="shrink-0">
                      {s.total} {t.cards}
                    </span>
                    <ProgressBar value={s.progress} color={d.color} />
                    <span className="shrink-0 tabular-nums">{Math.round(s.progress * 100)}%</span>
                  </div>
                </a>
              </li>
            );
          })}
        </ul>

        {creating && (
          <DeckForm
            submitLabel={t.create}
            onCancel={() => setCreating(false)}
            onSubmit={async (name, color) => {
              const id = await createDeck(name, color);
              setCreating(false);
              navigate({ name: 'deck', deckId: id });
            }}
          />
        )}
      </main>

      {!creating && (
        <div className="safe-bottom pointer-events-none fixed inset-x-0 bottom-0 mx-auto flex max-w-xl justify-end px-4">
          <IconButton
            label={t.newDeck}
            onClick={() => setCreating(true)}
            className="pointer-events-auto size-14 bg-accent text-white shadow-lg hover:bg-accent-strong dark:text-white dark:hover:bg-accent-strong"
          >
            <Icon.Plus className="size-7" />
          </IconButton>
        </div>
      )}
    </>
  );
}
