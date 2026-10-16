import { Navigate, Route, Routes } from 'react-router';
import { Layout } from './components/Layout';
import { AccountDetailPage } from './features/accounts/AccountDetailPage';
import { EditAccountPage, NewAccountPage } from './features/accounts/AccountFormPage';
import { MovementFormPage } from './features/movements/MovementFormPage';
import { PortfolioPage } from './features/portfolio/PortfolioPage';
import { SettingsPage } from './features/settings/SettingsPage';

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
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
