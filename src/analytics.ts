export async function recordUser(db: D1Database, userId: number): Promise<void> {
  await db.prepare(`INSERT INTO bot_users (user_id) VALUES (?) ON CONFLICT(user_id) DO UPDATE SET last_seen_at = CURRENT_TIMESTAMP`).bind(userId).run();
}
export async function recordEvents(db: D1Database, userId: number, events: Array<[string, string?]>): Promise<void> {
  if (!events.length) return;
  await db.batch(events.map(([type, entity]) => db.prepare(`INSERT INTO analytics_events (user_id,event_type,entity_id,is_test) VALUES (?,?,?,COALESCE((SELECT is_test FROM bot_users WHERE user_id=?),0))`).bind(userId, type, entity ?? null, userId)));
}
export async function statsReport(db: D1Database): Promise<string> {
  const counts = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM bot_users WHERE is_test=0) total_users,
    (SELECT COUNT(*) FROM bot_users WHERE is_test=0 AND date(last_seen_at,'+3 hours')=date('now','+3 hours')) today_users,
    (SELECT COUNT(*) FROM bot_users WHERE is_test=0 AND date(last_seen_at,'+3 hours')>=date('now','+3 hours','-6 days')) users_7,
    (SELECT COUNT(*) FROM bot_users WHERE is_test=0 AND date(last_seen_at,'+3 hours')>=date('now','+3 hours','-29 days')) users_30,
    (SELECT COUNT(*) FROM analytics_events WHERE is_test=0 AND event_type='menu_interaction') menu_total,
    (SELECT COUNT(*) FROM tickets) tickets_total,
    (SELECT COUNT(*) FROM tickets WHERE status='open') tickets_open,
    (SELECT COUNT(*) FROM tickets WHERE status='closed') tickets_closed,
    (SELECT COUNT(DISTINCT user_id) FROM analytics_events WHERE is_test=0 AND event_type='resolved') resolved_users`).first<Record<string, number>>();
  const topCategories = await db.prepare(`SELECT c.label, COUNT(*) count FROM analytics_events e JOIN bot_categories c ON c.id=e.entity_id WHERE e.event_type='category_select' AND e.is_test=0 GROUP BY e.entity_id ORDER BY count DESC LIMIT 5`).all<{label:string;count:number}>();
  const topQuestions = await db.prepare(`SELECT q.label, COUNT(*) count FROM analytics_events e JOIN bot_questions q ON q.id=e.entity_id WHERE e.event_type='question_select' AND e.is_test=0 GROUP BY e.entity_id ORDER BY count DESC LIMIT 5`).all<{label:string;count:number}>();
  const list = (rows: Array<{label:string;count:number}>) => rows.length ? rows.map((item, i) => `${i + 1}. ${item.label} — ${item.count}`).join('\n') : 'Henüz veri yok';
  return `📊 Lina Macros Bot İstatistikleri\nTürkiye saati: ${new Intl.DateTimeFormat('tr-TR',{timeZone:'Europe/Istanbul',dateStyle:'medium',timeStyle:'short'}).format(new Date())}\n\n👥 Benzersiz kullanıcı\nToplam: ${counts?.total_users ?? 0}\nBugün: ${counts?.today_users ?? 0}\nSon 7 gün: ${counts?.users_7 ?? 0}\nSon 30 gün: ${counts?.users_30 ?? 0}\n\n🧭 Menü etkileşimi: ${counts?.menu_total ?? 0}\n\nEn çok seçilen kategoriler\n${list(topCategories.results)}\n\nEn çok sorulan sorular\n${list(topQuestions.results)}\n\n🎫 Talepler\nToplam: ${counts?.tickets_total ?? 0}\nAçık: ${counts?.tickets_open ?? 0}\nKapatılmış: ${counts?.tickets_closed ?? 0}\n\n✅ Sorunu çözülen benzersiz kullanıcı: ${counts?.resolved_users ?? 0}`;
}
