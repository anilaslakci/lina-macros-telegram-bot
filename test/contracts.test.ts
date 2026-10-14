import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const handler = readFileSync(resolve(process.cwd(), 'src/handler.ts'), 'utf8');
const wrangler = readFileSync(resolve(process.cwd(), 'wrangler.jsonc'), 'utf8');
const admin = readFileSync(resolve(process.cwd(), 'src/admin.ts'), 'utf8');
const analytics = readFileSync(resolve(process.cwd(), 'src/analytics.ts'), 'utf8');

describe('müşteri ve yönetici akış sözleşmeleri', () => {
  it('yönetici yetkisini yalnızca sayısal kimlikle denetler', () => {
    expect(handler).toContain('String(userId) === env.ADMIN_TELEGRAM_ID');
    expect(handler).not.toMatch(/username\s*===/);
    expect(wrangler).toContain('1146589481');
  });

  it('/admin ve /stats komutlarını yalnızca yönetici kontrolünden sonra çalıştırır', () => {
    expect(handler.indexOf("if (!isAdmin(userId, env)) return false")).toBeLessThan(handler.indexOf("command === '/admin'"));
    expect(handler).toContain("command === '/stats'");
    expect(admin).toContain('Son değişikliği geri al');
    expect(admin).toContain('Bu içerik pasife alınacak');
  });

  it('istatistiklerde İstanbul gün sınırını ve tekil kullanıcıları kullanır', () => {
    expect(analytics).toContain("date(last_seen_at,'+3 hours')");
    expect(analytics).toContain('COUNT(DISTINCT user_id)');
    expect(analytics).not.toContain('body');
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

  it('boştaki serbest mesajlarda menüyü gösterir ve mevcut menü mesajını yeniden kullanır', () => {
    expect(handler).not.toContain('Sana doğru seçenekleri gösterebilmem için /menu');
    expect(handler).toContain('showMainMenu(tg, env, user.id, message.chat.id, reusableMenuMessage(session, message.chat.id))');
    expect(handler).toContain("session.menu_chat_id === chatId ? session.menu_message_id ?? undefined : undefined");
  });

  it('yanıt süresi garantisi vermez ve hassas ödeme verisini istemez', () => {
    expect(handler).toContain('Kesin bir yanıt süresi taahhüt edemiyoruz');
    expect(handler).toContain('Kart, şifre veya ödeme bilgisi paylaşma');
  });
});
