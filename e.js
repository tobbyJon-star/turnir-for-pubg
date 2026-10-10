import { Telegraf, Markup } from 'telegraf';
import fs from 'fs';
import path from 'path';
import http from 'http';

// ========================================
// CONFIG SOZLAMALARI
// ========================================

// Render Environment Variables'dan olinadi, aks holda zaxira token ishlatiladi
const RAW_TOKEN = process.env.BOT_TOKEN || '8703531186:AAFdw98Fxa_AoW3XAshbQdV-uOO1H4h1_1w';
const TOKEN = RAW_TOKEN.trim().replace(/[\r\n\t]/g, '');

const bot = new Telegraf(TOKEN);

// Admin username'lari (@ belgisiz)
const ADMIN_USERNAMES = ['dr_ulugbekovv1', 'tobby_jon_UZ_EN'];

const CARD_NUMBER = '5614 6818 7381 6882 ( SHoiraxon - Karta egasi) ';
const ADMIN_CONTACT = '@dr_ulugbekovv1';

const MAX_TEAMS = 25;
const DB_FILE = path.join(process.cwd(), 'db.json');

// Turnir joylashuvi (Google Maps Link)
const TOURNAMENT_LOCATION = 'https://maps.app.goo.gl/B71hgEW9wt6R69Rp7';

const PORT = process.env.PORT || 3000;

// ========================================
// DATABASE (JSON FILE DB)
// ========================================

function initDB() {
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(
      DB_FILE,
      JSON.stringify({ teams: [], pendingTeams: [] }, null, 2),
      'utf8'
    );
  }
}

initDB();

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    initDB();
  }

  try {
    const data = fs.readFileSync(DB_FILE, 'utf8');
    const parsed = JSON.parse(data);

    if (!Array.isArray(parsed.teams)) parsed.teams = [];
    if (!Array.isArray(parsed.pendingTeams)) parsed.pendingTeams = [];

    return parsed;
  } catch (error) {
    console.error('Baza o\'qishda xatolik:', error);
    return { teams: [], pendingTeams: [] };
  }
}

function writeDB(data) {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (error) {
    console.error('Baza yozishda xatolik:', error);
  }
}

// ========================================
// USER STATES
// ========================================

const userStates = {};

