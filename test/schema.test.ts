import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'migrations/0001_init.sql'), 'utf8');

describe('D1 şeması', () => {
  it('bir kullanıcı için yalnızca bir açık talebe izin verir', () => {
    expect(schema).toMatch(/UNIQUE INDEX[\s\S]+ON tickets\(user_id\) WHERE status = 'open'/i);
  });

  it('güncelleme tekrarı ve mesaj geçmişi tablolarını içerir', () => {
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS processed_updates');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS ticket_messages');
    expect(schema).toContain("CHECK (sender_role IN ('customer', 'admin', 'system'))");
  });
});
