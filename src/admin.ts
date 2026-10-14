import { getCategories, getCategory, getQuestion, getQuestions, slugId } from './content';
import { statsReport } from './analytics';
import type { TelegramClient, Keyboard } from './telegram';

type Draft = { admin_id:number; action:string; entity_type:string; entity_id:string|null; parent_id:string|null; step:string; payload_json:string|null };
const back: Keyboard = [[{ text: '⬅️ Yönetim', callback_data: 'adm:home' }]];

export function adminMenu(): Keyboard {
  return [
    [{ text: '1. Kategorileri Yönet', callback_data: 'adm:cats' }],
    [{ text: '2. Soruları Yönet', callback_data: 'adm:qcats' }],
    [{ text: '3. Hazır Cevapları Düzenle', callback_data: 'adm:qcats' }],
    [{ text: '4. Sıralamayı Değiştir', callback_data: 'adm:cats' }],
    [{ text: '5. Aktif/Pasif Yap', callback_data: 'adm:cats' }],
    [{ text: '6. İstatistikleri Gör', callback_data: 'adm:stats' }],
    [{ text: '↩️ Son değişikliği geri al', callback_data: 'adm:undo' }]
  ];
}
export async function showAdmin(tg: TelegramClient, chatId: number, messageId?: number): Promise<void> {
  const text = '🔐 Lina Macros yönetim paneli\n\nYapmak istediğin işlemi seç. Kaydedilmemiş bir işlemi İptal ile bırakabilirsin.';
  if (messageId) await tg.editMessage(chatId, messageId, text, adminMenu()); else await tg.sendMessage(chatId, text, adminMenu());
}
async function setDraft(db:D1Database, adminId:number, draft:Omit<Draft,'admin_id'>):Promise<void>{
  await db.prepare(`INSERT INTO admin_drafts(admin_id,action,entity_type,entity_id,parent_id,step,payload_json) VALUES(?,?,?,?,?,?,?) ON CONFLICT(admin_id) DO UPDATE SET action=excluded.action,entity_type=excluded.entity_type,entity_id=excluded.entity_id,parent_id=excluded.parent_id,step=excluded.step,payload_json=excluded.payload_json,updated_at=CURRENT_TIMESTAMP`).bind(adminId,draft.action,draft.entity_type,draft.entity_id,draft.parent_id,draft.step,draft.payload_json).run();
}
export async function cancelDraft(db:D1Database,adminId:number):Promise<void>{await db.prepare('DELETE FROM admin_drafts WHERE admin_id=?').bind(adminId).run();}
async function remember(db:D1Database,adminId:number,table:string,id:string):Promise<void>{const before=await db.prepare(`SELECT * FROM ${table} WHERE id=?`).bind(id).first();if(before)await db.prepare('INSERT INTO admin_history(admin_id,action,entity_type,entity_id,before_json) VALUES(?,?,?,?,?)').bind(adminId,'update',table,id,JSON.stringify(before)).run();}
async function categoryList(db:D1Database):Promise<Keyboard>{
  const rows=await getCategories(db,true); return [...rows.map(c=>[{text:`${c.active?'🟢':'⚪'} ${c.label}`,callback_data:`adm:c:${c.id}`}]),[{text:'➕ Yeni kategori',callback_data:'adm:newcat'}],...back];
}
async function questionCategories(db:D1Database):Promise<Keyboard>{return [...(await getCategories(db,true)).map(c=>[{text:c.label,callback_data:`adm:qs:${c.id}`}]),...back];}
async function questionList(db:D1Database,categoryId:string):Promise<Keyboard>{return [...(await getQuestions(db,categoryId,true)).map(q=>[{text:q.label,callback_data:`adm:q:${q.id}`}]),[{text:'➕ Yeni soru',callback_data:`adm:newq:${categoryId}`}],[{text:'⬅️ Kategoriler',callback_data:'adm:qcats'}]];}
async function secondaryList(db:D1Database,questionId:string):Promise<Keyboard>{const rows=await db.prepare('SELECT id,label FROM bot_secondary_questions WHERE question_id=? ORDER BY sort_order,id').bind(questionId).all<{id:string;label:string}>();return [...rows.results.map(s=>[{text:s.label,callback_data:`adm:s:${s.id}`}]),[{text:'➕ Alt soru ekle',callback_data:`adm:news:${questionId}`}],[{text:'⬅️ Soru',callback_data:`adm:q:${questionId}`}]];}

