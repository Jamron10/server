// server.js
const { Telegraf, Markup } = require('telegraf');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

// ==========================================
// НАСТРОЙКИ
// ==========================================
const BOT_TOKEN = '8785558473:AAES_uw-puLIgD3UnnGa7bSjUOaP8rv0jFM';
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://narekmxeyan2024_db_user:30w56Iz0PajXNhCl@cluster0.wuftzdl.mongodb.net/?appName=Cluster0';
const HOSTINGER_API_URL = 'https://tetmer2026.com'; // фронтенд на Hostinger
const PORT = process.env.PORT || 10000;

// ==========================================
// ПОДКЛЮЧЕНИЕ К MONGODB
// ==========================================
mongoose.connect(MONGO_URI)
  .then(() => console.log('✅ Успешно подключено к MongoDB'))
  .catch(err => console.error('❌ Ошибка подключения к MongoDB:', err));

// Схема пользователя
const UserSchema = new mongoose.Schema({
  id: { type: Number, required: true, unique: true },
  data: { type: Object, default: {} },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', UserSchema);

// ==========================================
// EXPRESS API (только для бота / fetch)
// ==========================================
const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Получить одного пользователя
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findOne({ id: Number(req.params.id) });
    res.json(user || {});
  } catch (err) { res.status(500).json({error: err.message}); }
});

// Получить всех пользователей
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find({});
    res.json(users || []);
  } catch (err) { res.status(500).json({error: err.message}); }
});

// Создать пользователя
app.post('/api/users', async (req, res) => {
  try {
    const doc = new User(req.body);
    if(!doc.createdAt) doc.createdAt = new Date();
    await doc.save();
    res.json(doc);
  } catch (err) { res.status(500).json({error: err.message}); }
});

// Обновить пользователя
app.put('/api/users/:id', async (req, res) => {
  try {
    let updateData = req.body;
    if (!updateData.$set) { updateData = { $set: updateData }; }
    const user = await User.findOneAndUpdate(
      { id: Number(req.params.id) }, 
      updateData, 
      { new: true, upsert: true }
    );
    res.json(user);
  } catch (err) { res.status(500).json({error: err.message}); }
});

// Удалить пользователя
app.delete('/api/users/:id', async (req, res) => {
  try {
    await User.deleteOne({ id: Number(req.params.id) });
    res.json({ success: true });
  } catch (err) { res.status(500).json({error: err.message}); }
});

// Эндпоинт для рассылки
app.post('/api/broadcast', async (req, res) => {
  try {
    const { message, imageUrl, buttonText, buttonUrl } = req.body;
    if (!message) return res.status(400).json({ error: "No message provided" });

    const users = await User.find({});
    let success = 0, failed = 0;

    res.json({ success: true, total: users.length, message: "Рассылка запущена!" });

    const sendToUser = async (user) => {
      try {
        const extra = { parse_mode: 'HTML' };
        if (buttonText && buttonUrl) {
          extra.reply_markup = { inline_keyboard: [[{ text: buttonText, url: buttonUrl }]] };
        }
        if (imageUrl) {
          await bot.telegram.sendPhoto(user.id, imageUrl, { caption: message, ...extra });
        } else {
          await bot.telegram.sendMessage(user.id, message, extra);
        }
        success++;
      } catch(e) { failed++; }
    };

    (async () => {
      console.log(`[Broadcast] Starting broadcast to ${users.length} users...`);
      for (const user of users) {
        await sendToUser(user);
        await new Promise(r => setTimeout(r, 50)); // Лимит 20 сообщений в сек
      }
      console.log(`[Broadcast] Finished! Success: ${success}, Failed: ${failed}`);
    })();

  } catch (err) { console.error("Broadcast error:", err); }
});

// ==========================================
// ЗАПУСК API
// ==========================================
app.listen(PORT, () => {
  console.log(`✅ API Сервер запущен на порту ${PORT}`);
});

// ==========================================
// ИНИЦИАЛИЗАЦИЯ БОТА
// ==========================================
const bot = new Telegraf(BOT_TOKEN);

// Глобальный обработчик ошибок
bot.catch((err, ctx) => {
  console.error(`❌ Ошибка Telegram API для ${ctx.updateType}:`, err);
});

// /start команда
bot.start(async (ctx) => {
  const userId = ctx.from.id;
  const refId = ctx.payload;

  try {
    let user = await User.findOne({ id: userId });
    if (!user) {
      user = new User({ id: userId });
      await user.save();
      console.log(`👤 Новый пользователь зарегистрирован: ${userId}`);
    }

    const appUrl = refId ? `${HOSTINGER_API_URL}?startapp=${refId}` : HOSTINGER_API_URL;

    await ctx.replyWithPhoto(
      'https://images.unsplash.com/photo-1621416894569-0f39ed31d247?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80',
      {
        caption: `Привет, <b>${ctx.from.first_name}</b>! 👋\n\nДобро пожаловать в <b>TetherFlow Miner Pro</b>.\nЗапусти приложение по кнопке ниже 🚀`,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([[Markup.button.webApp('🚀 Запустить Майнер', appUrl)]])
      }
    );
  } catch (error) {
    console.error('Ошибка при обработке /start:', error);
    ctx.reply('Произошла ошибка. Пожалуйста, попробуйте позже.');
  }
});

// ==========================================
// ЗАПУСК БОТА
// ==========================================
bot.launch().then(() => {
  console.log('✅ Бот успешно запущен и готов к работе!');
}).catch(err => {
  console.error('❌ Ошибка запуска бота:', err.message);
});

// Плавная остановка
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
