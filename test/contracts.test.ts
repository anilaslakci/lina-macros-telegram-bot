import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const handler = readFileSync(resolve(process.cwd(), 'src/handler.ts'), 'utf8');
const wrangler = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');

describe('müşteri ve yönetici akış sözleşmeleri', () => {
  it('yönetici yetkisini yalnızca sayısal kimlikle denetler', () => {
    expect(handler).toContain('String(userId) === env.ADMIN_TELEGRAM_ID');
    expect(handler).not.toMatch(/username\s*===/);
    expect(wrangler).toContain('1146589481');
  });

  it('yönetici listeleme, yanıtlama ve kapatma komutlarını sunar', () => {
    expect(handler).toContain("command === '/tickets'");
    expect(handler).toContain("command === '/reply'");
    expect(handler).toContain("command === '/close'");
  });

  it('açık talepte müşteri mesajını aynı görüşmeye ekler', () => {
    expect(handler).toContain("addTicketMessage(env.DB, openTicket.id, 'customer'");
    expect(handler).toContain('müşteri yanıtı');
  });

  it('yanıt süresi garantisi vermez ve hassas ödeme verisini istemez', () => {
    expect(handler).toContain('Kesin bir yanıt süresi taahhüt edemiyoruz');
    expect(handler).toContain('Kart, şifre veya ödeme bilgisi paylaşma');
  });
});