export async function handleAdminCallback(tg:TelegramClient,db:D1Database,adminId:number,chatId:number,messageId:number,data:string):Promise<boolean>{
  if(!data.startsWith('adm:')) return false;
  if(data==='adm:home'){await cancelDraft(db,adminId);await showAdmin(tg,chatId,messageId);return true;}
  if(data==='adm:stats'){await tg.editMessage(chatId,messageId,await statsReport(db),back);return true;}
  if(data==='adm:undo'){const h=await db.prepare('SELECT * FROM admin_history WHERE admin_id=? AND undone_at IS NULL ORDER BY id DESC LIMIT 1').bind(adminId).first<{id:number;entity_type:string;entity_id:string;before_json:string}>();if(!h){await tg.editMessage(chatId,messageId,'Geri alınabilecek bir değişiklik yok.',back);return true;}const row=JSON.parse(h.before_json);const columns=Object.keys(row).filter(k=>!['id','created_at'].includes(k));await db.prepare(`UPDATE ${h.entity_type} SET ${columns.map(k=>`${k}=?`).join(',')} WHERE id=?`).bind(...columns.map(k=>row[k]),h.entity_id).run();await db.prepare('UPDATE admin_history SET undone_at=CURRENT_TIMESTAMP WHERE id=?').bind(h.id).run();await tg.editMessage(chatId,messageId,'Son değişiklik geri alındı.',back);return true;}
  if(data==='adm:cats'){await tg.editMessage(chatId,messageId,'Kategoriler — ayrıntı için seç:',await categoryList(db));return true;}
  if(data==='adm:qcats'){await tg.editMessage(chatId,messageId,'Sorularını görmek istediğin kategoriyi seç:',await questionCategories(db));return true;}
  if(data==='adm:newcat'){await setDraft(db,adminId,{action:'create',entity_type:'category',entity_id:null,parent_id:null,step:'label',payload_json:null});await tg.sendMessage(chatId,'Yeni kategori adını yaz. Vazgeçmek için /cancel.');return true;}
  if(data.startsWith('adm:qs:')){const id=data.slice(7);if(!await getCategory(db,id,true))return true;await tg.editMessage(chatId,messageId,'Soruyu seç:',await questionList(db,id));return true;}
  if(data.startsWith('adm:newq:')){const categoryId=data.slice(9);if(!await getCategory(db,categoryId,true))return true;await setDraft(db,adminId,{action:'create',entity_type:'question',entity_id:null,parent_id:categoryId,step:'label',payload_json:null});await tg.sendMessage(chatId,'Yeni soruyu yaz. Sonraki adımda hazır cevabı isteyeceğim. Vazgeçmek için /cancel.');return true;}
  if(data.startsWith('adm:news:')){const questionId=data.slice(9);if(!await getQuestion(db,questionId,true))return true;await setDraft(db,adminId,{action:'create',entity_type:'secondary',entity_id:null,parent_id:questionId,step:'label',payload_json:null});await tg.sendMessage(chatId,'Yeni alt soruyu yaz. Sonraki adımda cevabı isteyeceğim. Vazgeçmek için /cancel.');return true;}
  if(data.startsWith('adm:ss:')){const questionId=data.slice(7);if(!await getQuestion(db,questionId,true))return true;await tg.editMessage(chatId,messageId,'İkinci seviye yardım sorularını seç:',await secondaryList(db,questionId));return true;}
  if(data.startsWith('adm:c:')){
    const id=data.slice(6);const c=await getCategory(db,id,true);if(!c)return true;
    const row=await db.prepare('SELECT active FROM bot_categories WHERE id=?').bind(id).first<{active:number}>();
    await tg.editMessage(chatId,messageId,`${c.label}\n\n${c.intro}`,[
      [{text:'✏️ Adını değiştir',callback_data:`adm:edit:c:${id}:label`}],[{text:'📝 Açıklamayı değiştir',callback_data:`adm:edit:c:${id}:intro`}],
      [{text:'⬆️',callback_data:`adm:move:c:${id}:up`},{text:'⬇️',callback_data:`adm:move:c:${id}:down`}],
      [{text:row?.active?'⏸ Pasife al':'▶️ Aktif yap',callback_data:`adm:toggle:c:${id}`}],[{text:'📋 Sorular',callback_data:`adm:qs:${id}`}],[{text:'⬅️ Kategoriler',callback_data:'adm:cats'}]
    ]);return true;
  }
  if(data.startsWith('adm:q:')){
    const id=data.slice(6);const q=await getQuestion(db,id,true);if(!q)return true;const row=await db.prepare('SELECT active,category_id FROM bot_questions WHERE id=?').bind(id).first<{active:number;category_id:string}>();
    await tg.editMessage(chatId,messageId,`Soru: ${q.label}\n\nCevap:\n${q.answer}`,[
      [{text:'✏️ Soruyu düzenle',callback_data:`adm:edit:q:${id}:label`}],[{text:'💬 Cevabı düzenle',callback_data:`adm:edit:q:${id}:answer`}],
      [{text:'🔀 Alt sorular',callback_data:`adm:ss:${id}`}],[{text:'⬆️',callback_data:`adm:move:q:${id}:up`},{text:'⬇️',callback_data:`adm:move:q:${id}:down`}],
      [{text:row?.active?'⏸ Pasife al':'▶️ Aktif yap',callback_data:`adm:toggle:q:${id}`}],[{text:'⬅️ Sorular',callback_data:`adm:qs:${row?.category_id}`}]
    ]);return true;
  }
  if(data.startsWith('adm:s:')){const id=data.slice(6);const row=await db.prepare('SELECT * FROM bot_secondary_questions WHERE id=?').bind(id).first<{id:string;question_id:string;label:string;answer:string;active:number}>();if(!row)return true;await tg.editMessage(chatId,messageId,`Alt soru: ${row.label}\n\nCevap:\n${row.answer}`,[[{text:'✏️ Soruyu düzenle',callback_data:`adm:edit:s:${id}:label`}],[{text:'💬 Cevabı düzenle',callback_data:`adm:edit:s:${id}:answer`}],[{text:'⬆️',callback_data:`adm:move:s:${id}:up`},{text:'⬇️',callback_data:`adm:move:s:${id}:down`}],[{text:row.active?'⏸ Pasife al':'▶️ Aktif yap',callback_data:`adm:toggle:s:${id}`}],[{text:'⬅️ Alt sorular',callback_data:`adm:ss:${row.question_id}`}]]);return true;}
  const edit=data.match(/^adm:edit:([cqs]):([^:]+):(label|intro|answer)$/);if(edit){const kind=edit[1]==='c'?'category':edit[1]==='q'?'question':'secondary';await setDraft(db,adminId,{action:'edit',entity_type:kind,entity_id:edit[2],parent_id:null,step:edit[3],payload_json:null});await tg.sendMessage(chatId,'Yeni metni yaz. Vazgeçmek için /cancel.');return true;}
  const tableFor=(kind:string)=>kind==='c'?'bot_categories':kind==='q'?'bot_questions':'bot_secondary_questions';
  const toggle=data.match(/^adm:toggle:([cqs]):(.+)$/);if(toggle){const table=tableFor(toggle[1]);const row=await db.prepare(`SELECT active FROM ${table} WHERE id=?`).bind(toggle[2]).first<{active:number}>();if(!row)return true;if(row.active){await tg.editMessage(chatId,messageId,'Bu içerik pasife alınacak; kullanıcı menüsünde görünmeyecek. Onaylıyor musun?',[[{text:'Evet, pasife al',callback_data:`adm:confirm:${toggle[1]}:${toggle[2]}`}],[{text:'Vazgeç',callback_data:'adm:home'}]]);}else{await remember(db,adminId,table,toggle[2]);await db.prepare(`UPDATE ${table} SET active=1,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(toggle[2]).run();await tg.editMessage(chatId,messageId,'İçerik aktif edildi.',back);}return true;}
  const confirm=data.match(/^adm:confirm:([cqs]):(.+)$/);if(confirm){const table=tableFor(confirm[1]);await remember(db,adminId,table,confirm[2]);await db.prepare(`UPDATE ${table} SET active=0,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(confirm[2]).run();await tg.editMessage(chatId,messageId,'İçerik pasife alındı. Veri silinmedi.',back);return true;}
  const move=data.match(/^adm:move:([cqs]):([^:]+):(up|down)$/);if(move){const table=tableFor(move[1]);await remember(db,adminId,table,move[2]);const delta=move[3]==='up'?-10:10;await db.prepare(`UPDATE ${table} SET sort_order=sort_order+?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(delta,move[2]).run();await tg.editMessage(chatId,messageId,'Sıralama güncellendi.',back);return true;}
  return true;
}

export async function handleAdminDraftText(tg:TelegramClient,db:D1Database,adminId:number,chatId:number,text:string):Promise<boolean>{
  const draft=await db.prepare('SELECT * FROM admin_drafts WHERE admin_id=?').bind(adminId).first<Draft>();if(!draft)return false;
  const value=text.trim();if(value.length<2){await tg.sendMessage(chatId,'Metin çok kısa. Tekrar yaz veya /cancel ile vazgeç.');return true;}
  if(draft.action==='create'&&draft.entity_type==='category'){
    const id=slugId(value);const max=await db.prepare('SELECT COALESCE(MAX(sort_order),0) n FROM bot_categories').first<{n:number}>();await db.prepare('INSERT INTO bot_categories(id,label,intro,sort_order) VALUES(?,?,?,?)').bind(id,value,'Bir konu seç.',Number(max?.n||0)+10).run();await cancelDraft(db,adminId);await tg.sendMessage(chatId,'Kategori oluşturuldu.',adminMenu());return true;
  }
  if(draft.action==='create'&&draft.entity_type==='question'&&draft.step==='label'){await setDraft(db,adminId,{...draft,step:'answer',payload_json:JSON.stringify({label:value})});await tg.sendMessage(chatId,'Şimdi bu sorunun hazır cevabını yaz. Vazgeçmek için /cancel.');return true;}
  if(draft.action==='create'&&draft.entity_type==='question'&&draft.step==='answer'){
    const label=JSON.parse(draft.payload_json||'{}').label;const id=`${draft.parent_id}__${slugId(label)}`;const max=await db.prepare('SELECT COALESCE(MAX(sort_order),0) n FROM bot_questions WHERE category_id=?').bind(draft.parent_id).first<{n:number}>();await db.prepare('INSERT INTO bot_questions(id,category_id,label,answer,sort_order) VALUES(?,?,?,?,?)').bind(id,draft.parent_id,label,value,Number(max?.n||0)+10).run();await cancelDraft(db,adminId);await tg.sendMessage(chatId,'Soru ve hazır cevap oluşturuldu.',adminMenu());return true;
  }
  if(draft.action==='create'&&draft.entity_type==='secondary'&&draft.step==='label'){await setDraft(db,adminId,{...draft,step:'answer',payload_json:JSON.stringify({label:value})});await tg.sendMessage(chatId,'Şimdi alt sorunun hazır cevabını yaz. Vazgeçmek için /cancel.');return true;}
  if(draft.action==='create'&&draft.entity_type==='secondary'&&draft.step==='answer'){const label=JSON.parse(draft.payload_json||'{}').label;const id=`${draft.parent_id}__${slugId(label)}`;const max=await db.prepare('SELECT COALESCE(MAX(sort_order),0) n FROM bot_secondary_questions WHERE question_id=?').bind(draft.parent_id).first<{n:number}>();await db.prepare('INSERT INTO bot_secondary_questions(id,question_id,label,answer,sort_order) VALUES(?,?,?,?,?)').bind(id,draft.parent_id,label,value,Number(max?.n||0)+10).run();await cancelDraft(db,adminId);await tg.sendMessage(chatId,'Alt soru ve hazır cevap oluşturuldu.',adminMenu());return true;}
  if(draft.action==='edit'&&draft.entity_id){const table=draft.entity_type==='category'?'bot_categories':draft.entity_type==='question'?'bot_questions':'bot_secondary_questions';const allowed=draft.entity_type==='category'?['label','intro']:['label','answer'];if(!allowed.includes(draft.step))return false;await remember(db,adminId,table,draft.entity_id);await db.prepare(`UPDATE ${table} SET ${draft.step}=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`).bind(value,draft.entity_id).run();await cancelDraft(db,adminId);await tg.sendMessage(chatId,'Değişiklik kaydedildi.',adminMenu());return true;}
  return false;
}
