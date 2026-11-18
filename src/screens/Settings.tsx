import { useEffect, useRef, useState } from 'react';
import { Button, Header } from '../components/ui';
import { importBackup, shareOrDownloadBackup } from '../lib/backup';
import { type Lang, useI18n } from '../lib/i18n';
import { href } from '../lib/router';

const LANG_LABELS: Record<Lang, string> = { de: 'Deutsch', uk: 'Українська' };

export function Settings() {
  const { t, lang, setLang } = useI18n();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const mergeRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null));
  }, []);

  async function doExport() {
    setBusy(true);
    try {
      await shareOrDownloadBackup();
    } finally {
      setBusy(false);
    }
  }

  async function doImport(e: React.ChangeEvent<HTMLInputElement>, mode: 'merge' | 'replace') {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (mode === 'replace' && !confirm(t.confirmReplace)) return;
    setBusy(true);
    try {
      const r = await importBackup(f, mode);
      setMsg(`${t.imported}: ${r.decks} ${t.decks}, ${r.cards} ${t.cards}`);
    } catch (err) {
      setMsg(`${t.importFailed}: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Header title={t.settings} backHref={href({ name: 'home' })} />
      <main className="safe-bottom flex-1 space-y-4 px-4 pb-6">
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">{t.language}</h2>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-zinc-100 p-1 dark:bg-zinc-900">
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={`min-h-11 rounded-lg font-medium transition ${lang === l ? 'bg-white shadow-sm dark:bg-zinc-700' : 'text-zinc-500'}`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">{t.backup}</h2>
          <p className="text-sm text-zinc-500">{t.backupHint}</p>
          <Button variant="primary" className="w-full" disabled={busy} onClick={doExport}>
            {t.exportBackup}
          </Button>
          <Button className="w-full" disabled={busy} onClick={() => mergeRef.current?.click()}>
            {t.importMerge}
          </Button>
          <Button variant="danger" className="w-full" disabled={busy} onClick={() => replaceRef.current?.click()}>
            {t.importReplace}
          </Button>
          <input
            ref={mergeRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => doImport(e, 'merge')}
          />
          <input
            ref={replaceRef}
            type="file"
            accept=".zip,application/zip"
            hidden
            onChange={(e) => doImport(e, 'replace')}
          />
          {msg && <p className="text-sm">{msg}</p>}
        </section>

        {persisted !== null && (
          <section className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-zinc-200 dark:bg-zinc-800 dark:ring-zinc-700">
            <h2 className="mb-1 font-semibold tracking-wide text-zinc-500 uppercase">{t.storage}</h2>
            <p className={persisted ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}>
              {persisted ? t.persisted : t.notPersisted}
            </p>
          </section>
        )}
        <p className="text-center text-xs text-zinc-400">CatCards v{__APP_VERSION__}</p>
      </main>
    </>
  );
}
