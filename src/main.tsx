import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { Repository } from './db/repository';
import { createDb } from './db/schema';
import './styles/index.css';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error('Root element #root not found');
}

const repository = new Repository(createDb());

createRoot(rootElement).render(
  <StrictMode>
    <App repository={repository} />
  </StrictMode>,
);
