import { describe, expect, it, vi } from 'vitest';
import worker, { secureEqual } from '../src/index';

function env(overrides: Record<string, unknown> = {}) {
  return {
    TELEGRAM_BOT_TOKEN: 'test-token',
    TELEGRAM_WEBHOOK_SECRET: 'test-secret',
    ADMIN_TELEGRAM_ID: '1146589481',
    DB: {} as D1Database,
    ...overrides
  };
}

describe('webhook güvenliği', () => {
  it('sabit zamanlı karşılaştırma doğru sonucu verir', () => {
    expect(secureEqual('abc', 'abc')).toBe(true);
    expect(secureEqual('abc', 'abd')).toBe(false);
    expect(secureEqual('abc', 'abcd')).toBe(false);
  });

  it('health dışında bilinmeyen yolları kapatır', async () => {
    expect((await worker.fetch(new Request('https://example.com/'), env())).status).toBe(404);
    const health = await worker.fetch(new Request('https://example.com/health'), env());
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({ ok: true, service: 'lina-macros-destek-bot' });
  });

  it('Telegram gizli başlığı olmadan isteği reddeder ve veritabanına dokunmaz', async () => {
    const prepare = vi.fn();
    const response = await worker.fetch(new Request('https://example.com/webhook', {
      method: 'POST', body: JSON.stringify({ update_id: 1 })
    }), env({ DB: { prepare } }));
    expect(response.status).toBe(401);
    expect(prepare).not.toHaveBeenCalled();
  });

  it('bozuk JSON isteğini reddeder', async () => {
    const response = await worker.fetch(new Request('https://example.com/webhook', {
      method: 'POST',
      headers: { 'X-Telegram-Bot-Api-Secret-Token': 'test-secret' },
      body: '{'
    }), env());
    expect(response.status).toBe(400);
  });
});
