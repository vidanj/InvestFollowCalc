export type SaveOutcome = 'saved' | 'shared' | 'downloaded' | 'cancelled';

interface SaveFilePickerWindow {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: { description: string; accept: Record<string, string[]> }[];
  }) => Promise<{
    createWritable: () => Promise<{
      write: (data: Blob) => Promise<void>;
      close: () => Promise<void>;
    }>;
  }>;
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError';
}

/**
 * Hands the backup file to the user, never to a server:
 * 1. desktop Chromium: native "Save as" dialog;
 * 2. phones: the share sheet (save to Files, the user's own Drive, etc.);
 * 3. anything else: a regular download.
 */
export async function saveBackupFile(
  fileName: string,
  text: string,
  description: string,
): Promise<SaveOutcome> {
  const blob = new Blob([text], { type: 'application/json' });
  const picker = (window as SaveFilePickerWindow).showSaveFilePicker;

  if (picker) {
    try {
      const handle = await picker({
        suggestedName: fileName,
        types: [{ description, accept: { 'application/json': ['.json'] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(blob);
      await writable.close();
      return 'saved';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
      // Picker unavailable in this context (e.g. iframe): fall through to the other methods.
    }
  }

  const file = new File([blob], fileName, { type: 'application/json' });
  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: fileName });
      return 'shared';
    } catch (error) {
      if (isAbort(error)) return 'cancelled';
    }
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 0);
  return 'downloaded';
}
