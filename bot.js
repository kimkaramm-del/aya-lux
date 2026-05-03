const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");

// ─── الإعدادات ───────────────────────────────────────────────
const TOKEN = "8676397505:AAHZAWrGGhUIe8tND6fgEGsTmea1lGq4GtM";
const ADMIN_IDS = [7150410325]; // ضع الـ chat ID الخاص بك هنا

const CATEGORIES = ["إلكترونيات", "ملابس", "طعام", "أثاث", "أخرى"];

const DB_FILE = "database.json";
// ─────────────────────────────────────────────────────────────

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── قاعدة البيانات ───────────────────────────────────────────
function readDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify([]));
    }
    const raw = fs.readFileSync(DB_FILE, "utf8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("خطأ في قراءة DB:", err.message);
    return [];
  }
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error("خطأ في كتابة DB:", err.message);
  }
}

// ─── الأمان ───────────────────────────────────────────────────
function isAdmin(chatId) {
  return ADMIN_IDS.includes(chatId);
}

function adminOnly(msg, callback) {
  if (!isAdmin(msg.chat.id)) {
    return bot.sendMessage(msg.chat.id, "⛔ غير مصرح لك باستخدام هذا الأمر.");
  }
  callback();
}

// ─── الحالة ───────────────────────────────────────────────────
let state = {};

function clearState(chatId) {
  delete state[chatId];
}

// ─── لوحة الفئات ─────────────────────────────────────────────
function categoryKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: CATEGORIES.map((cat) => [
        { text: cat, callback_data: `cat:${cat}` },
      ]),
    },
  };
}

// ─── /start ───────────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || "مستخدم";
  const adminNote = isAdmin(msg.chat.id)
    ? "\n\n🔑 أنت مسجل كمشرف."
    : "";

  bot.sendMessage(
    msg.chat.id,
    `👋 أهلاً ${name}!\n\nالأوامر المتاحة:\n/list — عرض المنتجات\n/search — بحث عن منتج${
      isAdmin(msg.chat.id)
        ? "\n/add — إضافة منتج\n/edit — تعديل منتج\n/delete — حذف منتج"
        : ""
    }${adminNote}`
  );
});

// ─── /add ────────────────────────────────────────────────────
bot.onText(/\/add/, (msg) => {
  adminOnly(msg, () => {
    clearState(msg.chat.id);
    state[msg.chat.id] = { step: "name", mode: "add" };
    bot.sendMessage(msg.chat.id, "📝 اسم المنتج:");
  });
});

// ─── /edit ───────────────────────────────────────────────────
bot.onText(/\/edit/, (msg) => {
  adminOnly(msg, () => {
    const data = readDB();
    if (data.length === 0) {
      return bot.sendMessage(msg.chat.id, "📭 لا توجد منتجات للتعديل.");
    }

    const list = data
      .map((p, i) => `${i} — ${p.name} (${p.category}) — $${p.price}`)
      .join("\n");

    clearState(msg.chat.id);
    state[msg.chat.id] = { step: "edit_index", mode: "edit" };
    bot.sendMessage(
      msg.chat.id,
      `✏️ أدخل رقم المنتج الذي تريد تعديله:\n\n${list}`
    );
  });
});

// ─── /delete ─────────────────────────────────────────────────
bot.onText(/\/delete/, (msg) => {
  adminOnly(msg, () => {
    const data = readDB();
    if (data.length === 0) {
      return bot.sendMessage(msg.chat.id, "📭 لا توجد منتجات.");
    }

    const list = data
      .map((p, i) => `${i} — ${p.name} (${p.category}) — $${p.price}`)
      .join("\n");

    clearState(msg.chat.id);
    state[msg.chat.id] = { step: "delete_index", mode: "delete" };
    bot.sendMessage(
      msg.chat.id,
      `🗑️ أدخل رقم المنتج الذي تريد حذفه:\n\n${list}`
    );
  });
});

// ─── /list ───────────────────────────────────────────────────
bot.onText(/\/list/, (msg) => {
  const data = readDB();
  if (data.length === 0) {
    return bot.sendMessage(msg.chat.id, "📭 لا توجد منتجات.");
  }

  data.forEach((p, i) => {
    const caption =
      `🔖 #${i} — ${p.name}\n` +
      `🏷️ الفئة: ${p.category}\n` +
      `💰 السعر: $${p.price}\n` +
      `🕐 ${p.updatedAt ? "عُدِّل: " + p.updatedAt : "أُضيف: " + p.createdAt}`;

    if (p.image) {
      bot.sendPhoto(msg.chat.id, p.image, { caption }).catch(() => {
        bot.sendMessage(msg.chat.id, caption + "\n⚠️ (الصورة غير متاحة)");
      });
    } else {
      bot.sendMessage(msg.chat.id, caption);
    }
  });
});

// ─── /search ─────────────────────────────────────────────────
bot.onText(/\/search (.+)/, (msg, match) => {
  const query = match[1].toLowerCase();
  const data = readDB();

  const results = data.filter(
    (p) =>
      p.name.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query)
  );

  if (results.length === 0) {
    return bot.sendMessage(msg.chat.id, `🔍 لم يُعثر على "${match[1]}".`);
  }

  const text = results
    .map((p, i) => `${i} — ${p.name} (${p.category}) — $${p.price}`)
    .join("\n");

  bot.sendMessage(msg.chat.id, `🔍 النتائج:\n\n${text}`);
});

