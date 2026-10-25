import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { AccountDetailPage } from './features/accounts/AccountDetailPage';
import { EditAccountPage, NewAccountPage } from './features/accounts/AccountFormPage';
import { MovementFormPage } from './features/movements/MovementFormPage';
import { PortfolioPage } from './features/portfolio/PortfolioPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { strings } from './i18n/es-MX';

// Backups pull in zod and the crypto code: loaded only when the page is opened.
const BackupPage = lazy(() =>
  import('./features/backup/BackupPage').then((m) => ({ default: m.BackupPage })),
);

// The budget and credits are a section of their own: loaded on first visit, so opening the
// portfolio stays as light as before.
const BudgetPage = lazy(() =>
  import('./features/budget/BudgetPage').then((m) => ({ default: m.BudgetPage })),
);
const BudgetItemFormPage = lazy(() =>
  import('./features/budget/BudgetItemFormPage').then((m) => ({ default: m.BudgetItemFormPage })),
);
const CreditDetailPage = lazy(() =>
  import('./features/credits/CreditDetailPage').then((m) => ({ default: m.CreditDetailPage })),
);
const NewCreditPage = lazy(() =>
  import('./features/credits/CreditFormPage').then((m) => ({ default: m.NewCreditPage })),
);
const EditCreditPage = lazy(() =>
  import('./features/credits/CreditFormPage').then((m) => ({ default: m.EditCreditPage })),
);
const CreditPlanFormPage = lazy(() =>
  import('./features/credits/CreditPlanFormPage').then((m) => ({ default: m.CreditPlanFormPage })),
);

function Lazy({ children }: { children: ReactNode }) {
  return <Suspense fallback={<p>{strings.common.loading}</p>}>{children}</Suspense>;
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<PortfolioPage />} />
        <Route path="accounts/new" element={<NewAccountPage />} />
        <Route path="accounts/:accountId" element={<AccountDetailPage />} />
        <Route path="accounts/:accountId/edit" element={<EditAccountPage />} />
        <Route path="accounts/:accountId/movements/new" element={<MovementFormPage />} />
        <Route path="accounts/:accountId/movements/:eventId" element={<MovementFormPage />} />
        <Route
          path="budget"
          element={
            <Lazy>
              <BudgetPage />
            </Lazy>
          }
        />
        <Route
          path="budget/items/new"
          element={
            <Lazy>
              <BudgetItemFormPage />
            </Lazy>
          }
        />
        <Route
          path="budget/items/:itemId"
          element={
            <Lazy>
              <BudgetItemFormPage />
            </Lazy>
          }
        />
        <Route
          path="credits/new"
          element={
            <Lazy>
              <NewCreditPage />
            </Lazy>
          }
        />
        <Route
          path="credits/:creditId"
          element={
            <Lazy>
              <CreditDetailPage />
            </Lazy>
          }
        />
        <Route
          path="credits/:creditId/edit"
          element={
            <Lazy>
              <EditCreditPage />
            </Lazy>
          }
        />
        <Route
          path="credits/:creditId/balance"
          element={
            <Lazy>
              <CreditPlanFormPage />
            </Lazy>
          }
        />
        <Route
          path="backup"
          element={
            <Lazy>
              <BackupPage />
            </Lazy>
          }
        />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
