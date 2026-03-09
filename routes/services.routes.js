const express = require("express");
const router = express.Router();

let services = [
  { id: "svc1", name: "Gel", durationMin: 45, price: 45, category: "Nails", isActive: true },
  { id: "svc2", name: "Pedicure", durationMin: 60, price: 50, category: "Feet", isActive: true },
];

router.get("/services", (req, res) => {
  const { isActive } = req.query;
  let data = [...services];

  if (isActive === "true") data = data.filter((s) => s.isActive);
  if (isActive === "false") data = data.filter((s) => !s.isActive);

  data.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  res.set("Cache-Control", "no-store");
  res.json({ data });
});

router.post("/services", (req, res) => {
  const { name, durationMin, price, category, isActive = true } = req.body || {};

  if (!name || durationMin === undefined || price === undefined) {
    return res.status(422).json({
      error: { code: "VALIDATION", message: "name, durationMin, price are required" },
    });
  }

  const newService = {
    id: `svc_${Date.now()}`,
    name,
    durationMin: Number(durationMin),
    price: Number(price),
    category: category || null,
    isActive: Boolean(isActive),
  };

  services.push(newService);
  res.status(201).json({ data: newService });
});

router.patch("/services/:id", (req, res) => {
  const { id } = req.params;
  const idx = services.findIndex((s) => s.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Service not found" } });
  }

  services[idx] = { ...services[idx], ...req.body };
  res.json({ data: services[idx] });
});

router.post("/services/:id/archive", (req, res) => {
  const { id } = req.params;
  const idx = services.findIndex((s) => s.id === id);

  if (idx === -1) {
    return res.status(404).json({ error: { code: "NOT_FOUND", message: "Service not found" } });
  }

  services[idx].isActive = false;
  res.json({ data: services[idx] });
});

module.exports = router;