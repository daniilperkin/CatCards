import { useLiveQuery } from 'dexie-react-hooks';
import { useEffect, useRef, useState } from 'react';
import { Button, Header, Icon, IconButton } from '../components/ui';
import { db, deleteCard, upsertCard } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { href, navigate } from '../lib/router';
import { useBlobUrl, useImageUrl } from '../lib/useImageUrl';

interface SideState {
  text: string;
  /** undefined = unchanged stored image, null = removed, Blob = newly picked */
  image: Blob | null | undefined;
}

const empty: SideState = { text: '', image: undefined };

export function CardEditor({ deckId, cardId, onDone }: { deckId: string; cardId: string | null; onDone?: () => void }) {
  const { t } = useI18n();
  const decks = useLiveQuery(() => db.decks.orderBy('createdAt').toArray(), []);
  const [targetDeckId, setTargetDeckId] = useState(deckId);
  const [front, setFront] = useState<SideState>(empty);
  const [back, setBack] = useState<SideState>(empty);
  const [stored, setStored] = useState<{ front: string | null; back: string | null }>({ front: null, back: null });
  const [loaded, setLoaded] = useState(cardId === null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [formKey, setFormKey] = useState(0);

  useEffect(() => {
    setTargetDeckId(deckId);
    if (!cardId) return;
    db.cards.get(cardId).then((c) => {
      if (!c) return onDone ? onDone() : navigate({ name: 'deck', deckId }, true);
      setTargetDeckId(c.deckId);
      setFront({ text: c.frontText, image: undefined });
      setBack({ text: c.backText, image: undefined });
      setStored({ front: c.frontImageId, back: c.backImageId });
      setLoaded(true);
    });
  }, [cardId, deckId, onDone]);

  const hasSide = (s: SideState, storedId: string | null) =>
    s.text.trim() !== '' || s.image instanceof Blob || (s.image === undefined && !!storedId);

  async function save(next: boolean) {
    if (!hasSide(front, stored.front)) {
      setError(t.cardNeedsFront);
      return;
    }
    if (!hasSide(back, stored.back)) {
      setError(t.cardNeedsBack);
      return;
    }
    setSaving(true);
    try {
      await upsertCard(targetDeckId, cardId, {
        frontText: front.text.trim(),
        frontImage: front.image,
        backText: back.text.trim(),
        backImage: back.image,
      });
      if (onDone) {
        onDone();
        return;
      }
      if (next) {
        setFront(empty);
        setBack(empty);
        setStored({ front: null, back: null });
        setError('');
        setFormKey((k) => k + 1);
        if (cardId) navigate({ name: 'card', deckId: targetDeckId, cardId: null }, true);
        window.scrollTo({ top: 0 });
      } else {
        navigate({ name: 'deck', deckId: targetDeckId }, true);
      }
    } finally {
      setSaving(false);
    }
  }

  if (!loaded) return null;

  return (
    <>
      <Header
        title={cardId ? t.editCard : t.newCard}
        backHref={onDone ? undefined : href({ name: 'deck', deckId })}
        onBack={onDone}
        right={
          cardId && (
            <IconButton
              label={t.delete}
              className="text-red-600 dark:text-red-400"
              onClick={async () => {
                if (confirm(t.confirmDeleteCard)) {
                  await deleteCard(cardId);
                  if (onDone) onDone();
                  else navigate({ name: 'deck', deckId }, true);
                }
              }}
            >
              <Icon.Trash className="size-5" />
            </IconButton>
          )
        }
      />
      <main key={formKey} className="safe-bottom flex-1 space-y-4 px-4 pb-6">
        {decks && decks.length > 1 && (
          <label className="flex items-center justify-between gap-3 rounded-2xl bg-white px-4 py-3 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
            <span className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">{t.deckLabel}</span>
            <select
              value={targetDeckId}
              onChange={(e) => setTargetDeckId(e.target.value)}
              aria-label={t.deckLabel}
              className="min-w-0 rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium outline-none focus:ring-2 focus:ring-accent dark:bg-zinc-900"
            >
              {decks.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <SideEditor
          title={t.front}
          placeholder={t.frontPlaceholder}
          state={front}
          storedImageId={stored.front}
          onChange={(s) => {
            setFront(s);
            setError('');
          }}
        />
        <SideEditor
          title={t.backSide}
          placeholder={t.backPlaceholder}
          state={back}
          storedImageId={stored.back}
          onChange={(s) => {
            setBack(s);
            setError('');
          }}
          rows={6}
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <div className="flex gap-2">
          {!cardId && !onDone && (
            <Button className="flex-1" disabled={saving} onClick={() => save(true)}>
              {t.saveAndNext}
            </Button>
          )}
          <Button variant="primary" className="flex-1" disabled={saving} onClick={() => save(false)}>
            {t.save}
          </Button>
        </div>
      </main>
    </>
  );
}

function SideEditor({
  title,
  placeholder,
  state,
  storedImageId,
  onChange,
  rows = 2,
}: {
  title: string;
  placeholder: string;
  state: SideState;
  storedImageId: string | null;
  onChange: (s: SideState) => void;
  rows?: number;
}) {
  const { t } = useI18n();
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const storedUrl = useImageUrl(state.image === undefined ? storedImageId : null);
  const pickedUrl = useBlobUrl(state.image instanceof Blob ? state.image : null);
  const url = pickedUrl ?? storedUrl;

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) onChange({ ...state, image: f });
    e.target.value = '';
  };

  return (
    <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
      <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">{title}</h2>
      {url ? (
        <div className="relative overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900">
          <img src={url} alt="" className="max-h-80 w-full object-contain" />
          <IconButton
            label={t.removePhoto}
            onClick={() => onChange({ ...state, image: null })}
            className="absolute top-2 right-2 bg-black/50 text-white hover:bg-black/70 dark:text-white"
          >
            <Icon.X className="size-5" />
          </IconButton>
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <Button onClick={() => cameraRef.current?.click()}>
          <Icon.Camera className="size-5" />
          {t.camera}
        </Button>
        <Button onClick={() => galleryRef.current?.click()}>
          <Icon.Image className="size-5" />
          {t.gallery}
        </Button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={onFile} />
      <input ref={galleryRef} type="file" accept="image/*" hidden onChange={onFile} />
      <textarea
        value={state.text}
        onChange={(e) => onChange({ ...state, text: e.target.value })}
        placeholder={placeholder}
        aria-label={`${title} ${t.text}`}
        rows={rows}
        className="w-full resize-y rounded-xl bg-zinc-100 p-3 text-base outline-none focus:ring-2 focus:ring-accent dark:bg-zinc-900"
      />
    </section>
  );
}
