import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from 'react';

export type Lang = 'de' | 'uk';

const de = {
  appName: 'CatCards',
  decks: 'Stapel',
  newDeck: 'Neuer Stapel',
  deckName: 'Name des Stapels',
  create: 'Erstellen',
  save: 'Speichern',
  cancel: 'Abbrechen',
  delete: 'Löschen',
  edit: 'Bearbeiten',
  back: 'Zurück',
  noDecks: 'Noch keine Stapel. Erstelle deinen ersten!',
  studyAllDue: 'Alle fälligen lernen',
  nothingDue: 'Gerade nichts fällig 🎉',
  cards: 'Karten',
  due: 'fällig',
  mastered: 'gemeistert',
  newCard: 'Neue Karte',
  editCard: 'Karte bearbeiten',
  noCards: 'Noch keine Karten in diesem Stapel.',
  front: 'Vorderseite',
  backSide: 'Rückseite',
  text: 'Text',
  frontPlaceholder: 'Frage / Begriff (optional, wenn Foto)',
  backPlaceholder: 'Antwort / Infos',
  camera: 'Kamera',
  gallery: 'Galerie',
  removePhoto: 'Foto entfernen',
  cardNeedsFront: 'Die Vorderseite braucht ein Foto oder Text.',
  cardNeedsBack: 'Die Rückseite braucht ein Foto oder Text.',
  deckLabel: 'Stapel',
  searchCards: 'Karten suchen …',
  noSearchResults: 'Keine passenden Karten gefunden.',
  exportDeck: 'Stapel exportieren',
  saveAndNext: 'Speichern & nächste',
  study: 'Lernen',
  studyDue: 'Fällige lernen',
  studyUnknown: 'Nur „weiß nicht“',
  studyAll: 'Alle Karten',
  shuffle: 'Mischen',
  reverse: 'Umgekehrt (Rückseite zuerst)',
  start: 'Start',
  tapToFlip: 'Tippen zum Umdrehen',
  know: 'Weiß ich',
  dontKnow: 'Weiß nicht',
  undo: 'Rückgängig',
  sessionDone: 'Fertig!',
  knownFirstTry: 'Beim ersten Mal gewusst',
  neededRepeat: 'Wiederholt',
  again: 'Nochmal',
  finish: 'Fertig',
  noCardsToStudy: 'Keine Karten für diesen Modus.',
  settings: 'Einstellungen',
  language: 'Sprache',
  backup: 'Sicherung',
  backupHint: 'Deine Karten liegen nur auf diesem Gerät. Exportiere regelmäßig eine Sicherung (ZIP mit allen Fotos).',
  exportBackup: 'Sicherung exportieren',
  importMerge: 'Sicherung importieren (zusammenführen)',
  importReplace: 'Sicherung importieren (alles ersetzen)',
  confirmReplace: 'Alle aktuellen Daten werden ersetzt. Fortfahren?',
  imported: 'Importiert',
  importFailed: 'Import fehlgeschlagen',
  confirmDeleteDeck: 'Stapel und alle Karten löschen?',
  confirmDeleteCard: 'Karte löschen?',
  resetProgress: 'Fortschritt zurücksetzen',
  confirmReset: 'Lernfortschritt dieses Stapels zurücksetzen?',
  storage: 'Speicher',
  persisted: 'Dauerhafter Speicher aktiv',
  notPersisted: 'Speicher nicht dauerhaft – Browser könnte Daten löschen',
  allDecks: 'Alle Stapel',
  progress: 'Fortschritt',
  left: 'übrig',
} as const;

export type Strings = Record<keyof typeof de, string>;

const uk: Strings = {
  appName: 'CatCards',
  decks: 'Колоди',
  newDeck: 'Нова колода',
  deckName: 'Назва колоди',
  create: 'Створити',
  save: 'Зберегти',
  cancel: 'Скасувати',
  delete: 'Видалити',
  edit: 'Редагувати',
  back: 'Назад',
  noDecks: 'Ще немає колод. Створи першу!',
  studyAllDue: 'Вчити всі на сьогодні',
  nothingDue: 'Зараз нічого вчити 🎉',
  cards: 'Картки',
  due: 'на сьогодні',
  mastered: 'вивчено',
  newCard: 'Нова картка',
  editCard: 'Редагувати картку',
  noCards: 'У цій колоді ще немає карток.',
  front: 'Лицьова сторона',
  backSide: 'Зворотна сторона',
  text: 'Текст',
  frontPlaceholder: 'Питання / термін (необовʼязково, якщо є фото)',
  backPlaceholder: 'Відповідь / інформація',
  camera: 'Камера',
  gallery: 'Галерея',
  removePhoto: 'Видалити фото',
  cardNeedsFront: 'Лицьовій стороні потрібне фото або текст.',
  cardNeedsBack: 'Зворотній стороні потрібне фото або текст.',
  deckLabel: 'Колода',
  searchCards: 'Пошук карток …',
  noSearchResults: 'Карток не знайдено.',
  exportDeck: 'Експортувати колоду',
  saveAndNext: 'Зберегти й наступна',
  study: 'Вчити',
  studyDue: 'Вчити на сьогодні',
  studyUnknown: 'Тільки «не знаю»',
  studyAll: 'Усі картки',
  shuffle: 'Перемішати',
  reverse: 'Навпаки (спершу зворот)',
  start: 'Почати',
  tapToFlip: 'Торкнись, щоб перевернути',
  know: 'Знаю',
  dontKnow: 'Не знаю',
  undo: 'Скасувати',
  sessionDone: 'Готово!',
  knownFirstTry: 'Знав(ла) з першого разу',
  neededRepeat: 'Повторено',
  again: 'Ще раз',
  finish: 'Готово',
  noCardsToStudy: 'Немає карток для цього режиму.',
  settings: 'Налаштування',
  language: 'Мова',
  backup: 'Резервна копія',
  backupHint: 'Твої картки зберігаються лише на цьому пристрої. Регулярно експортуй резервну копію (ZIP з усіма фото).',
  exportBackup: 'Експортувати копію',
  importMerge: 'Імпортувати копію (обʼєднати)',
  importReplace: 'Імпортувати копію (замінити все)',
  confirmReplace: 'Усі поточні дані буде замінено. Продовжити?',
  imported: 'Імпортовано',
  importFailed: 'Помилка імпорту',
  confirmDeleteDeck: 'Видалити колоду та всі картки?',
  confirmDeleteCard: 'Видалити картку?',
  resetProgress: 'Скинути прогрес',
  confirmReset: 'Скинути прогрес цієї колоди?',
  storage: 'Сховище',
  persisted: 'Постійне сховище активне',
  notPersisted: 'Сховище не постійне – браузер може видалити дані',
  allDecks: 'Усі колоди',
  progress: 'Прогрес',
  left: 'залишилось',
};

const STRINGS: Record<Lang, Strings> = { de, uk };
const KEY = 'catcards.lang';

function initialLang(): Lang {
  const saved = localStorage.getItem(KEY);
  if (saved === 'de' || saved === 'uk') return saved;
  return navigator.language.toLowerCase().startsWith('uk') ? 'uk' : 'de';
}

const Ctx = createContext<{ t: Strings; lang: Lang; setLang: (l: Lang) => void } | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  const value = useMemo(
    () => ({
      t: STRINGS[lang],
      lang,
      setLang: (l: Lang) => {
        localStorage.setItem(KEY, l);
        setLangState(l);
      },
    }),
    [lang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useI18n outside provider');
  return v;
}

export const LANGS: Record<Lang, Strings> = STRINGS;
