import { afterEach, describe, expect, it, vi } from 'vitest';
import { saveBackupFile } from '../fileSave';

type PickerWindow = Window & { showSaveFilePicker?: unknown };

afterEach(() => {
  delete (window as PickerWindow).showSaveFilePicker;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  // jsdom has no Web Share API; remove what a test may have added.
  delete (navigator as { canShare?: unknown }).canShare;
  delete (navigator as { share?: unknown }).share;
});

const abort = () => new DOMException('The user aborted a request.', 'AbortError');

describe('saveBackupFile', () => {
  it('uses the native save dialog when available', async () => {
    const write = vi.fn(() => Promise.resolve());
    const close = vi.fn(() => Promise.resolve());
    const picker = vi.fn(() =>
      Promise.resolve({ createWritable: () => Promise.resolve({ write, close }) }),
    );
    (window as PickerWindow).showSaveFilePicker = picker;

    expect(await saveBackupFile('r.json', '{"a":1}', 'Respaldo')).toBe('saved');
    expect(picker).toHaveBeenCalledWith(expect.objectContaining({ suggestedName: 'r.json' }));
    expect(write).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce();
  });

  it('reports a cancelled save dialog', async () => {
    (window as PickerWindow).showSaveFilePicker = () => Promise.reject(abort());
    expect(await saveBackupFile('r.json', '{}', 'Respaldo')).toBe('cancelled');
  });

  it('uses the share sheet on phones', async () => {
    const share = vi.fn(() => Promise.resolve());
    Object.assign(navigator, { canShare: () => true, share });

    expect(await saveBackupFile('r.json', '{}', 'Respaldo')).toBe('shared');
    const [[shareData]] = share.mock.calls as unknown as [[{ files: File[] }]];
    expect(shareData.files[0]?.name).toBe('r.json');
  });

  it('reports a dismissed share sheet', async () => {
    Object.assign(navigator, { canShare: () => true, share: () => Promise.reject(abort()) });
    expect(await saveBackupFile('r.json', '{}', 'Respaldo')).toBe('cancelled');
  });

  it('falls back to a download, also when the picker fails for other reasons', async () => {
    (window as PickerWindow).showSaveFilePicker = () => Promise.reject(new Error('iframe'));
    const createObjectURL = vi.fn(() => 'blob:backup');
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() }));
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(() => undefined);

    expect(await saveBackupFile('r.json', '{}', 'Respaldo')).toBe('downloaded');
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download]')).toBeNull();
  });
});
