import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { strings } from './i18n/es-MX';
import { createTestRepository } from './test/renderApp';

describe('App shell', () => {
  it('renders the app name, the privacy notice and the empty account list', async () => {
    render(<App repository={createTestRepository()} />);

    expect(screen.getByRole('heading', { level: 1, name: strings.app.name })).toBeInTheDocument();
    expect(screen.getByText(strings.privacy.localOnly)).toBeInTheDocument();
    expect(await screen.findByText(strings.accounts.emptyTitle)).toBeInTheDocument();
  });
});
