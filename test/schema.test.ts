import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(resolve(process.cwd(), 'migrations/0001_init.sql'), 'utf8');
const managementSchema = readFileSync(resolve(process.cwd(), 'migrations/0002_content_analytics.sql'), 'utf8');

describe('D1 şeması', () => {
  it('bir kullanıcı için yalnızca bir açık talebe izin verir', () => {
    expect(schema).toMatch(/UNIQUE INDEX[\s\S]+ON tickets\(user_id\) WHERE status = 'open'/i);
  });

  it('içerik yönetimi ve anonimleştirilmiş olay tablolarını ekler, mevcut talepleri silmez', () => {
    for (const table of ['bot_users', 'analytics_events', 'bot_categories', 'bot_questions', 'bot_secondary_questions', 'admin_drafts', 'admin_history']) {
      expect(managementSchema).toContain(`CREATE TABLE IF NOT EXISTS ${table}`);
    }
    expect(managementSchema).not.toMatch(/DROP TABLE|DELETE FROM tickets/i);
    expect(managementSchema).not.toContain('message_body');
  });

  it('güncelleme tekrarı ve mesaj geçmişi tablolarını içerir', () => {
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS processed_updates');
    expect(schema).toContain('CREATE TABLE IF NOT EXISTS ticket_messages');
    expect(schema).toContain("CHECK (sender_role IN ('customer', 'admin', 'system'))");
  });
});
