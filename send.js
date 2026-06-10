const { chromium } = require("playwright");
const fs = require("fs");
const { buildMessage } = require("./messages");

const MESSAGED_USERS_FILE = "messaged_users.json";
const DAILY_LIMIT = 499;

// ─── File helpers ────────────────────────────────────────────────────────────

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

function saveMessagedUser(userRecord) {
  const users = loadMessagedUsers();
  users.push(userRecord);
  fs.writeFileSync(MESSAGED_USERS_FILE, JSON.stringify(users, null, 2));
  console.log(`💾 Saved user: ${userRecord.name} (${userRecord.profileUrl})`);
}

function hasAlreadyMessaged(profileUrl) {
  const users = loadMessagedUsers();
  return users.some((u) => u.profileUrl === profileUrl);
}

function countMessagedToday() {
  const users = loadMessagedUsers();
  const today = new Date().toISOString().slice(0, 10);
  return users.filter((u) => u.messagedAt?.startsWith(today)).length;
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

async function getMessageButtons(page) {
  return page.locator('a[aria-label^="Send a message to"]');
}

async function collectButtonData(page) {
  const buttons = await getMessageButtons(page);
  const count = await buttons.count();
  const results = [];

  for (let i = 0; i < count; i++) {
    const btn = buttons.nth(i);
    const ariaLabel = await btn.getAttribute("aria-label");
    const name = ariaLabel?.replace("Send a message to ", "").trim() || "";

    const { profileUrl, headline } = await btn.evaluate((el) => {
      const card =
        el.closest('[data-testid="lazy-column"] > div > div') ||
        el.closest("._58a5ca3e") ||
        el.closest("._4ea4abba");
      if (!card) return { profileUrl: null, headline: null };

      const profileLink = card.querySelector('a[href*="/in/"]');
      const headlineSpans = card.querySelectorAll("p span");
      let headline = null;
      headlineSpans.forEach((s) => {
        if (s.innerText && s.innerText.length > (headline?.length || 0)) {
          headline = s.innerText.trim();
        }
      });

      return {
        profileUrl: profileLink ? profileLink.getAttribute("href") : null,
        headline,
      };
    });

    const normalizedUrl = profileUrl
      ? profileUrl.startsWith("http")
        ? profileUrl.split("?")[0].replace(/\/$/, "")
        : "https://www.linkedin.com" +
          profileUrl.split("?")[0].replace(/\/$/, "")
      : null;

    const companyMatch = headline?.match(/@([^|•\n]+)/);
    const atMatch = headline?.match(/\bat\s+([^|•\n]+)/i);
    const company = companyMatch
      ? companyMatch[1].trim()
      : atMatch
        ? atMatch[1].trim()
        : null;

    results.push({
      name,
      profileUrl: normalizedUrl,
      headline,
      company,
      index: i,
    });
  }

  return results;
}

// ─── Bubble cleanup ───────────────────────────────────────────────────────────

async function dismissIncomingMessageBubble(page) {
  // Close the minimized messaging tray
  try {
    const tray = page.locator("div.msg-overlay-list-bubble");
    const trayCount = await tray.count();
    if (trayCount > 0) {
      const trayBtn = tray.locator(
        ".msg-overlay-bubble-header__controls button:last-child",
      );
      if ((await trayBtn.count()) > 0) {
        await trayBtn.evaluate((btn) => btn.click());
        console.log("  🔕 Dismissed messaging tray");
        await page.waitForTimeout(300);
      }
    }
  } catch {
    // silently ignore
  }

  // Close all petite reply bubbles (appear when someone messages back)
  try {
    const petiteBubbles = page.locator(
      ".msg-overlay-conversation-bubble--petite",
    );
    const petiteCount = await petiteBubbles.count();

    for (let i = 0; i < petiteCount; i++) {
      try {
        const bubble = petiteBubbles.nth(i);
        const closeBtn = bubble.locator(
          ".msg-overlay-bubble-header__controls button:last-child",
        );
        if ((await closeBtn.count()) > 0) {
          await closeBtn.evaluate((btn) => btn.click());
          console.log(
            `  🔕 Closed petite reply bubble ${i + 1}/${petiteCount}`,
          );
          await page.waitForTimeout(300);
        }
      } catch {
        // ignore individual bubble errors
      }
    }
  } catch {
    // silently ignore
  }
}

async function closeAllOpenConversations(page) {
  // Close any active conversation bubble that is NOT a compose bubble
  try {
    const openBubbles = page.locator(
      ".msg-overlay-conversation-bubble--is-active:not(.msg-overlay-conversation-bubble--is-compose)",
    );
    const count = await openBubbles.count();

    for (let i = 0; i < count; i++) {
      try {
        const bubble = openBubbles.nth(i);
        const closeBtn = bubble.locator(
          ".msg-overlay-bubble-header__controls button:last-child",
        );
        if ((await closeBtn.count()) > 0) {
          await closeBtn.evaluate((btn) => btn.click());
          console.log(`  🔒 Closed open conversation ${i + 1}/${count}`);
          await page.waitForTimeout(300);
        }
      } catch {
        // ignore individual errors
      }
    }
  } catch {
    // silently ignore
  }
}

async function emergencyCloseAnyBubble(page) {
  try {
    const anyCloseBtn = page
      .locator(
        ".msg-overlay-conversation-bubble .msg-overlay-bubble-header__controls button:last-child",
      )
      .last();
    const count = await anyCloseBtn.count();
    if (count > 0) {
      await anyCloseBtn.evaluate((btn) => btn.click());
      console.log("  🆘 Emergency closed a conversation bubble");
      await page.waitForTimeout(500);
    }
  } catch {
    // silently ignore
  }
}

// ─── Scroll helpers ───────────────────────────────────────────────────────────

async function scrollDown(page) {
  await page.evaluate(() => {
    const main = document.querySelector("main#workspace");
    if (main) {
      main.scrollBy({ top: 1000, behavior: "smooth" });
    }
    window.scrollBy({ top: 1000, behavior: "smooth" });
    document.documentElement.scrollBy({ top: 1000, behavior: "smooth" });
  });
  await page.waitForTimeout(2500);
}

async function getScrollTop(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main#workspace");
    return main ? main.scrollTop : window.scrollY;
  });
}