function sanitizeText(str = '') {
  return str.toString().replace(/[&<>"']/g, '');
}

// ========================================
// ADMIN TEKSHIRISH
// ========================================

function isAdmin(ctx) {
  const username = ctx.from?.username;
  if (!username) return false;
  
  return ADMIN_USERNAMES.some(
    (admin) => admin.toLowerCase() === username.toLowerCase()
  );
}

// ========================================
// MENYU VA INTERFEYSLAR
// ========================================

function showAdminMenu(ctx) {
  const db = readDB();
  const pendingCount = db.pendingTeams.length;

  let text = `👑 Admin Paneli\n\nKerakli bo'limni tanlang:`;
  if (pendingCount > 0) {
    text += `\n\n⏳ Tasdiqlash kutilayotgan jamoalar: ${pendingCount} ta`;
  }

  return ctx.reply(text, Markup.keyboard([
    ['⏳ Kutilayotgan so\'rovlar', '📊 Statistika va Jamoalar'],
    ['📢 Barchaga e\'lon (Broadcast)', '✉️ Biror jamoaga yozish'],
    ['🗑 Jamoani o\'chirish (Admin)', '⚠️ Barcha jamoalarni o\'chirish']
  ]).resize());
}

function showTeamMenu(ctx, team) {
  const db = readDB();
  const totalTeams = db.teams.length;

  let msg = `🛡 Siz "${sanitizeText(team.teamName)}" jamoasining sardorisiz.\n\n`;
  msg += `📊 Jamoalar: ${totalTeams}/${MAX_TEAMS}\n\n`;
  msg += `💰 To'lov: Muvaffaqiyatli amalga oshirilgan ✅\n\n`;
  msg += `📅 Turnir vaqti: 17 oktyabr 13:00\n\n`;
  msg += `📍 Turnir joyi: MBSI AI school`;

  const keyboard = [
    ['🛡 Mening jamoam', '🚪 Jamoani o\'chirish'],
    ['📍 Turnir joylashuvi']
  ];

  return ctx.reply(msg, Markup.keyboard(keyboard).resize());
}

// ========================================
// /START VA /ADMIN KOMANDALARI
// ========================================

bot.start((ctx) => {
  const chatId = ctx.chat.id;

  if (isAdmin(ctx)) {
    delete userStates[chatId];
    return showAdminMenu(ctx);
  }

  const db = readDB();
  const existingTeam = db.teams.find((t) => t.chatId === chatId);

  if (existingTeam) {
    return showTeamMenu(ctx, existingTeam);
  }

  const pending = db.pendingTeams.find((t) => t.chatId === chatId);
  if (pending) {
    let pendingMsg = `💳 TO'LOV QILISH VA TASDIQLASH\n\n`;
    pendingMsg += `Sizning "${pending.teamName}" jamoangiz so'rovi adminlar tomonidan ko'rib chiqilmoqda.\n\n`;
    pendingMsg += `💰 To'lov summasi: 100 000 so'm (4 kishi × 25 000 so'm)\n`;
    pendingMsg += `💳 Karta raqami: ${CARD_NUMBER}\n\n`;
    pendingMsg += `⚠️ MUHIM ESLATMA:\n`;
    pendingMsg += `To'lov chekini (skrinshotini) ${ADMIN_CONTACT} ga yuboring! Tashkilotchi to'lovni tasdiqlagach, jamoangiz qabul qilinadi.`;

    return ctx.reply(pendingMsg);
  }

  userStates[chatId] = { step: 'waiting_for_team_name' };

  return ctx.reply(
    `🎮 Turnirga xush kelibsiz!\n\n` +
    `Iltimos, jamoangiz nomini kiriting (Bu nom yagona bo'lishi kerak):`,
    Markup.removeKeyboard()
  );
});

bot.command('admin', (ctx) => {
  delete userStates[ctx.chat.id];
  if (isAdmin(ctx)) {
    return showAdminMenu(ctx);
  } else {
    return ctx.reply(`❌ Kechirasiz, siz admin emassiz!`);
  }
});

// ========================================
// TELEFON RAQAM QABUL QILISH
// ========================================

bot.on('contact', (ctx) => {
  const chatId = ctx.chat.id;
  const contact = ctx.message.contact;
  const state = userStates[chatId];

  if (state && state.step === 'waiting_for_phone') {
    state.phone = contact.phone_number;
    state.step = 'waiting_for_school';

    return ctx.reply(
      `Ajoyib! Endi Maktabingizni kiriting (Masalan: 15-maktab):`,
      Markup.removeKeyboard()
    );
  }
});

// ========================================
// CALLBACK QUERY (ADMIN TASDIQLASH TUGMALARI)
// ========================================

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;

  if (!isAdmin(ctx)) {
    return ctx.answerCbQuery('Siz admin emassiz!');
  }

  const db = readDB();

  // 1. DASTLABKI TASDIQLASH
  if (data.startsWith('approve_req_')) {
    const targetChatId = Number(data.replace('approve_req_', ''));
    const pending = db.pendingTeams.find(t => t.chatId === targetChatId);

    if (!pending) {
      ctx.answerCbQuery();
      return ctx.reply(`❌ Bu so'rov allaqachon ko'rib chiqilgan yoki topilmadi.`);
    }

    return ctx.reply(
      `❓ Siz haqiqatdan ham "${pending.teamName}" jamoasining to'lovini tasdiqlaysizmi?`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('✅ Ha, to\'lov qilindi', `confirm_approve_${targetChatId}`),
          Markup.button.callback(' Bekor qilish', 'cancel_action')
        ]
      ])
    );
  }

  // 2. QAYTA TASDIQLASH (HA BOSILGANDA)
  if (data.startsWith('confirm_approve_')) {
    const targetChatId = Number(data.replace('confirm_approve_', ''));
    const pendingIndex = db.pendingTeams.findIndex(t => t.chatId === targetChatId);

    if (pendingIndex === -1) {
      ctx.answerCbQuery();
      return ctx.reply(`❌ So'rov topilmadi.`);
    }

    if (db.teams.length >= MAX_TEAMS) {
      db.pendingTeams.splice(pendingIndex, 1);
      writeDB(db);
      ctx.answerCbQuery();
      return ctx.reply(`❌ Limit to'lganligi sababli jamoani qo'shib bo'lmadi.`);
    }

    const pending = db.pendingTeams.splice(pendingIndex, 1)[0];

    const newTeam = {
      chatId: pending.chatId,
      username: pending.username,
      teamName: pending.teamName,
      fullName: pending.fullName,
      phone: pending.phone,
      school: pending.school,
      createdAt: new Date().toISOString()
    };

    db.teams.push(newTeam);
    writeDB(db);

    ctx.answerCbQuery('Jamoa tasdiqlandi!');
    ctx.reply(`✅ "${newTeam.teamName}" jamoasi muvaffaqiyatli turnirga qo'shildi!`);

    try {
      await ctx.telegram.sendMessage(
        targetChatId,
        `🎉 TABRIKLAYMIZ!\n\n` +
        `Sizning "${newTeam.teamName}" jamoangiz to'lovi muvaffaqiyatli tasdiqlandi!\n` +
        `Jamoangiz turnirga qabul qilindi. Turnirda omad tilaymiz! 🎮`,
        Markup.keyboard([
          ['🛡 Mening jamoam', '🚪 Jamoani o\'chirish'],
          ['📍 Turnir joylashuvi']
        ]).resize()
      );
    } catch (e) {
      console.error('Foydalanuvchiga xabar yuborishda xato:', e.message);
    }
    return;
  }

  // 3. RAD ETISH BOSILGANDA
  if (data.startsWith('reject_req_')) {
    const targetChatId = Number(data.replace('reject_req_', ''));
    const pending = db.pendingTeams.find(t => t.chatId === targetChatId);

    if (!pending) {
      ctx.answerCbQuery();
      return ctx.reply(`❌ So'rov topilmadi.`);
    }

    return ctx.reply(
      `❓ Siz haqiqatdan ham "${pending.teamName}" jamoasi so'rovini RAD etmoqchimisiz?`,
      Markup.inlineKeyboard([
        [
          Markup.button.callback('❌ Ha, rad etilsin', `confirm_reject_${targetChatId}`),
          Markup.button.callback(' Bekor qilish', 'cancel_action')
        ]
      ])
    );
  }

  // 4. RAD ETISHNI TASDIQLASH
  if (data.startsWith('confirm_reject_')) {
    const targetChatId = Number(data.replace('confirm_reject_', ''));
    const pendingIndex = db.pendingTeams.findIndex(t => t.chatId === targetChatId);

    if (pendingIndex !== -1) {
      const pending = db.pendingTeams.splice(pendingIndex, 1)[0];
      writeDB(db);

      ctx.answerCbQuery('So\'rov rad etildi');
      ctx.reply(`❌ "${pending.teamName}" jamoasi so'rovi rad etildi.`);

      try {
        await ctx.telegram.sendMessage(
          targetChatId,
          `❌ Afsuski, sizning so'rovingiz rad etildi.\n\n` +
          `To'lov amalga oshirilmagan bo'lishi mumkin. Ma'lumot uchun ${ADMIN_CONTACT} ga murojaat qiling.`,
          Markup.removeKeyboard()
        );
      } catch (e) {
        console.error('Rad etish xabarida xato:', e.message);
      }
    }
    return;
  }

  if (data === 'cancel_action') {
    ctx.answerCbQuery('Amal bekor qilindi');
    return ctx.reply('Amal bekor qilindi.');
  }
});

