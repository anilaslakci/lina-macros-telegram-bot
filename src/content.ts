import answers from './config/answers.json';
import type { AnswersConfig, Category, Question } from './types';

type CategoryRow = { id: string; label: string; intro: string; sort_order: number; active: number };
type QuestionRow = { id: string; category_id: string; label: string; answer: string; sort_order: number; active: number };
type SecondaryRow = { id: string; question_id: string; label: string; answer: string; sort_order: number; active: number };

export async function ensureContentSeeded(db: D1Database): Promise<void> {
  const row = await db.prepare('SELECT COUNT(*) AS count FROM bot_categories').first<{ count: number }>();
  if (Number(row?.count ?? 0) > 0) return;
  const config = answers as AnswersConfig;
  const statements: D1PreparedStatement[] = [];
  config.categories.forEach((category, categoryIndex) => {
    statements.push(db.prepare('INSERT OR IGNORE INTO bot_categories (id,label,intro,sort_order) VALUES (?,?,?,?)').bind(category.id, category.label, category.intro, (categoryIndex + 1) * 10));
    category.questions.forEach((question, questionIndex) => {
      statements.push(db.prepare('INSERT OR IGNORE INTO bot_questions (id,category_id,label,answer,sort_order) VALUES (?,?,?,?,?)').bind(`${category.id}__${question.id}`, category.id, question.label, question.answer, (questionIndex + 1) * 10));
      question.secondary?.forEach((item, secondaryIndex) => statements.push(db.prepare('INSERT OR IGNORE INTO bot_secondary_questions (id,question_id,label,answer,sort_order) VALUES (?,?,?,?,?)').bind(`${category.id}__${question.id}__${item.id}`, `${category.id}__${question.id}`, item.label, item.answer, (secondaryIndex + 1) * 10)));
    });
  });
  if (statements.length) await db.batch(statements);
}

export async function getCategories(db: D1Database, includeInactive = false): Promise<CategoryRow[]> {
  const rows = await db.prepare(`SELECT * FROM bot_categories ${includeInactive ? '' : 'WHERE active = 1'} ORDER BY sort_order, id`).all<CategoryRow>();
  return rows.results;
}
export async function getCategory(db: D1Database, id: string, includeInactive = false): Promise<Category | undefined> {
  const row = await db.prepare(`SELECT * FROM bot_categories WHERE id = ? ${includeInactive ? '' : 'AND active = 1'}`).bind(id).first<CategoryRow>();
  if (!row) return undefined;
  return { id: row.id, label: row.label, intro: row.intro, questions: await getQuestions(db, row.id, includeInactive) };
}
export async function getQuestions(db: D1Database, categoryId: string, includeInactive = false): Promise<Question[]> {
  const rows = await db.prepare(`SELECT * FROM bot_questions WHERE category_id = ? ${includeInactive ? '' : 'AND active = 1'} ORDER BY sort_order, id`).bind(categoryId).all<QuestionRow>();
  return Promise.all(rows.results.map(async (row) => ({ id: row.id, label: row.label, answer: row.answer, secondary: await getSecondary(db, row.id, includeInactive) })));
}
export async function getQuestion(db: D1Database, id: string, includeInactive = false): Promise<Question | undefined> {
  const row = await db.prepare(`SELECT * FROM bot_questions WHERE id = ? ${includeInactive ? '' : 'AND active = 1'}`).bind(id).first<QuestionRow>();
  return row ? { id: row.id, label: row.label, answer: row.answer, secondary: await getSecondary(db, row.id, includeInactive) } : undefined;
}
export async function getSecondary(db: D1Database, questionId: string, includeInactive = false): Promise<Array<{id:string;label:string;answer:string}>> {
  const rows = await db.prepare(`SELECT * FROM bot_secondary_questions WHERE question_id = ? ${includeInactive ? '' : 'AND active = 1'} ORDER BY sort_order, id`).bind(questionId).all<SecondaryRow>();
  return rows.results.map(({ id, label, answer }) => ({ id, label, answer }));
}

export function slugId(label: string): string {
  const base = label.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/ı/g, 'i').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 28) || 'icerik';
  return `${base}-${crypto.randomUUID().slice(0, 6)}`;
}