async function getScrollHeight(page) {
  return page.evaluate(() => {
    const main = document.querySelector("main#workspace");
    return main
      ? Math.max(document.documentElement.scrollHeight, main.scrollHeight)
      : document.documentElement.scrollHeight;
  });
}

async function getButtonCount(page) {
  const buttons = await getMessageButtons(page);
  return buttons.count();
}

// ─── Message action ───────────────────────────────────────────────────────────

// Returns "sent" (fully confirmed), "sent_no_button" (typed but send btn missing)
// Throws only if compose window itself never opened (true skip)
async function sendMessage(page, buttonIndex, name, company) {
  await dismissIncomingMessageBubble(page);
  await closeAllOpenConversations(page);

  const buttons = await getMessageButtons(page);
  await buttons.nth(buttonIndex).click();
  console.log(`  📨 Clicked message button`);

  await page.waitForTimeout(1500);
  await dismissIncomingMessageBubble(page);

  const message = buildMessage(name, company);
  console.log(`  ✉️  Message preview:\n${message}\n`);

  const composeBubble = page
    .locator(".msg-overlay-conversation-bubble--is-compose")
    .last();

  // ✅ If compose window not found — true failure, throw to skip user entirely
  let contentEditable;
  try {
    contentEditable = composeBubble.locator('[contenteditable="true"]').first();
    await contentEditable.waitFor({ state: "visible", timeout: 5000 });
  } catch {
    console.warn(
      "  ⚠️  Could not find message input — closing any open bubble",
    );
    await emergencyCloseAnyBubble(page);
    throw new Error("Message input not found — skipping user");
  }

  await contentEditable.click();
  await contentEditable.pressSequentially(message, { delay: 2 });
  await page.waitForTimeout(1000);

  // ✅ If send button not found — message was typed, still mark as sent
  let sendButton;
  try {
    sendButton = composeBubble
      .locator("button.msg-form__send-button:not([disabled])")
      .first();
    await sendButton.waitFor({ state: "attached", timeout: 5000 });
    await sendButton.evaluate((btn) => btn.click());
    console.log(`  ✅ Message sent`);
    await page.waitForTimeout(3000);
    return "sent";
  } catch {
    console.warn(
      "  ⚠️  Could not find send button — marking as sent and closing",
    );
    await emergencyCloseAnyBubble(page);
    return "sent_no_button";
  }
}

async function closeConversation(page) {
  try {
    await dismissIncomingMessageBubble(page);

    const closeButton = page
      .locator(
        ".msg-overlay-conversation-bubble--is-active .msg-overlay-bubble-header__controls button:last-child",
      )
      .last();

    await closeButton.waitFor({ state: "attached", timeout: 5000 });
    await closeButton.evaluate((btn) => btn.click());
    console.log(`  🔒 Conversation closed`);
  } catch {
    await emergencyCloseAnyBubble(page);
  }

  await page.waitForTimeout(2000);
}

// ─── Process a batch of visible buttons ──────────────────────────────────────

