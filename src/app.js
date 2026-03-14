require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");

const staffRoutes = require("./routes/staff.routes");
const customerRoutes = require("./routes/customer.routes");
const servicesRoutes = require("./routes/services.routes");
// const authRoutes = require("./routes/auth.routes");

const app = express();

app.use(cors());
app.use(express.json());

app.get("/health", (req, res) => {
  res.json({ ok: true, service: "nail-backend" });
});

app.get("/health/db", async (req, res) => {
  try {
    const result = await pool.query("select now() as now");
    res.json({
      ok: true,
      db: "connected",
      now: result.rows[0].now,
    });
  } catch (error) {
    console.error("DB health check error:", error);
    res.status(500).json({
      ok: false,
      error: error.message,
    });
  }
});

app.use("/staff", staffRoutes);
app.use("/customers", customerRoutes);
app.use("/services", servicesRoutes);
// app.use("/auth", authRoutes);

module.exports = app;