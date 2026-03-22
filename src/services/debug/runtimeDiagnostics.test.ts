import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadRuntimeDiagnosticsModule() {
  vi.resetModules();
  return import('./runtimeDiagnostics');
}

describe('runtimeDiagnostics', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('appendRuntimeDiagnostic 会规范化 detail、写入存储并安装 window API', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const diagnostics = await loadRuntimeDiagnosticsModule();

    diagnostics.appendRuntimeDiagnostic('player', 'stream-error', {
      error: new Error('boom'),
      nested: {
        list: Array.from({ length: 20 }, (_, index) => ({ index })),
      },
    }, 'warn');

    const entries = diagnostics.readRecentRuntimeDiagnostics();
    expect(entries).toHaveLength(1);
    expect(entries[0]?.detail).toMatchObject({
      error: {
        name: 'Error',
        message: 'boom',
      },
      nested: {
        list: expect.any(Array),
      },
    });
    expect((entries[0]?.detail as { nested: { list: unknown[] } }).nested.list).toHaveLength(12);
    expect(consoleWarn).toHaveBeenCalledTimes(1);

    const apiWindow = window as typeof window & {
      __biliRuntimeDiagnostics?: {
        readRecent: (limit?: number) => unknown[];
        clear: () => void;
      };
    };
    expect(apiWindow.__biliRuntimeDiagnostics?.readRecent(1)).toHaveLength(1);
  });

  it('最多只保留最近 80 条，并支持 clear', async () => {
    const consoleInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    const diagnostics = await loadRuntimeDiagnosticsModule();

    for (let index = 0; index < 90; index += 1) {
      diagnostics.appendRuntimeDiagnostic('home', `event-${index}`);
    }

    const entries = diagnostics.readRecentRuntimeDiagnostics(100);
    expect(entries).toHaveLength(80);
    expect(entries[0]?.event).toBe('event-10');
    expect(entries.at(-1)?.event).toBe('event-89');

    diagnostics.clearRuntimeDiagnostics();
    expect(diagnostics.readRecentRuntimeDiagnostics(100)).toEqual([]);
    expect(consoleInfo).toHaveBeenCalled();
  });
});
