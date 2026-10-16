import { useState } from 'react';
import { strings } from '../i18n/es-MX';
import { Button } from './Button';

interface ConfirmButtonProps {
  label: string;
  warning: string;
  onConfirm: () => void;
}

/** A destructive action that asks for an explicit second click before running. */
export function ConfirmButton({ label, warning, onConfirm }: ConfirmButtonProps) {
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <Button
        variant="secondary"
        onClick={() => {
          setAsking(true);
        }}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-red-300 p-3 dark:border-red-800">
      <p className="text-sm">{warning}</p>
      <div className="flex gap-2">
        <Button variant="danger" onClick={onConfirm}>
          {strings.common.confirmDelete}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            setAsking(false);
          }}
        >
          {strings.common.cancel}
        </Button>
      </div>
    </div>
  );
}
