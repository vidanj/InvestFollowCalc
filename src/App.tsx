import { HashRouter } from 'react-router';
import type { Repository } from './db/repository';
import { RepositoryProvider } from './db/RepositoryProvider';
import { AppRoutes } from './routes';

// HashRouter keeps every route on the same document, so GitHub Pages and the offline cache
// never need server-side rewrites.
export function App({ repository }: { repository: Repository }) {
  return (
    <RepositoryProvider repository={repository}>
      <HashRouter>
        <AppRoutes />
      </HashRouter>
    </RepositoryProvider>
  );
}
