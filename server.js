require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const path = require("path");
const os = require("os");

const app = express();

if (!process.env.ADMIN_KEY) {
  console.error("ADMIN_KEY is required. Add it to your .env file or hosting environment variables.");
  process.exit(1);
}

const PORT = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/spicy_spot";
const ADMIN_KEY = process.env.ADMIN_KEY;

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const orderSchema = new mongoose.Schema({
  orderId: { type: String, unique: true, required: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  room: { type: String, required: true, trim: true },
  items: [{ name: String, price: Number, qty: Number }],
  total: { type: Number, required: true },
  status: {
    type: String,
    enum: ["New", "Accepted", "Preparing", "Out for Delivery", "Delivered", "Cancelled"],
    default: "New"
  },
  createdAt: { type: Date, default: Date.now },
  archivedAt: { type: Date, default: null }
});

const Order = mongoose.model("Order", orderSchema);

const MENU = {
  "Chicken Dum Biryani": 130,
  "Biryani Plain Rice": 120
};

function adminOnly(req, res, next) {
  if (req.headers["x-admin-key"] !== ADMIN_KEY) {
    return res.status(401).json({ message: "Invalid admin password." });
  }
  next();
}

function makeOrderId() {
  const stamp = Date.now().toString().slice(-6);
  const rand = Math.floor(100 + Math.random() * 900);
  return `SP-${stamp}-${rand}`;
}

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

// Orders from previous days are automatically moved to History.
// Nothing is deleted from MongoDB.
async function archivePreviousDays() {
  const start = startOfToday();
  await Order.updateMany(
    { archivedAt: null, createdAt: { $lt: start } },
    { $set: { archivedAt: new Date() } }
  );
}

app.get("/api/health", (req, res) => {
  res.json({ ok: true, database: mongoose.connection.readyState === 1 });
});

app.post("/api/orders", async (req, res) => {
  try {
    const { name, phone, room, items } = req.body;
    if (!name || !phone || !room || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: "Please provide name, phone, room and at least one item." });
    }
    if (!/^\d{10}$/.test(String(phone))) {
      return res.status(400).json({ message: "Phone number must contain exactly 10 digits." });
    }

    const cleanItems = items.map(item => {
      const price = MENU[item.name];
      const qty = Math.max(1, Math.min(20, Number(item.qty) || 1));
      if (!price) throw new Error(`Invalid menu item: ${item.name}`);
      return { name: item.name, price, qty };
    });

    const total = cleanItems.reduce((sum, item) => sum + item.price * item.qty, 0);

    let orderId;
    for (let i = 0; i < 5; i++) {
      const candidate = makeOrderId();
      const exists = await Order.exists({ orderId: candidate });
      if (!exists) { orderId = candidate; break; }
    }
    if (!orderId) throw new Error("Could not generate order ID.");

    const order = await Order.create({
      orderId, name, phone, room, items: cleanItems, total, status: "New"
    });

    res.status(201).json({ message: "Order received successfully.", order });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Could not place order. Make sure MongoDB is running." });
  }
});

app.get("/api/orders/:orderId", async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).lean();
    if (!order) return res.status(404).json({ message: "Order not found." });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Could not load order." });
  }
});

// Active orders = today's orders that have not been archived.
app.get("/api/orders", adminOnly, async (req, res) => {
  try {
    await archivePreviousDays();
    const orders = await Order.find({ archivedAt: null }).sort({ createdAt: -1 }).lean();
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Could not load orders." });
  }
});

// Complete order history. Orders are kept in MongoDB, not deleted.
app.get("/api/history", adminOnly, async (req, res) => {
  try {
    await archivePreviousDays();
    const history = await Order.find({ archivedAt: { $ne: null } }).sort({ createdAt: -1 }).lean();
    res.json(history);
  } catch (err) {
    res.status(500).json({ message: "Could not load history." });
  }
});

// Admin can close the day. All current active orders are moved to History.
app.post("/api/admin/close-day", adminOnly, async (req, res) => {
  try {
    const result = await Order.updateMany(
      { archivedAt: null },
      { $set: { archivedAt: new Date() } }
    );
    res.json({ message: `${result.modifiedCount} order(s) moved to History.`, count: result.modifiedCount });
  } catch (err) {
    res.status(500).json({ message: "Could not close the day." });
  }
});

app.patch("/api/orders/:orderId/status", adminOnly, async (req, res) => {
  try {
    const allowed = ["New", "Accepted", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];
    if (!allowed.includes(req.body.status)) {
      return res.status(400).json({ message: "Invalid status." });
    }

    const order = await Order.findOneAndUpdate(
      { orderId: req.params.orderId, archivedAt: null },
      { status: req.body.status },
      { new: true }
    ).lean();

    if (!order) return res.status(404).json({ message: "Active order not found." });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Could not update status." });
  }
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

function getLocalIPs() {
  const nets = os.networkInterfaces();
  const ips = [];
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === "IPv4" && !net.internal) ips.push(net.address);
    }
  }
  return [...new Set(ips)];
}

mongoose.connect(MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected.");
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Spicy Spot running on port ${PORT}`);
      console.log(`Laptop: http://localhost:${PORT}`);
      getLocalIPs().forEach(ip => console.log(`Phone (same Wi-Fi): http://${ip}:${PORT}`));
      console.log(`Admin: http://localhost:${PORT}/admin`);
    });
  })
  .catch(err => {
    console.error("MongoDB connection failed:", err.message);
    console.error("Start the MongoDB service, then run: npm start");
    process.exit(1);
  });
