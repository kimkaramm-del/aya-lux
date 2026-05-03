const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "database.json");

// ─── Middleware ───────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

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
    throw new Error("فشل في حفظ البيانات");
  }
}

// ─── التحقق من صحة المنتج ────────────────────────────────────
function validateProduct(body) {
  const errors = [];

  if (!body.name || typeof body.name !== "string" || !body.name.trim()) {
    errors.push("الاسم مطلوب");
  }

  const price = parseFloat(body.price);
  if (isNaN(price) || price < 0) {
    errors.push("السعر يجب أن يكون رقماً موجباً");
  }

  if (!body.category || typeof body.category !== "string") {
    errors.push("الفئة مطلوبة");
  }

  return errors;
}

// ─── Routes ───────────────────────────────────────────────────

// جلب جميع المنتجات (مع فلترة اختيارية بالفئة)
app.get("/api/products", (req, res) => {
  const data = readDB();
  const { category, search } = req.query;

  let result = data;

  if (category) {
    result = result.filter(
      (p) => p.category?.toLowerCase() === category.toLowerCase()
    );
  }

  if (search) {
    const q = search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q)
    );
  }

  res.json({ count: result.length, products: result });
});

// جلب منتج واحد
app.get("/api/products/:id", (req, res) => {
  const data = readDB();
  const product = data.find((p) => p.id === parseInt(req.params.id));

  if (!product) {
    return res.status(404).json({ error: "المنتج غير موجود" });
  }

  res.json(product);
});

// إضافة منتج
app.post("/api/products", (req, res) => {
  const errors = validateProduct(req.body);
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const data = readDB();
  const now = new Date().toISOString();

  const product = {
    id: Date.now(),
    name: req.body.name.trim(),
    price: parseFloat(req.body.price),
    category: req.body.category.trim(),
    image: req.body.image || null,
    createdAt: now,
    updatedAt: null,
  };

  data.push(product);

  try {
    writeDB(data);
    res.status(201).json({ message: "تمت الإضافة", product });
  } catch {
    res.status(500).json({ error: "فشل في حفظ المنتج" });
  }
});

// تعديل منتج
app.put("/api/products/:id", (req, res) => {
  const data = readDB();
  const index = data.findIndex((p) => p.id === parseInt(req.params.id));

  if (index === -1) {
    return res.status(404).json({ error: "المنتج غير موجود" });
  }

  const errors = validateProduct({ ...data[index], ...req.body });
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  data[index] = {
    ...data[index],
    name: req.body.name?.trim() ?? data[index].name,
    price: req.body.price !== undefined ? parseFloat(req.body.price) : data[index].price,
    category: req.body.category?.trim() ?? data[index].category,
    image: req.body.image ?? data[index].image,
    updatedAt: new Date().toISOString(),
  };

  try {
    writeDB(data);
    res.json({ message: "تم التعديل", product: data[index] });
  } catch {
    res.status(500).json({ error: "فشل في حفظ التعديل" });
  }
});

// حذف منتج
app.delete("/api/products/:id", (req, res) => {
  const data = readDB();
  const index = data.findIndex((p) => p.id === parseInt(req.params.id));

  if (index === -1) {
    return res.status(404).json({ error: "المنتج غير موجود" });
  }

  const removed = data.splice(index, 1)[0];

  try {
    writeDB(data);
    res.json({ message: "تم الحذف", product: removed });
  } catch {
    res.status(500).json({ error: "فشل في حذف المنتج" });
  }
});

// ─── 404 للمسارات غير الموجودة ───────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: "المسار غير موجود" });
});

// ─── معالج الأخطاء العام ──────────────────────────────────────
app.use((err, req, res, next) => {
  console.error("Server error:", err.message);
  res.status(500).json({ error: "خطأ داخلي في الخادم" });
});

// ─── تشغيل السيرفر ────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🚀 السيرفر يعمل على http://localhost:${PORT}`);
});

