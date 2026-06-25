const fs = require("fs");
const MESSAGED_USERS_FILE = "messaged_users.json";

function loadMessagedUsers() {
  if (!fs.existsSync(MESSAGED_USERS_FILE)) {
    fs.writeFileSync(MESSAGED_USERS_FILE, JSON.stringify([], null, 2));
    return [];
  }
  try {
    const content = fs.readFileSync(MESSAGED_USERS_FILE, "utf-8").trim();
    if (!content) {
      fs.writeFileSync(MESSAGED_USERS_FILE, JSON.stringify([], null, 2));
      return [];
    }
    return JSON.parse(content);
  } catch (err) {
    console.warn("⚠️  messaged_users.json was corrupted, resetting...");
    fs.writeFileSync(MESSAGED_USERS_FILE, JSON.stringify([], null, 2));
    return [];
  }
}

const allMessages = loadMessagedUsers();
const map = new Map();

for (const item of allMessages) {
  const dataItem = item.messagedAt.slice(0, 10);
  if (map.get(dataItem)) {
    map.set(dataItem, map.get(dataItem) + 1);
  } else {
    map.set(dataItem, 1);
  }
}
console.log(map);