// ========================================
// MATNLI XABARLAR
// ========================================

bot.on('text', async (ctx) => {
  const chatId = ctx.chat.id;
  const text = ctx.message.text.trim();
  const db = readDB();
  const state = userStates[chatId];

  if (text.startsWith('/')) {
    return;
  }

  // ========================================
  // ADMIN PANEL FUNKSIYALARI
  // ========================================

  if (isAdmin(ctx)) {

    // KUTILAYOTGAN SO'ROVLAR
    if (text === '⏳ Kutilayotgan so\'rovlar') {
      if (db.pendingTeams.length === 0) {
        return ctx.reply(`✅ Hozircha kutilayotgan to'lov so'rovlari yo'q.`);
      }

      await ctx.reply(`📋 Kutilayotgan so'rovlar ro'yxati:`);

      for (const team of db.pendingTeams) {
        let msg = `🛡 Jamoa: ${sanitizeText(team.teamName)}\n`;
        msg += `👤 Sardor: ${sanitizeText(team.fullName)}\n`;
        msg += `🏫 Maktab: ${sanitizeText(team.school)}\n`;
        msg += `📞 Tel: ${sanitizeText(team.phone)}\n`;
        msg += `👤 Telegram: ${team.username ? '@' + team.username : 'Mavjud emas'}`;

        await ctx.reply(msg, Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Tasdiqlash', `approve_req_${team.chatId}`),
            Markup.button.callback('❌ Rad etish', `reject_req_${team.chatId}`)
          ]
        ]));
      }
      return;
    }

    // STATISTIKA
    if (text === '📊 Statistika va Jamoalar') {
      const totalTeams = db.teams.length;
      let msg = `==========================\n`;
      msg += `📊 TURNIR STATISTIKASI\n`;
      msg += `Jamoalar: ${totalTeams}/${MAX_TEAMS} ta\n`;
      msg += `==========================\n\n`;

      if (totalTeams === 0) {
        msg += `Hozircha ro'yxatdan o'tgan jamoalar yo'q.`;
      } else {
        db.teams.forEach((team, index) => {
          msg += `------------------------------------\n`;
          msg += `${index + 1}-JAMOA: "${sanitizeText(team.teamName)}"\n`;
          msg += `👤 Sardor: ${sanitizeText(team.fullName)}\n`;
          msg += `🏫 Maktab: ${sanitizeText(team.school)}\n`;
          msg += `📞 Tel: ${sanitizeText(team.phone)}\n`;
          msg += `👤 Telegram: ${team.username ? '@' + team.username : 'Mavjud emas'}\n`;
        });
        msg += `------------------------------------`;
      }

      return ctx.reply(msg);
    }

    // BROADCAST
    if (text === "📢 Barchaga e'lon (Broadcast)") {
      userStates[chatId] = { step: 'admin_waiting_broadcast' };
      return ctx.reply(
        `📢 Barcha jamoalarga yubormoqchi bo'lgan e'lon matnini kiriting:`,
        Markup.keyboard([['❌ Bekor qilish']]).resize()
      );
    }

    if (state && state.step === 'admin_waiting_broadcast') {
      if (text === '❌ Bekor qilish') {
        delete userStates[chatId];
        return showAdminMenu(ctx);
      }

      let count = 0;
      for (const team of db.teams) {
        try {
          await ctx.telegram.sendMessage(
            team.chatId,
            `📢 Turnir Tashkilotchilaridan E'lon:\n\n${text}`
          );
          count++;
        } catch (err) {
          console.error(`Xabar yuborishda xato (${team.chatId}):`, err.message);
        }
      }
      delete userStates[chatId];
      ctx.reply(`✅ E'lon ${count} ta jamoa sardoriga muvaffaqiyatli yuborildi!`);
      return showAdminMenu(ctx);
    }

    // BIROR JAMOA SARDORIGA SHAXSIY XABAR
    if (text === '✉️ Biror jamoaga yozish') {
      userStates[chatId] = { step: 'admin_waiting_target_team_name' };
      return ctx.reply(
        `✉️ Xabar yubormoqchi bo'lgan jamoaning aniq nomini kiriting:`,
        Markup.keyboard([['❌ Bekor qilish']]).resize()
      );
    }

    if (state && state.step === 'admin_waiting_target_team_name') {
      if (text === '❌ Bekor qilish') {
        delete userStates[chatId];
        return showAdminMenu(ctx);
      }

      const targetTeam = db.teams.find(
        (t) => t.teamName.toLowerCase() === text.toLowerCase()
      );

      if (!targetTeam) {
        return ctx.reply(`❌ "${text}" nomli jamoa topilmadi. Qaytadan nomini kiriting:`);
      }

      userStates[chatId] = {
        step: 'admin_waiting_private_msg',
        targetChatId: targetTeam.chatId,
        teamName: targetTeam.teamName
      };

      return ctx.reply(
        `"${targetTeam.teamName}" jamoasi sardoriga yubormoqchi bo'lgan xabaringizni kiriting:`,
        Markup.keyboard([['❌ Bekor qilish']]).resize()
      );
    }

    if (state && state.step === 'admin_waiting_private_msg') {
      if (text === '❌ Bekor qilish') {
        delete userStates[chatId];
        return showAdminMenu(ctx);
      }

      try {
        await ctx.telegram.sendMessage(
          state.targetChatId,
          `✉️ Tashkilotchidan Shaxsiy Xabar:\n\n${text}`
        );
        ctx.reply(`✅ Xabar "${state.teamName}" jamoasiga yuborildi!`);
      } catch (e) {
        ctx.reply(`❌ Xabar yuborishda xatolik yuz berdi.`);
      }

      delete userStates[chatId];
      return showAdminMenu(ctx);
    }

    // JAMOA O'CHIRISH
    if (text === "🗑 Jamoani o'chirish (Admin)") {
      userStates[chatId] = { step: 'admin_waiting_delete_team_name' };
      return ctx.reply(
        `🗑 O'chirib tashlamoqchi bo'lgan jamoaning nomini kiriting:`,
        Markup.keyboard([['❌ Bekor qilish']]).resize()
      );
    }

    if (state && state.step === 'admin_waiting_delete_team_name') {
      if (text === '❌ Bekor qilish') {
        delete userStates[chatId];
        return showAdminMenu(ctx);
      }

      const targetTeam = db.teams.find(
        (t) => t.teamName.toLowerCase() === text.toLowerCase()
      );

      if (!targetTeam) {
        return ctx.reply(`❌ "${text}" nomli jamoa topilmadi. Qaytadan kiriting:`);
      }

      userStates[chatId] = {
        step: 'admin_confirm_delete_single',
        targetTeam: targetTeam
      };

      return ctx.reply(
        `❓ Siz rostdan ham "${targetTeam.teamName}" jamoasini o'chirib tashlamoqchimisiz?\n\n` +
        `Bu amaldan so'ng jamoa va uning ma'lumotlari o'chib ketadi!`,
        Markup.keyboard([
          ['✅ Ha, o\'chirilsin', '❌ Bekor qilish']
        ]).resize()
      );
    }

    if (state && state.step === 'admin_confirm_delete_single') {
      if (text === '✅ Ha, o\'chirilsin') {
        const teamToDelete = state.targetTeam;
        db.teams = db.teams.filter((t) => t.teamName !== teamToDelete.teamName);
        writeDB(db);

        try {
          delete userStates[teamToDelete.chatId];
          await ctx.telegram.sendMessage(
            teamToDelete.chatId,
            `⚠️ DIQQAT!\n\n` +
            `Sizning "${teamToDelete.teamName}" jamoangiz Admin tomonidan turnirdan o'chirildi!\n\n` +
            `Qaytadan ro'yxatdan o'tish uchun /start ni bosing.`,
            Markup.removeKeyboard()
          );
        } catch (err) {
          console.error("Ogohlantirish yuborishda xato:", err.message);
        }

        ctx.reply(`✅ "${teamToDelete.teamName}" jamoasi ro'yxatdan o'chirildi!`);
        delete userStates[chatId];
        return showAdminMenu(ctx);
      } else {
        delete userStates[chatId];
        ctx.reply(`❌ O'chirish bekor qilindi.`);
        return showAdminMenu(ctx);
      }
    }

    // BARCHA JAMOALARNI O'CHIRISH
    if (text === "⚠️ Barcha jamoalarni o'chirish") {
      userStates[chatId] = { step: 'admin_confirm_delete_all' };
      return ctx.reply(
        `⚠️ Siz haqiqatan ham BARCHA jamoalarni o'chirib tashlamoqchimisiz?`,
        Markup.keyboard([
          ['🔥 Ha, barchasini o\'chirish', '❌ Bekor qilish']
        ]).resize()
      );
    }

    if (state && state.step === 'admin_confirm_delete_all') {
      if (text === '🔥 Ha, barchasini o\'chirish') {
        db.teams = [];
        db.pendingTeams = [];
        writeDB(db);
        delete userStates[chatId];
        ctx.reply(`🔥 Barcha jamoalar muvaffaqiyatli o'chirildi va baza tozalandi!`);
        return showAdminMenu(ctx);
      } else {
        delete userStates[chatId];
        ctx.reply(`❌ Barchasini o'chirish bekor qilindi.`);
        return showAdminMenu(ctx);
      }
    }
  }

  // ========================================
  // USER RO'YXATDAN O'TISH BOSQICHLARI
  // ========================================

  if (state && state.step === 'waiting_for_team_name') {
    const teamName = text;

    if (db.teams.length >= MAX_TEAMS) {
      delete userStates[chatId];
      return ctx.reply(`❌ Kechirasiz, turnir uchun 25 ta jamoa limiti to'ldi!`);
    }

    const existsInDb = db.teams.some(
      (team) => team.teamName.toLowerCase() === teamName.toLowerCase()
    );

    const existsInPending = db.pendingTeams.some(
      (team) => team.teamName.toLowerCase() === teamName.toLowerCase()
    );

    if (existsInDb || existsInPending) {
      return ctx.reply(
        `❌ "${teamName}" jamoasi nomi allaqachon band qilingan!\n\nIltimos, boshqa noyob nom kiriting:`
      );
    }

    state.teamName = teamName;
    state.step = 'waiting_for_name';

    return ctx.reply(
      `Ajoyib! Endi sardorning Ism va Familiyasini kiriting.\n\nMasalan: Alisher Valiyev:`,
      Markup.removeKeyboard()
    );
  }

  if (state && state.step === 'waiting_for_name') {
    state.fullName = text;
    state.step = 'waiting_for_phone';

    return ctx.reply(
      `Rahmat, ${state.fullName}.\n\nEndi pastdagi tugmani bosib o'z telefon raqamingizni yuboring:`,
      Markup.keyboard([
        [Markup.button.contactRequest('📱 Telefon raqamni yuborish')]
      ])
        .resize()
        .oneTime()
    );
  }

  // MAKTAB KIRITILGANDAN SO'NG TO'LOV BOSQICHI
  if (state && state.step === 'waiting_for_school') {
    state.school = text;
    const username = ctx.from?.username || null;

    const newPending = {
      chatId: chatId,
      username: username,
      teamName: state.teamName,
      fullName: state.fullName,
      phone: state.phone,
      school: state.school,
      createdAt: new Date().toISOString()
    };

    db.pendingTeams.push(newPending);
    writeDB(db);

    delete userStates[chatId];

    let payMsg = `💳 TO'LOV QILISH VA TASDIQLASH\n\n`;
    payMsg += `Sizning ma'lumotlaringiz qabul qilindi.\n`;
    payMsg += `Turnirda ishtirok etish uchun to'lovni amalga oshiring:\n\n`;
    payMsg += `💰 To'lov summasi: 100 000 so'm (4 kishi × 25 000 so'm)\n`;
    payMsg += `💳 Karta raqami: ${CARD_NUMBER}\n\n`;
    payMsg += `⚠️ MUHIM ESLATMA:\n`;
    payMsg += `To'lovni amalga oshirgach, to'lov skrinshotini (chekini) tashkilotchi ${ADMIN_CONTACT} ga yuboring!\n\n`;
    payMsg += `Tashkilotchi to'lovni tasdiqlaganidan so'ng jamoangiz avtomatik ravishda turnirga qabul qilinadi.`;

    return ctx.reply(payMsg);
  }

  // ========================================
  // USER MENYU TUGMALARI
  // ========================================

  const team = db.teams.find((t) => t.chatId === chatId);

  if (!team && !isAdmin(ctx)) {
    return ctx.reply(`Iltimos, ro'yxatdan o'tish uchun /start ni bosing.`);
  }

  if (text === '🛡 Mening jamoam' && team) {
    const totalTeams = db.teams.length;

    let info =
      `🛡 Jamoa nomi: ${team.teamName}\n` +
      `📊 Turnir jamoalari: ${totalTeams}/${MAX_TEAMS} ta\n\n` +
      `👤 Sardor: ${team.fullName}\n` +
      `🏫 Maktab: ${team.school}\n\n` +
      `⚠️ Eslatma:\nTurnir kuni 4 ta o'yinchi bo'lib kelishingiz shart!\n\n` +
      `💰 To'lov: Tasdiqlangan ✅\n\n` +
      `📅 Turnir vaqti: 17 oktyabr 13:00\n\n` +
      `📍 Turnir joyi: MBSI AI school`;

    return ctx.reply(info);
  }

  if (text === '📍 Turnir joylashuvi') {
    return ctx.reply(
      `📍 Turnir o'tkaziladigan joy:\n\n🏫 MBSI AI school\n\nXaritadan joylashuvni ko'rish uchun pastdagi tugmani bosing:`,
      Markup.inlineKeyboard([
        [Markup.button.url('📍 Google Mapsda ochish', TOURNAMENT_LOCATION)]
      ])
    );
  }

  if (text === "🚪 Jamoani o'chirish" && team) {
    userStates[chatId] = { step: 'user_confirm_delete_own_team' };
    return ctx.reply(
      `❓ Jamoangizni ro'yxatdan o'chirishni tasdiqlaysizmi?`,
      Markup.keyboard([
        ['✅ Ha, jamoamni o\'chirish', '❌ Bekor qilish']
      ]).resize()
    );
  }

  if (state && state.step === 'user_confirm_delete_own_team') {
    if (text === '✅ Ha, jamoamni o\'chirish') {
      db.teams = db.teams.filter((t) => t.chatId !== chatId);
      writeDB(db);
      delete userStates[chatId];

      return ctx.reply(
        `Jamoangiz o'chirildi. 🚪\n\nYangi jamoa ochish uchun /start ni bosing.`,
        Markup.removeKeyboard()
      );
    } else {
      delete userStates[chatId];
      return showTeamMenu(ctx, team);
    }
  }
});

// ========================================
// SERVER VA ISHGA TUSHIRISH
// ========================================

bot.catch((error, ctx) => {
  console.error('Botda xato yuz berdi:', error);
  try {
    ctx.reply(`❌ Xatolik yuz berdi. Iltimos, qaytadan urinib ko'ring.`);
  } catch (e) {
    console.error('Xatolik xabarini yuborishda muammo:', e);
  }
});

http
  .createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('PUBG Tournament Bot status: Active 24/7');
  })
  .listen(PORT, () => {
    console.log(`🌐 Uptime server ${PORT}-portda muvaffaqiyatli ishlayapti...`);
  });

bot
  .launch()
  .then(() => {
    console.log('✅ PUBG Turnir Boti muvaffaqiyatli ishga tushdi...');
  })
  .catch((error) => {
    console.error('❌ Botni ishga tushirishda xato:', error);
  });

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));