import { createMockOpenDesignHost } from '@open-design/host/testing';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  setDesktopPetVisible,
  setTauriCoreLoaderForTests,
} from '../../src/native/desktop-bridge';

describe('desktop pet native visibility bridge', () => {
  afterEach(() => {
    setTauriCoreLoaderForTests(null);
    vi.unstubAllGlobals();
  });

  it('uses the Electron host bridge when it is available', async () => {
    const setVisible = vi.fn();
    const invoke = vi.fn();
    setTauriCoreLoaderForTests(async () => ({
      invoke: invoke as unknown as <T>(command: string, args?: Record<string, unknown>) => Promise<T>,
    }));
    vi.stubGlobal('window', {
      __od__: createMockOpenDesignHost({
        pet: { setVisible },
      }),
      __TAURI_INTERNALS__: {},
    } as unknown as Window & typeof globalThis);

    await setDesktopPetVisible(true);

    expect(setVisible).toHaveBeenCalledWith(true);
    expect(invoke).not.toHaveBeenCalled();
  });

  it('falls back to Tauri command IPC when no host bridge is installed', async () => {
    const invoke = vi.fn(async () => undefined);
    setTauriCoreLoaderForTests(async () => ({
      invoke: invoke as unknown as <T>(command: string, args?: Record<string, unknown>) => Promise<T>,
    }));
    vi.stubGlobal('window', {
      __TAURI_INTERNALS__: {},
    } as unknown as Window & typeof globalThis);

    await setDesktopPetVisible(false);

    expect(invoke).toHaveBeenCalledWith('desktop_set_pet_visible', { visible: false });
  });
});
