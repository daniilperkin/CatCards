import { useRoute } from './lib/router';
import { CardEditor } from './screens/CardEditor';
import { DeckView } from './screens/DeckView';
import { Home } from './screens/Home';
import { Settings } from './screens/Settings';
import { Study } from './screens/Study';

export function App() {
  const route = useRoute();
  return (
    <div className="mx-auto flex h-full max-w-xl flex-col">
      {route.name === 'home' && <Home />}
      {route.name === 'deck' && <DeckView key={route.deckId} deckId={route.deckId} />}
      {route.name === 'card' && (
        <CardEditor key={`${route.deckId}/${route.cardId}`} deckId={route.deckId} cardId={route.cardId} />
      )}
      {route.name === 'study' && <Study key={location.hash} route={route} />}
      {route.name === 'settings' && <Settings />}
    </div>
  );
}
