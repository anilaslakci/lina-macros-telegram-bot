import { claimUpdate } from './db';
import { handleUpdate } from './handler';
import { TelegramClient } from './telegram';
import type { Env, TelegramUpdate } from './types';

function secureEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  return mismatch === 0;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return Response.json({ ok: true, service: 'lina-macros-destek-bot' });
    }
    if (request.method !== 'POST' || url.pathname !== '/webhook') {
      return new Response('Not found', { status: 404 });
    }

    const suppliedSecret = request.headers.get('X-Telegram-Bot-Api-Secret-Token') ?? '';
    if (!env.TELEGRAM_WEBHOOK_SECRET || !secureEqual(suppliedSecret, env.TELEGRAM_WEBHOOK_SECRET)) {
      return new Response('Unauthorized', { status: 401 });
    }

    let update: TelegramUpdate;
    try {
      update = await request.json<TelegramUpdate>();
      if (!Number.isSafeInteger(update.update_id)) throw new Error('Missing update_id');
    } catch {
      return new Response('Bad request', { status: 400 });
    }

    const claimed = await claimUpdate(env.DB, update.update_id);
    if (!claimed) return new Response('OK');

    try {
      await handleUpdate(new TelegramClient(env.TELEGRAM_BOT_TOKEN), env, update);
      return new Response('OK');
    } catch (error) {
      await env.DB.prepare('DELETE FROM processed_updates WHERE update_id = ?').bind(update.update_id).run();
      console.error('telegram_update_failed', {
        updateId: update.update_id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return new Response('Temporary failure', { status: 500 });
    }
  }
};

export { secureEqual };