// ─── معالج الرسائل العام ──────────────────────────────────────
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const s = state[chatId];
  if (!s) return;

  // ─── وضع الإضافة ──────────────────────────────────────────
  if (s.mode === "add") {
    if (s.step === "name" && msg.text && !msg.text.startsWith("/")) {
      s.name = msg.text.trim();
      s.step = "price";
      return bot.sendMessage(chatId, "💰 السعر:");
    }

    if (s.step === "price" && msg.text && !msg.text.startsWith("/")) {
      const price = parseFloat(msg.text.trim());
      if (isNaN(price) || price < 0) {
        return bot.sendMessage(chatId, "⚠️ أدخل سعراً صحيحاً (رقم موجب):");
      }
      s.price = price;
      s.step = "category";
      return bot.sendMessage(chatId, "📂 اختر الفئة:", categoryKeyboard());
    }

    if (s.step === "image") {
      if (msg.photo) {
        s.imageFileId = msg.photo[msg.photo.length - 1].file_id;
      }
      // السماح بالتخطي
      saveProduct(chatId, s);
    }
  }

  // ─── وضع التعديل ──────────────────────────────────────────
  if (s.mode === "edit") {
    if (s.step === "edit_index" && msg.text) {
      const index = parseInt(msg.text.trim());
      const data = readDB();
      if (isNaN(index) || !data[index]) {
        return bot.sendMessage(chatId, "❌ رقم غير صحيح، حاول مجدداً:");
      }
      s.index = index;
      s.original = data[index];
      s.step = "edit_name";
      return bot.sendMessage(
        chatId,
        `✏️ الاسم الحالي: "${data[index].name}"\nأدخل الاسم الجديد (أو أرسل - للتخطي):`
      );
    }

    if (s.step === "edit_name" && msg.text) {
      s.name = msg.text.trim() === "-" ? s.original.name : msg.text.trim();
      s.step = "edit_price";
      return bot.sendMessage(
        chatId,
        `💰 السعر الحالي: $${s.original.price}\nأدخل السعر الجديد (أو أرسل - للتخطي):`
      );
    }

    if (s.step === "edit_price" && msg.text) {
      if (msg.text.trim() === "-") {
        s.price = s.original.price;
      } else {
        const price = parseFloat(msg.text.trim());
        if (isNaN(price) || price < 0) {
          return bot.sendMessage(chatId, "⚠️ أدخل سعراً صحيحاً أو أرسل - للتخطي:");
        }
        s.price = price;
      }
      s.step = "edit_category";
      return bot.sendMessage(
        chatId,
        `📂 الفئة الحالية: ${s.original.category}\nاختر فئة جديدة:`,
        categoryKeyboard()
      );
    }

    if (s.step === "edit_image") {
      if (msg.photo) {
        s.imageFileId = msg.photo[msg.photo.length - 1].file_id;
      }
      updateProduct(chatId, s);
    }
  }

  // ─── وضع الحذف ────────────────────────────────────────────
  if (s.mode === "delete" && s.step === "delete_index" && msg.text) {
    const index = parseInt(msg.text.trim());
    const data = readDB();
    if (isNaN(index) || !data[index]) {
      return bot.sendMessage(chatId, "❌ رقم غير صحيح، حاول مجدداً:");
    }
    const removed = data.splice(index, 1)[0];
    writeDB(data);
    clearState(chatId);
    return bot.sendMessage(chatId, `🗑️ تم حذف "${removed.name}" بنجاح.`);
  }
});

// ─── معالج الفئات (Inline Keyboard) ──────────────────────────
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const s = state[chatId];
  if (!s) return bot.answerCallbackQuery(query.id);

  if (query.data.startsWith("cat:")) {
    const selectedCat = query.data.replace("cat:", "");

    if (s.mode === "add" && s.step === "category") {
      s.category = selectedCat;
      s.step = "image";
      bot.answerCallbackQuery(query.id, { text: `✅ ${selectedCat}` });
      return bot.sendMessage(
        chatId,
        "📸 أرسل صورة المنتج (أو أرسل - للتخطي):"
      );
    }

    if (s.mode === "edit" && s.step === "edit_category") {
      s.category = selectedCat;
      s.step = "edit_image";
      bot.answerCallbackQuery(query.id, { text: `✅ ${selectedCat}` });
      return bot.sendMessage(
        chatId,
        "📸 أرسل صورة جديدة (أو أرسل - للتخطي):"
      );
    }
  }

  bot.answerCallbackQuery(query.id);
});

// ─── حفظ منتج جديد ───────────────────────────────────────────
function saveProduct(chatId, s) {
  const data = readDB();
  const now = new Date().toLocaleString("ar-SA");

  const product = {
    id: Date.now(),
    name: s.name,
    price: s.price,
    category: s.category,
    image: s.imageFileId
      ? `https://api.telegram.org/file/bot${TOKEN}/${s.imageFileId}`
      : null,
    createdAt: now,
    updatedAt: null,
  };

  data.push(product);
  writeDB(data);
  clearState(chatId);
  bot.sendMessage(chatId, `✅ تم إضافة "${product.name}" بنجاح!`);
}

// ─── تحديث منتج موجود ─────────────────────────────────────────
function updateProduct(chatId, s) {
  const data = readDB();
  const now = new Date().toLocaleString("ar-SA");

  data[s.index] = {
    ...data[s.index],
    name: s.name,
    price: s.price,
    category: s.category,
    image: s.imageFileId
      ? `https://api.telegram.org/file/bot${TOKEN}/${s.imageFileId}`
      : data[s.index].image,
    updatedAt: now,
  };

  writeDB(data);
  clearState(chatId);
  bot.sendMessage(chatId, `✅ تم تحديث "${data[s.index].name}" بنجاح!`);
}

// ─── معالجة الأخطاء العامة ───────────────────────────────────
bot.on("polling_error", (err) => {
  console.error("Polling error:", err.message);
});

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.message);
});

console.log("🤖 البوت يعمل...");

