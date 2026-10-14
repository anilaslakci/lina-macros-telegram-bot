import type { CallbackQuery, Env, Session, TelegramMessage, TelegramUpdate, TelegramUser, Ticket } from './types';
import { TelegramClient } from './telegram';
import {
  addTicketMessage, closeTicket, createTicket, getOpenTicketForUser, getSession,
  getTicket, getTicketByNo, listOpenTickets, patchSession
} from './db';
import {
  categoryMenu, config, findCategory, findQuestion, mainMenu, resolutionMenu, secondaryMenu
} from './ui';

const HELP_TEXT = 'Komutlar:\n/start veya /menu — Ana menü\n/help — Yardım\n\nMenülerden ilerleyerek hazır yanıtlara ulaşabilirsin. Sorun çözülmezse ilgili akışın sonunda canlı destek talebi açabilirsin.';

function isAdmin(userId: number, env: Env): boolean {
  return String(userId) === env.ADMIN_TELEGRAM_ID;
}

function displayUser(user: TelegramUser): string {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ');
  return user.username ? `${name} (@${user.username})` : name;
}

function ticketSummary(ticket: Ticket): string {
  return `🎫 ${ticket.ticket_no}\nMüşteri: ${ticket.display_name}${ticket.username ? ` (@${ticket.username})` : ''}\nKonu: ${ticket.topic}\nAçıklama: ${ticket.description}`;
}

async function showMainMenu(tg: TelegramClient, env: Env, userId: number, chatId: number, messageId?: number): Promise<void> {
  const text = config.welcome;
  if (messageId) {
    try {
      await tg.editMessage(chatId, messageId, text, mainMenu());
      await patchSession(env.DB, userId, { state: 'idle', menu_chat_id: chatId, menu_message_id: messageId });
      return;
    } catch {
      // Kullanıcı eski menü mesajını sildiyse yeni bir menü gönderilir.
    }
  }
  const sent = await tg.sendMessage(chatId, text, mainMenu());
  await patchSession(env.DB, userId, { state: 'idle', menu_chat_id: chatId, menu_message_id: sent.message_id });
}

export function reusableMenuMessage(session: Session, chatId: number): number | undefined {
  return session.menu_chat_id === chatId ? session.menu_message_id ?? undefined : undefined;
}

async function notifyAdminNewTicket(tg: TelegramClient, env: Env, ticket: Ticket): Promise<void> {
  await tg.sendMessage(Number(env.ADMIN_TELEGRAM_ID), `🔔 Yeni destek talebi\n\n${ticketSummary(ticket)}`, [
    [{ text: '✍️ Yanıtla', callback_data: `ar:${ticket.id}` }, { text: '✅ Kapat', callback_data: `ac:${ticket.id}` }]
  ]);
}

async function handleAdminCommand(tg: TelegramClient, env: Env, message: TelegramMessage, text: string): Promise<boolean> {
  const userId = message.from!.id;
  if (!isAdmin(userId, env)) return false;
  const [command, ...rest] = text.trim().split(/\s+/);

  if (command === '/tickets') {
    const tickets = await listOpenTickets(env.DB);
    if (!tickets.length) {
      await tg.sendMessage(message.chat.id, 'Şu anda açık destek talebi yok.');
      return true;
    }
    const lines = tickets.map((ticket) => `${ticket.ticket_no} — ${ticket.display_name} — ${ticket.topic}`);
    await tg.sendMessage(message.chat.id, `Açık talepler (${tickets.length}):\n\n${lines.join('\n')}\n\nYanıt: /reply LM-000001 mesajın\nKapat: /close LM-000001`);
    return true;
  }

  if (command === '/reply') {
    const ticketNo = rest.shift();
    const reply = rest.join(' ').trim();
    if (!ticketNo || !reply) {
      await tg.sendMessage(message.chat.id, 'Kullanım: /reply LM-000001 mesajın');
      return true;
    }
    const ticket = await getTicketByNo(env.DB, ticketNo);
    if (!ticket || ticket.status !== 'open') {
      await tg.sendMessage(message.chat.id, 'Açık talep bulunamadı.');
      return true;
    }
    await addTicketMessage(env.DB, ticket.id, 'admin', reply, message.message_id);
    await tg.sendMessage(ticket.user_id, `💬 Lina Macros destek yanıtı — ${ticket.ticket_no}\n\n${reply}\n\nBu mesaja yazarak aynı talep içinde cevap verebilirsin.`);
    await tg.sendMessage(message.chat.id, `${ticket.ticket_no} talebine yanıt iletildi.`);
    return true;
  }

  if (command === '/close') {
    const ticketNo = rest[0];
    if (!ticketNo) {
      await tg.sendMessage(message.chat.id, 'Kullanım: /close LM-000001');
      return true;
    }
    const ticket = await getTicketByNo(env.DB, ticketNo);
    if (!ticket || ticket.status !== 'open') {
      await tg.sendMessage(message.chat.id, 'Açık talep bulunamadı.');
      return true;
    }
    await closeTicket(env.DB, ticket);
    await tg.sendMessage(ticket.user_id, `✅ ${ticket.ticket_no} numaralı destek talebin kapatıldı. Yeni bir konu için /menu komutunu kullanabilirsin.`);
    await tg.sendMessage(message.chat.id, `${ticket.ticket_no} kapatıldı.`);
    return true;
  }
  return false;
}

