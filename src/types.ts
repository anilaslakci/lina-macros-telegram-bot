export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
  ADMIN_TELEGRAM_ID: string;
}

export interface TelegramUser {
  id: number;
  is_bot?: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

export interface TelegramMessage {
  message_id: number;
  chat: { id: number; type: string };
  from?: TelegramUser;
  text?: string;
}

export interface CallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  data?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  callback_query?: CallbackQuery;
}

export interface InlineButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export interface Question {
  id: string;
  label: string;
  answer: string;
  secondary?: Array<{ id: string; label: string; answer: string }>;
}

export interface Category {
  id: string;
  label: string;
  intro: string;
  questions: Question[];
}

export interface AnswersConfig {
  welcome: string;
  categories: Category[];
}

export interface Session {
  user_id: number;
  state: string;
  topic: string | null;
  last_question_id: string | null;
  menu_chat_id: number | null;
  menu_message_id: number | null;
  active_ticket_id: number | null;
}

export interface Ticket {
  id: number;
  ticket_no: string;
  user_id: number;
  username: string | null;
  display_name: string;
  topic: string;
  description: string;
  status: 'open' | 'closed';
  created_at: string;
  updated_at: string;
}
