import type { Session, TelegramUser, Ticket } from './types';

export async function claimUpdate(db: D1Database, updateId: number): Promise<boolean> {
  const result = await db.prepare('INSERT OR IGNORE INTO processed_updates (update_id) VALUES (?)')
    .bind(updateId).run();
  return result.meta.changes === 1;
}

export async function getSession(db: D1Database, userId: number): Promise<Session> {
  const found = await db.prepare('SELECT * FROM user_sessions WHERE user_id = ?').bind(userId).first<Session>();
  if (found) return found;
  await db.prepare('INSERT INTO user_sessions (user_id) VALUES (?)').bind(userId).run();
  return {
    user_id: userId, state: 'idle', topic: null, last_question_id: null,
    menu_chat_id: null, menu_message_id: null, active_ticket_id: null
  };
}

export async function patchSession(db: D1Database, userId: number, values: Partial<Session>): Promise<void> {
  const allowed = ['state', 'topic', 'last_question_id', 'menu_chat_id', 'menu_message_id', 'active_ticket_id'] as const;
  const entries = allowed.filter((key) => key in values).map((key) => [key, values[key]] as const);
  if (!entries.length) return;
  const assignments = entries.map(([key]) => `${key} = ?`).join(', ');
  await db.prepare(`UPDATE user_sessions SET ${assignments}, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?`)
    .bind(...entries.map(([, value]) => value), userId).run();
}

export async function getOpenTicketForUser(db: D1Database, userId: number): Promise<Ticket | null> {
  return db.prepare("SELECT * FROM tickets WHERE user_id = ? AND status = 'open' LIMIT 1")
    .bind(userId).first<Ticket>();
}

export async function getTicket(db: D1Database, id: number): Promise<Ticket | null> {
  return db.prepare('SELECT * FROM tickets WHERE id = ? LIMIT 1').bind(id).first<Ticket>();
}

export async function getTicketByNo(db: D1Database, ticketNo: string): Promise<Ticket | null> {
  return db.prepare('SELECT * FROM tickets WHERE UPPER(ticket_no) = UPPER(?) LIMIT 1').bind(ticketNo).first<Ticket>();
}

export async function createTicket(
  db: D1Database,
  user: TelegramUser,
  topic: string,
  description: string
): Promise<Ticket> {
  const displayName = [user.first_name, user.last_name].filter(Boolean).join(' ');
  const result = await db.prepare(
    `INSERT INTO tickets (user_id, username, display_name, topic, description)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(user.id, user.username ?? null, displayName, topic, description).run();
  const id = Number(result.meta.last_row_id);
  const ticketNo = `LM-${String(id).padStart(6, '0')}`;
  await db.prepare('UPDATE tickets SET ticket_no = ? WHERE id = ?').bind(ticketNo, id).run();
  await patchSession(db, user.id, { state: 'ticket_open', active_ticket_id: id });
  return (await getTicket(db, id))!;
}

export async function addTicketMessage(
  db: D1Database, ticketId: number, role: 'customer' | 'admin' | 'system', body: string, messageId?: number
): Promise<void> {
  await db.prepare(
    `INSERT INTO ticket_messages (ticket_id, sender_role, telegram_message_id, body)
     VALUES (?, ?, ?, ?)`
  ).bind(ticketId, role, messageId ?? null, body).run();
  await db.prepare('UPDATE tickets SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').bind(ticketId).run();
}

export async function listOpenTickets(db: D1Database, limit = 20): Promise<Ticket[]> {
  const result = await db.prepare(
    "SELECT * FROM tickets WHERE status = 'open' ORDER BY updated_at DESC LIMIT ?"
  ).bind(limit).all<Ticket>();
  return result.results;
}

export async function closeTicket(db: D1Database, ticket: Ticket): Promise<void> {
  await db.batch([
    db.prepare("UPDATE tickets SET status = 'closed', closed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'open'").bind(ticket.id),
    db.prepare("UPDATE user_sessions SET state = 'idle', active_ticket_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE user_id = ?").bind(ticket.user_id),
    db.prepare("INSERT INTO ticket_messages (ticket_id, sender_role, body) VALUES (?, 'system', 'Talep yönetici tarafından kapatıldı.')").bind(ticket.id)
  ]);
}
