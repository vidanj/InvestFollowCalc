import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import type { Repository } from '../../db/repository';
import type { Currency } from '../../domain/types';
import { strings } from '../../i18n/es-MX';
import { createTestRepository, daysAgo, renderRoute } from '../../test/renderApp';

async function seed(
  repository: Repository,
  name: string,
  currency: Currency,
  balances: [daysAgo: number, cents: number][],
) {
  const [[initialAgo, initialBalance], ...rest] = balances as [
    [number, number],
    ...[number, number][],
  ];
  const account = await repository.createAccount({
    name,
    currency,
    color: '#2a78d6',
    initialBalance,
    initialDate: daysAgo(initialAgo),
  });
  for (const [ago, balance] of rest) {
    await repository.addEvent(account.id, { type: 'balance', date: daysAgo(ago), balance });
  }
  return account;
}

function statIn(container: HTMLElement, label: string): HTMLElement {
  return within(container).getByText(label, { selector: 'dt' }).parentElement as HTMLElement;
}

describe('portfolio', () => {
  it('shows totals per currency and leaves archived accounts out', async () => {
    const repository = createTestRepository();
    await seed(repository, 'Ahorro', 'MXN', [
      [20, 100_000],
      [5, 101_000],
    ]);
    const archived = await seed(repository, 'Vieja', 'MXN', [
      [20, 500_000],
      [5, 600_000],
    ]);
    await repository.updateAccount(archived.id, { archived: true });
    await seed(repository, 'Broker', 'USD', [
      [20, 10_000],
      [5, 10_100],
    ]);
    renderRoute('/', repository);

    const mxn = (await screen.findByRole('heading', { name: strings.currencyNames.MXN }))
      .parentElement as HTMLElement;
    expect(
      within(statIn(mxn, strings.portfolio.totalBalance)).getByText('$1,010.00'),
    ).toBeVisible();
    expect(within(statIn(mxn, strings.account.totalGain)).getByText('+$10.00')).toBeVisible();
    expect(within(mxn).queryByText('Vieja')).toBeNull();

    const usd = screen.getByRole('heading', { name: strings.currencyNames.USD })
      .parentElement as HTMLElement;
    expect(
      within(statIn(usd, strings.portfolio.totalBalance)).getByText(/USD\s101\.00/),
    ).toBeVisible();

    expect(screen.getByText(new RegExp(`${strings.accounts.archivedTitle} \\(1\\)`))).toBeVisible();
    expect(screen.getByText(strings.portfolio.archivedNote)).toBeInTheDocument();
  });

  it('explains when every account is archived', async () => {
    const repository = createTestRepository();
    const account = await seed(repository, 'Ahorro', 'MXN', [[3, 100_000]]);
    await repository.updateAccount(account.id, { archived: true });
    renderRoute('/', repository);

    expect(await screen.findByText(strings.portfolio.allArchived)).toBeVisible();
  });
});

describe('account evolution', () => {
  it('shows the charts, best/worst periods, and scopes them with the range filter', async () => {
    const repository = createTestRepository();
    const account = await seed(repository, 'Ahorro', 'MXN', [
      [200, 100_000],
      [150, 101_000],
      [10, 102_000],
    ]);
    const { user } = renderRoute(`/accounts/${account.id}`, repository);

    const section = (await screen.findByRole('heading', { name: strings.charts.evolutionTitle }))
      .parentElement as HTMLElement;
    // Charts load lazily in their own chunk.
    for (const title of [
      strings.charts.balanceTitle,
      strings.charts.gainTitle,
      strings.charts.periodGainTitle,
      strings.charts.periodRateTitle,
    ]) {
      expect(await within(section).findByText(title)).toBeInTheDocument();
    }

    // +$10 on 1,000 (+1.00%) beats +$10 on 1,010 (+0.99%): compared by return rate.
    expect(statIn(document.body, strings.account.bestPeriod)).toHaveTextContent('+1.00%');
    expect(statIn(document.body, strings.account.worstPeriod)).toHaveTextContent('+0.99%');

    const breakdown = () =>
      within(
        within(section).getByRole('list', { name: strings.account.periodsTitle }),
      ).getAllByRole('listitem');
    expect(breakdown()).toHaveLength(2);

    await user.click(within(section).getByLabelText(strings.charts.ranges['1M']));
    expect(breakdown()).toHaveLength(1);
    expect(within(section).getAllByText(strings.charts.notEnoughData).length).toBeGreaterThan(0);

    await user.click(within(section).getByLabelText(strings.charts.ranges.ALL));
    expect(breakdown()).toHaveLength(2);
  });

  it('offers every chart value as a table', async () => {
    const repository = createTestRepository();
    const account = await seed(repository, 'Ahorro', 'MXN', [
      [20, 100_000],
      [5, 101_000],
    ]);
    const { user } = renderRoute(`/accounts/${account.id}`, repository);

    await user.click(await screen.findByText(strings.charts.showData));
    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText('+$10.00')).toBeInTheDocument();
  });
});

describe('settings', () => {
  afterEach(() => {
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  it('switches the theme and remembers it on this device', async () => {
    const { user } = renderRoute('/settings');

    await user.click(await screen.findByLabelText(strings.settings.themes.dark));
    expect(document.documentElement.dataset.theme).toBe('dark');
    expect(localStorage.getItem('investfollowcalc.theme')).toBe('dark');

    await user.click(screen.getByLabelText(strings.settings.themes.system));
    expect(document.documentElement.dataset.theme).toBeUndefined();
    expect(localStorage.getItem('investfollowcalc.theme')).toBeNull();
  });

  it('shows privacy information and the app version', async () => {
    renderRoute('/settings');
    expect(await screen.findByText(strings.settings.privacyBody[1])).toBeVisible();
    expect(screen.getByText(new RegExp(strings.settings.version(__APP_VERSION__)))).toBeVisible();
    expect(await screen.findByText(strings.settings.storageUnknown)).toBeVisible();
  });

  it('marks the active section in the navigation', async () => {
    renderRoute('/settings');
    const links = await screen.findAllByRole('link', { name: strings.nav.settings });
    expect(links[0]).toHaveAttribute('aria-current', 'page');
    const portfolio = screen.getAllByRole('link', { name: strings.nav.portfolio });
    expect(portfolio[0]).not.toHaveAttribute('aria-current');
  });
});

describe('install card', () => {
  it('explains how to install when the browser offers no button', async () => {
    renderRoute('/settings');
    expect(await screen.findByText(strings.settings.installWhy)).toBeVisible();
    expect(screen.getByText(strings.settings.installOther)).toBeVisible();
  });
});
