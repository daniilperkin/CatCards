import { useEffect, useState } from 'react';

/**
 * Tiny hash router (works on GitHub Pages without 404 rewrites).
 *   #/                         home (decks)
 *   #/deck/:id                 deck detail
 *   #/deck/:id/card/new        new card
 *   #/deck/:id/card/:cardId    edit card
 *   #/study/:deckId|all?mode=due|unknown|all&shuffle=1&reverse=1
 *   #/settings
 */
export type Route =
  | { name: 'home' }
  | { name: 'deck'; deckId: string }
  | { name: 'card'; deckId: string; cardId: string | null }
  | { name: 'study'; deckId: string | null; mode: StudyMode; shuffle: boolean; reverse: boolean }
  | { name: 'settings' };

export type StudyMode = 'due' | 'unknown' | 'all';

export function parseHash(hash: string): Route {
  const [path, query = ''] = hash.replace(/^#/, '').split('?');
  const parts = path.split('/').filter(Boolean).map(decodeURIComponent);
  const q = new URLSearchParams(query);
  if (parts[0] === 'deck' && parts[1]) {
    if (parts[2] === 'card' && parts[3]) {
      return { name: 'card', deckId: parts[1], cardId: parts[3] === 'new' ? null : parts[3] };
    }
    return { name: 'deck', deckId: parts[1] };
  }
  if (parts[0] === 'study' && parts[1]) {
    const m = q.get('mode');
    return {
      name: 'study',
      deckId: parts[1] === 'all' ? null : parts[1],
      mode: m === 'unknown' || m === 'all' ? m : 'due',
      shuffle: q.get('shuffle') === '1',
      reverse: q.get('reverse') === '1',
    };
  }
  if (parts[0] === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

export function href(r: Route): string {
  switch (r.name) {
    case 'home':
      return '#/';
    case 'deck':
      return `#/deck/${encodeURIComponent(r.deckId)}`;
    case 'card':
      return `#/deck/${encodeURIComponent(r.deckId)}/card/${r.cardId ? encodeURIComponent(r.cardId) : 'new'}`;
    case 'study': {
      const q = new URLSearchParams({ mode: r.mode });
      if (r.shuffle) q.set('shuffle', '1');
      if (r.reverse) q.set('reverse', '1');
      return `#/study/${r.deckId ? encodeURIComponent(r.deckId) : 'all'}?${q}`;
    }
    case 'settings':
      return '#/settings';
  }
}

export function navigate(r: Route, replace = false) {
  const h = href(r);
  if (replace) history.replaceState(null, '', h);
  else location.hash = h;
  if (replace) window.dispatchEvent(new HashChangeEvent('hashchange'));
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseHash(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseHash(location.hash));
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  return route;
}