async function processVisibleButtons(page, processedUrls, dailyCount) {
  await dismissIncomingMessageBubble(page);
  await closeAllOpenConversations(page);

  const buttonDataList = await collectButtonData(page);
  console.log(`\n🔍 Found ${buttonDataList.length} message buttons in view`);

  for (const { name, profileUrl, headline, company } of buttonDataList) {
    // ✅ Check daily limit before each message
    if (dailyCount.value >= DAILY_LIMIT) {
      console.log(
        `\n🛑 Daily limit of ${DAILY_LIMIT} messages reached. Stopping.`,
      );
      return true;
    }

    if (!profileUrl) {
      console.log(`  ⚠️  Skipping "${name}" — could not extract profile URL`);
      continue;
    }

    if (processedUrls.has(profileUrl) || hasAlreadyMessaged(profileUrl)) {
      console.log(`  ⏭️  Already messaged: ${name} (${profileUrl})`);
      continue;
    }

    console.log(`\n➡️  Processing: ${name} (${profileUrl})`);
    console.log(`  🏢 Company: ${company || "unknown"}`);
    console.log(`  📊 Daily count: ${dailyCount.value}/${DAILY_LIMIT}`);

    try {
      const freshButtons = await getMessageButtons(page);
      const freshCount = await freshButtons.count();

      let targetIndex = -1;
      for (let i = 0; i < freshCount; i++) {
        const label = await freshButtons.nth(i).getAttribute("aria-label");
        if (label?.includes(name)) {
          targetIndex = i;
          break;
        }
      }

      if (targetIndex === -1) {
        console.log(`  ⚠️  Could not find button for ${name}, skipping`);
        continue;
      }

      const status = await sendMessage(page, targetIndex, name, company);

      // ✅ Save and increment when sendMessage succeeds
      processedUrls.add(profileUrl);
      saveMessagedUser({
        name,
        profileUrl,
        company: company || null,
        headline: headline || null,
        messagedAt: new Date().toISOString(),
        status,
      });
      dailyCount.value++;
      console.log(
        `  💾 Marked as messaged: ${name} | Status: ${status} | Daily: ${dailyCount.value}/${DAILY_LIMIT}`,
      );

      if (status === "sent") {
        await closeConversation(page);
      }
    } catch (err) {
      // ✅ sendMessage threw (compose window never opened) —
      // but still save the user and increment count so we don't retry them
      console.error(`  ❌ Error processing ${name}:`, err.message);

      if (profileUrl) {
        processedUrls.add(profileUrl);
        saveMessagedUser({
          name,
          profileUrl,
          company: company || null,
          headline: headline || null,
          messagedAt: new Date().toISOString(),
          status: "error_skipped",
        });
        dailyCount.value++;
        console.log(
          `  💾 Saved as skipped: ${name} | Status: error_skipped | Daily: ${dailyCount.value}/${DAILY_LIMIT}`,
        );
      }

      await emergencyCloseAnyBubble(page);
    }
  }

  return false;
}
// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    storageState: "linkedin-session.json",
  });
  const page = await context.newPage();

  await page.goto(
    "https://www.linkedin.com/mynetwork/invite-connect/connections/",
  );
  await page.waitForTimeout(5000);

  await dismissIncomingMessageBubble(page);
  await closeAllOpenConversations(page);

  const processedUrls = new Set(loadMessagedUsers().map((u) => u.profileUrl));

  // ✅ Calculate messages sent today at startup
  const dailyCount = { value: countMessagedToday() };
  console.log(
    `\n📅 Messages sent today so far: ${dailyCount.value}/${DAILY_LIMIT}`,
  );

  if (dailyCount.value >= DAILY_LIMIT) {
    console.log(`🛑 Daily limit already reached. Come back tomorrow!`);
    await browser.close();
    return;
  }

  let previousScrollTop = -1;
  let previousScrollHeight = -1;
  let previousButtonCount = 0;
  let noNewContentCount = 0;
  const MAX_NO_NEW_CONTENT = 3;

  while (true) {
    const limitReached = await processVisibleButtons(
      page,
      processedUrls,
      dailyCount,
    );
    if (limitReached) break;

    await dismissIncomingMessageBubble(page);
    await closeAllOpenConversations(page);

    console.log("\n⬇️  Scrolling for more connections...");
    await scrollDown(page);

    await dismissIncomingMessageBubble(page);

    const currentScrollTop = await getScrollTop(page);
    const currentScrollHeight = await getScrollHeight(page);
    const currentButtonCount = await getButtonCount(page);

    console.log(
      `  📊 scrollTop: ${currentScrollTop}, scrollHeight: ${currentScrollHeight}, buttons: ${currentButtonCount}`,
    );

    const scrollTopUnchanged = currentScrollTop === previousScrollTop;
    const scrollHeightUnchanged = currentScrollHeight === previousScrollHeight;
    const countUnchanged = currentButtonCount === previousButtonCount;

    if (scrollTopUnchanged && scrollHeightUnchanged && countUnchanged) {
      noNewContentCount++;
      console.log(
        `\n📏 No new content after scroll (${noNewContentCount}/${MAX_NO_NEW_CONTENT})`,
      );
      if (noNewContentCount >= MAX_NO_NEW_CONTENT) {
        console.log("\n✅ Reached end of connections list. Done!");
        break;
      }
    } else {
      noNewContentCount = 0;
      previousScrollTop = currentScrollTop;
      previousScrollHeight = currentScrollHeight;
      previousButtonCount = currentButtonCount;
      console.log(`  📈 New content loaded`);
    }
  }

  console.log(
    `\n🏁 Session complete. Total sent today: ${dailyCount.value}/${DAILY_LIMIT}`,
  );
  await browser.close();
})();