async function handleMessage(tg: TelegramClient, env: Env, message: TelegramMessage): Promise<void> {
  if (!message.from || message.chat.type !== 'private') return;
  const text = message.text?.trim();
  if (!text) return;
  const user = message.from;
  const session = await getSession(env.DB, user.id);

  if (await handleAdminCommand(tg, env, message, text)) return;
  const command = text.split(/\s+/)[0].split('@')[0];
  if (command === '/start' || command === '/menu') {
    await showMainMenu(tg, env, user.id, message.chat.id, reusableMenuMessage(session, message.chat.id));
    return;
  }
  if (command === '/help') {
    const adminExtra = isAdmin(user.id, env) ? '\n\nYönetici: /tickets, /reply, /close' : '';
    await tg.sendMessage(message.chat.id, HELP_TEXT + adminExtra);
    return;
  }

  if (isAdmin(user.id, env) && session.state === 'admin_reply' && session.active_ticket_id) {
    const ticket = await getTicket(env.DB, session.active_ticket_id);
    if (!ticket || ticket.status !== 'open') {
      await patchSession(env.DB, user.id, { state: 'idle', active_ticket_id: null });
      await tg.sendMessage(message.chat.id, 'Bu talep artık açık değil.');
      return;
    }
    await addTicketMessage(env.DB, ticket.id, 'admin', text, message.message_id);
    await tg.sendMessage(ticket.user_id, `💬 Lina Macros destek yanıtı — ${ticket.ticket_no}\n\n${text}\n\nBu mesaja yazarak aynı talep içinde cevap verebilirsin.`);
    await patchSession(env.DB, user.id, { state: 'idle', active_ticket_id: null });
    await tg.sendMessage(message.chat.id, `${ticket.ticket_no} talebine yanıt iletildi.`);
    return;
  }

  if (session.state === 'awaiting_description') {
    if (text.length < 10) {
      await tg.sendMessage(message.chat.id, 'Sorunu anlayabilmemiz için lütfen en az 10 karakterle biraz daha ayrıntı yaz.');
      return;
    }
    const existing = await getOpenTicketForUser(env.DB, user.id);
    if (existing) {
      await patchSession(env.DB, user.id, { state: 'ticket_open', active_ticket_id: existing.id });
      await tg.sendMessage(message.chat.id, `Zaten açık bir talebin var: ${existing.ticket_no}. Yeni mesajların bu talebe eklenecek.`);
      return;
    }
    try {
      const ticket = await createTicket(env.DB, user, session.topic ?? 'Genel destek', text);
      await addTicketMessage(env.DB, ticket.id, 'customer', text, message.message_id);
      await notifyAdminNewTicket(tg, env, ticket);
      await tg.sendMessage(message.chat.id, `Talebin oluşturuldu: ${ticket.ticket_no}\n\nYanıt geldiğinde buradan ileteceğiz. Kesin bir yanıt süresi taahhüt edemiyoruz; mesajlarını bu sohbetten aynı talebe ekleyebilirsin.`);
    } catch (error) {
      const raceWinner = await getOpenTicketForUser(env.DB, user.id);
      if (!raceWinner) throw error;
      await patchSession(env.DB, user.id, { state: 'ticket_open', active_ticket_id: raceWinner.id });
      await tg.sendMessage(message.chat.id, `Zaten açık bir talebin var: ${raceWinner.ticket_no}.`);
    }
    return;
  }

  const openTicket = await getOpenTicketForUser(env.DB, user.id);
  if (openTicket) {
    await addTicketMessage(env.DB, openTicket.id, 'customer', text, message.message_id);
    await tg.sendMessage(Number(env.ADMIN_TELEGRAM_ID), `💬 ${openTicket.ticket_no} müşteri yanıtı\nGönderen: ${displayUser(user)}\n\n${text}`, [
      [{ text: '✍️ Yanıtla', callback_data: `ar:${openTicket.id}` }, { text: '✅ Kapat', callback_data: `ac:${openTicket.id}` }]
    ]);
    await tg.sendMessage(message.chat.id, `Mesajın ${openTicket.ticket_no} numaralı talebe eklendi.`);
    return;
  }

  await showMainMenu(tg, env, user.id, message.chat.id, reusableMenuMessage(session, message.chat.id));
}

