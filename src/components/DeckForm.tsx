import { useState } from 'react';
import { DECK_COLORS } from '../lib/db';
import { useI18n } from '../lib/i18n';
import { Button } from './ui';

export function DeckForm({
  initialName = '',
  initialColor = DECK_COLORS[0],
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialName?: string;
  initialColor?: string;
  submitLabel: string;
  onSubmit: (name: string, color: string) => void | Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useI18n();
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);
  return (
    <form
      className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-pink-200/80 dark:bg-[#261a24] dark:ring-pink-900/50"
      onSubmit={(e) => {
        e.preventDefault();
        if (name.trim()) onSubmit(name.trim(), color);
      }}
    >
      <input
        // biome-ignore lint/a11y/noAutofocus: form opens on explicit user action
        autoFocus
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.deckName}
        aria-label={t.deckName}
        className="h-12 w-full rounded-xl bg-pink-50/70 px-3 text-base outline-none focus:ring-2 focus:ring-accent dark:bg-[#191118]"
      />
      <div className="flex items-center justify-between gap-1">
        {DECK_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            aria-label={c}
            aria-pressed={c === color}
            onClick={() => setColor(c)}
            className={`size-8 shrink-0 rounded-full transition min-[420px]:size-9 ${c === color ? 'ring-2 ring-zinc-900 ring-offset-2 dark:ring-white dark:ring-offset-zinc-800' : ''}`}
            style={{ background: c }}
          />
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onCancel}>
          {t.cancel}
        </Button>
        <Button variant="primary" type="submit" disabled={!name.trim()}>
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}
