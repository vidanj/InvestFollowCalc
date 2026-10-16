import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App';
import { strings } from './i18n/es-MX';

describe('App shell', () => {
  it('renders the app name and the local-only privacy notice', () => {
    render(<App />);

    expect(screen.getByRole('heading', { level: 1, name: strings.app.name })).toBeInTheDocument();
    expect(screen.getByText(strings.privacy.localOnly)).toBeInTheDocument();
  });
});
