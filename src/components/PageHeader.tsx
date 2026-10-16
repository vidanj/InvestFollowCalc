import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { strings } from '../i18n/es-MX';

interface PageHeaderProps {
  title: string;
  backTo?: string;
  actions?: ReactNode;
  children?: ReactNode;
}

export function PageHeader({ title, backTo, actions, children }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-2">
      {backTo && (
        <Link to={backTo} className="text-sm text-teal-700 hover:underline dark:text-teal-400">
          ← {strings.common.back}
        </Link>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">{title}</h2>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  );
}
