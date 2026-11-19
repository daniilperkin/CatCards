import { useEffect, useRef, useState } from 'react';
import { Button, Header, Icon } from '../components/ui';
import { importBackup, shareOrDownloadBackup } from '../lib/backup';
import { type Lang, useI18n } from '../lib/i18n';
import { href } from '../lib/router';
import { type Theme, useTheme } from '../lib/theme';

const LANG_LABELS: Record<Lang, string> = { de: 'Deutsch', uk: 'Українська' };

export function Settings() {
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const mergeRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);

  const themes: { id: Theme; label: string }[] = [
    { id: 'pink', label: t.themePink },
    { id: 'light', label: t.themeLight },
    { id: 'dark', label: t.themeDark },
  ];

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
        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-pink-200/80 dark:bg-[#261a24] dark:ring-pink-900/50">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">{t.theme}</h2>
          <div className="flex gap-1 rounded-xl bg-pink-50/80 p-1 dark:bg-[#191118]">
            {themes.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={theme === item.id}
                onClick={() => setTheme(item.id)}
                className={`inline-flex min-h-11 flex-auto items-center justify-center gap-1.5 rounded-lg px-2.5 text-sm font-medium whitespace-nowrap transition ${
                  theme === item.id ? 'bg-white shadow-sm dark:bg-[#352232]' : 'text-zinc-500'
                }`}
              >
                {item.id === 'pink' && <Icon.Paw className="size-4 shrink-0 text-accent" />}
                {item.label}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-pink-200/80 dark:bg-[#261a24] dark:ring-pink-900/50">
          <h2 className="text-sm font-semibold tracking-wide text-zinc-500 uppercase">{t.language}</h2>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-pink-50/80 p-1 dark:bg-[#191118]">
            {(Object.keys(LANG_LABELS) as Lang[]).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={`min-h-11 rounded-lg font-medium transition ${lang === l ? 'bg-white shadow-sm dark:bg-[#352232]' : 'text-zinc-500'}`}
              >
                {LANG_LABELS[l]}
              </button>
            ))}
          </div>
        </section>

        <section className="space-y-3 rounded-2xl bg-white p-4 shadow-sm ring-1 ring-pink-200/80 dark:bg-[#261a24] dark:ring-pink-900/50">
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
          <section className="rounded-2xl bg-white p-4 text-sm shadow-sm ring-1 ring-pink-200/80 dark:bg-[#261a24] dark:ring-pink-900/50">
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
