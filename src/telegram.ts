import type { InlineButton } from './types';

export type Keyboard = InlineButton[][];

export class TelegramClient {
  constructor(private readonly token: string) {}

  private async call<T>(method: string, body: Record<string, unknown>): Promise<T> {
    const response = await fetch(`https://api.telegram.org/bot${this.token}/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const payload = await response.json() as { ok: boolean; result?: T; description?: string };
    if (!response.ok || !payload.ok) {
      throw new Error(`Telegram ${method} failed (${response.status}): ${payload.description ?? 'unknown error'}`);
    }
    return payload.result as T;
  }

  sendMessage(chatId: number, text: string, keyboard?: Keyboard): Promise<{ message_id: number }> {
    return this.call('sendMessage', {
      chat_id: chatId,
      text,
      disable_web_page_preview: true,
      ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {})
    });
  }

  async editMessage(chatId: number, messageId: number, text: string, keyboard?: Keyboard): Promise<void> {
    try {
      await this.call('editMessageText', {
        chat_id: chatId,
        message_id: messageId,
        text,
        disable_web_page_preview: true,
        ...(keyboard ? { reply_markup: { inline_keyboard: keyboard } } : {})
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (!message.includes('message is not modified')) throw error;
    }
  }

  async answerCallback(id: string, text?: string): Promise<void> {
    await this.call('answerCallbackQuery', { callback_query_id: id, ...(text ? { text } : {}) });
  }
}
