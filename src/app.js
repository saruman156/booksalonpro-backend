require("dotenv").config();

const express = require("express");
const cors = require("cors");
const pool = require("./db/pool");

const staffRoutes = require("./routes/staff.routes");
const customerRoutes = require("./routes/customer.routes");
const servicesRoutes = require("./routes/services.routes");
const authRoutes = require("./routes/auth.routes");
const appointmentsRoutes = require("./routes/appointments.routes");
const giftCardsRoutes = require("./routes/giftCards.routes");
const commissionsRoutes = require("./routes/commissions.routes");
const reportsRoutes = require("./routes/reports.routes");

const requireAuth = require("./middlewares/requireAuth");
const requireRoles = require("./middlewares/requireRoles");
const payrollRoutes = require("./routes/payroll.routes");
const suppliesRoutes = require("./routes/supplies.routes");

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

// Public auth only
app.use("/auth", authRoutes);

// Protected modules
app.use(
  "/appointments",
  requireAuth,
  requireRoles("OWNER", "MANAGER", "RECEPTIONIST", "TECHNICIAN"),
  appointmentsRoutes
);

app.use(
  "/staff",
  requireAuth,
  requireRoles("OWNER", "MANAGER"),
  staffRoutes
);

app.use(
  "/services",
  requireAuth,
  requireRoles("OWNER", "MANAGER", "RECEPTIONIST"),
  servicesRoutes
);

app.use(
  "/customers",
  requireAuth,
  requireRoles("OWNER", "MANAGER", "RECEPTIONIST", "TECHNICIAN"),
  customerRoutes
);

app.use(
  "/gift-cards",
  requireAuth,
  requireRoles("OWNER", "MANAGER", "RECEPTIONIST"),
  giftCardsRoutes
);

app.use(
  "/commissions",
  requireAuth,
  requireRoles("OWNER", "MANAGER"),
  commissionsRoutes
);

app.use(
  "/reports",
  requireAuth,
  requireRoles("OWNER", "MANAGER", "RECEPTIONIST"),
  reportsRoutes
);

app.use("/payroll", payrollRoutes);
app.use("/supplies", suppliesRoutes);

module.exports = app;