async function handleCallback(tg: TelegramClient, env: Env, callback: CallbackQuery): Promise<void> {
  await tg.answerCallback(callback.id);
  if (!callback.message || callback.message.chat.type !== 'private' || !callback.data) return;
  const userId = callback.from.id;
  const chatId = callback.message.chat.id;
  const messageId = callback.message.message_id;
  const data = callback.data;
  await getSession(env.DB, userId);

  if (data === 'menu' || data === 'resolved') {
    const prefix = data === 'resolved' ? 'Harika, sorunun çözüldüğüne sevindik! ✅\n\n' : '';
    await tg.editMessage(chatId, messageId, prefix + config.welcome, mainMenu());
    await patchSession(env.DB, userId, { state: 'idle', menu_chat_id: chatId, menu_message_id: messageId });
    return;
  }

  if (data.startsWith('c:')) {
    const category = findCategory(data.slice(2));
    if (!category) return;
    await tg.editMessage(chatId, messageId, category.intro, categoryMenu(category));
    await patchSession(env.DB, userId, { topic: category.label, menu_chat_id: chatId, menu_message_id: messageId });
    return;
  }

  if (data.startsWith('q:')) {
    const [, categoryId, questionId] = data.split(':');
    const question = findQuestion(categoryId, questionId);
    if (!question) return;
    await tg.editMessage(chatId, messageId, question.answer, resolutionMenu(categoryId, question));
    await patchSession(env.DB, userId, { last_question_id: `${categoryId}:${questionId}`, topic: question.label });
    return;
  }

  if (data.startsWith('more:')) {
    const [, categoryId, questionId] = data.split(':');
    const question = findQuestion(categoryId, questionId);
    if (!question) return;
    if (question.secondary?.length) {
      await tg.editMessage(chatId, messageId, 'Şunlardan biri yardımcı olabilir:', secondaryMenu(categoryId, question));
    } else {
      await tg.editMessage(chatId, messageId, 'Hazır adımlar yeterli olmadıysa destek talebi oluşturabilirsin.', [
        [{ text: '🎧 Canlı Destek Talebi Oluştur', callback_data: 'ticket' }],
        [{ text: '⬅️ Ana Menü', callback_data: 'menu' }]
      ]);
    }
    return;
  }

  if (data.startsWith('s:')) {
    const [, categoryId, questionId, secondaryId] = data.split(':');
    const question = findQuestion(categoryId, questionId);
    const secondary = question?.secondary?.find((item) => item.id === secondaryId);
    if (!question || !secondary) return;
    await tg.editMessage(chatId, messageId, secondary.answer, resolutionMenu(categoryId, question, true));
    return;
  }

  if (data === 'escalate') {
    await tg.editMessage(chatId, messageId, 'Sorun devam ediyorsa canlı destek talebi oluşturabilirsin.', [
      [{ text: '🎧 Canlı Destek Talebi Oluştur', callback_data: 'ticket' }],
      [{ text: '⬅️ Ana Menü', callback_data: 'menu' }]
    ]);
    return;
  }

  if (data === 'ticket') {
    const existing = await getOpenTicketForUser(env.DB, userId);
    if (existing) {
      await tg.editMessage(chatId, messageId, `Zaten açık bir talebin var: ${existing.ticket_no}. Mesajını bu sohbete yazarak aynı talebe ekleyebilirsin.`);
      return;
    }
    await patchSession(env.DB, userId, { state: 'awaiting_description' });
    await tg.editMessage(chatId, messageId, 'Lütfen yaşadığın problemi tek mesajda açıkla. Mouse modeli, oyun ve gördüğün hata varsa ekle.\n\nKart, şifre veya ödeme bilgisi paylaşma.');
    return;
  }

  if (data.startsWith('ar:') || data.startsWith('ac:')) {
    if (!isAdmin(userId, env)) {
      await tg.sendMessage(chatId, 'Bu işlem için yetkin yok.');
      return;
    }
    const ticket = await getTicket(env.DB, Number(data.slice(3)));
    if (!ticket || ticket.status !== 'open') {
      await tg.editMessage(chatId, messageId, 'Bu talep artık açık değil.');
      return;
    }
    if (data.startsWith('ar:')) {
      await patchSession(env.DB, userId, { state: 'admin_reply', active_ticket_id: ticket.id });
      await tg.sendMessage(chatId, `${ticket.ticket_no} için yanıtını şimdi tek mesaj olarak yaz. İptal etmek için /menu kullanabilirsin.`);
    } else {
      await closeTicket(env.DB, ticket);
      await tg.sendMessage(ticket.user_id, `✅ ${ticket.ticket_no} numaralı destek talebin kapatıldı. Yeni bir konu için /menu komutunu kullanabilirsin.`);
      await tg.editMessage(chatId, messageId, `✅ ${ticket.ticket_no} kapatıldı.\n\n${ticketSummary(ticket)}`);
    }
  }
}

export async function handleUpdate(tg: TelegramClient, env: Env, update: TelegramUpdate): Promise<void> {
  if (update.callback_query) await handleCallback(tg, env, update.callback_query);
  else if (update.message) await handleMessage(tg, env, update.message);
}
