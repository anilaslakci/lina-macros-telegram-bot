import { describe, expect, it } from 'vitest';
import { reusableMenuMessage } from '../src/handler';
import type { Session } from '../src/types';

const base: Session = {
  user_id: 42,
  state: 'idle',
  topic: null,
  last_question_id: null,
  menu_chat_id: 42,
  menu_message_id: 99,
  active_ticket_id: null
};

describe('menü mesajını tekrar kullanma', () => {
  it('aynı sohbette eski menü mesajını döndürür', () => {
    expect(reusableMenuMessage(base, 42)).toBe(99);
  });

  it('farklı sohbet veya kayıtlı mesaj yoksa yeni mesaj gerektirir', () => {
    expect(reusableMenuMessage(base, 7)).toBeUndefined();
    expect(reusableMenuMessage({ ...base, menu_message_id: null }, 42)).toBeUndefined();
  });
});
