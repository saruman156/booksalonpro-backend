const fs = require("fs");
const path = require("path");

const STAFF_FILE = path.join(__dirname, "..", "data", "staff.json");

function loadStaff() {
  try {
    if (!fs.existsSync(STAFF_FILE)) return [];
    const raw = fs.readFileSync(STAFF_FILE, "utf-8");
    const data = JSON.parse(raw || "[]");
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function saveStaff(staffArr) {
  fs.mkdirSync(path.dirname(STAFF_FILE), { recursive: true });
  fs.writeFileSync(STAFF_FILE, JSON.stringify(staffArr, null, 2), "utf-8");
}

module.exports = { loadStaff, saveStaff };