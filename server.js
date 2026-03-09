require("dotenv").config();
const express = require("express");
const cors = require("cors");
const pool = require("./db");

const app = express(); // ✅ PHẢI khai báo app trước khi app.use


// Middlewares
app.use(cors());
app.use(express.json());

app.get("/health", async (req, res) => {
  try {
    const result = await pool.query("select now() as now");
    res.json({
      ok: true,
      now: result.rows[0].now,
    });
  } catch (error) {
    console.error("DB health check error:", error);
    res.status(500).json({
      ok: false,
      message: "Database connection failed",
    });
  }
});

const PORT = process.env.PORT || 4000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Demo /me endpoint
app.get("/me", (req, res) => {
  res.set("Cache-Control", "no-store");
  res.json({ id: "u1", name: "Owner", role: "OWNER" });
});

// Routes
const servicesRoutes = require("./routes/services.routes");
app.use(servicesRoutes);
const staffRoutes = require("./routes/staff.routes");
app.use(staffRoutes);
const authRoutes = require("./routes/auth.routes");
app.use(authRoutes);

//Staff auth routes (set-password, login)
const staffAuthRoutes = require("./routes/staff.auth.routes");  
app.use(staffAuthRoutes);

// Start server
