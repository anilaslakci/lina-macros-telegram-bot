import answers from './config/answers.json';
import type { AnswersConfig, Category, Question } from './types';
import type { Keyboard } from './telegram';

export const config = answers as AnswersConfig;

export function mainMenu(): Keyboard {
  return config.categories.map((category) => [{ text: category.label, callback_data: `c:${category.id}` }]);
}

export function categoryMenu(category: Category): Keyboard {
  return [
    ...category.questions.map((question) => [{ text: question.label, callback_data: `q:${category.id}:${question.id}` }]),
    [{ text: '⬅️ Ana Menü', callback_data: 'menu' }]
  ];
}

export function resolutionMenu(categoryId: string, question: Question, secondaryShown = false): Keyboard {
  return [
    [{ text: '✅ Sorunum çözüldü', callback_data: 'resolved' }],
    [{ text: '❌ Hâlâ yardıma ihtiyacım var', callback_data: secondaryShown ? 'escalate' : `more:${categoryId}:${question.id}` }],
    [{ text: '⬅️ Ana Menü', callback_data: 'menu' }]
  ];
}

export function secondaryMenu(categoryId: string, question: Question): Keyboard {
  const options = question.secondary ?? [];
  return [
    ...options.map((item) => [{ text: item.label, callback_data: `s:${categoryId}:${question.id}:${item.id}` }]),
    [{ text: '🎧 Canlı Destek Talebi Oluştur', callback_data: 'ticket' }],
    [{ text: '⬅️ Ana Menü', callback_data: 'menu' }]
  ];
}

export function findCategory(id: string): Category | undefined {
  return config.categories.find((category) => category.id === id);
}

export function findQuestion(categoryId: string, questionId: string): Question | undefined {
  return findCategory(categoryId)?.questions.find((question) => question.id === questionId);
}
