import { describe, expect, it } from 'vitest';
import { config, findCategory, findQuestion, mainMenu, resolutionMenu, secondaryMenu } from '../src/ui';

describe('hazır cevap menüsü', () => {
  it('altı ana kategori sunar ve canlı desteği ana menüye koymaz', () => {
    expect(config.categories).toHaveLength(6);
    const labels = mainMenu().flat().map((button) => button.text);
    expect(labels).toEqual([
      '🎮 Makro Paketleri ve Fiyatlar', '🖱️ Mouse Uyumluluğu', '⚙️ Kurulum Yardımı',
      '📦 Sipariş ve Teslimat', '❓ Sık Sorulan Sorular', '🔄 Güncelleme Desteği'
    ]);
    expect(labels.join(' ')).not.toContain('Canlı Destek');
  });

  it('dört ürün ve doğru Shopier bağlantılarını içerir', () => {
    const products = findCategory('packages')!.questions;
    expect(products).toHaveLength(4);
    expect(products.map((item) => item.answer)).toEqual(expect.arrayContaining([
      expect.stringContaining('33482000'), expect.stringContaining('33090562'),
      expect.stringContaining('33088510'), expect.stringContaining('33086748')
    ]));
  });

  it('ilk yanıttan sonra ikinci seviye yardıma, sonra canlı desteğe ilerler', () => {
    const question = findQuestion('installation', 'guide')!;
    expect(resolutionMenu('installation', question).flat().some((button) => button.callback_data?.startsWith('more:'))).toBe(true);
    expect(secondaryMenu('installation', question).flat().some((button) => button.callback_data === 'ticket')).toBe(true);
    expect(resolutionMenu('installation', question, true).flat().some((button) => button.callback_data === 'escalate')).toBe(true);
  });

  it('risk yanıtında güvenli kullanım garantisi vermez', () => {
    const answer = findQuestion('faq', 'risk')!.answer;
    expect(answer).toContain('garantisi vermiyoruz');
    expect(answer).toContain('hesap yaptırımı riski');
  });
});
