const { chromium } = require("playwright");
const fs = require("fs");
const { buildMessage } = require("./messages");
const path = require("path");
const MESSAGED_USERS_FILE = "messaged_users.json";
const DAILY_LIMIT = 250;

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

async function removeConnectionCard(page, profileUrl) {
  try {
    await page.evaluate((url) => {
      const profilePath = url
        .replace("https://www.linkedin.com", "")
        .split("?")[0]
        .replace(/\/$/, "");

      // find the anchor pointing to this profile inside the list
      const anchor = document.querySelector(
        `[data-testid="lazy-column"] a[href*="${profilePath}"]`,
      );
      if (!anchor) return;

      // the direct child of lazy-column is the _54096e47 wrapper div
      const lazyColumn = document.querySelector('[data-testid="lazy-column"]');
      if (!lazyColumn) return;

      // walk up from anchor until we hit a direct child of lazyColumn
      let wrapper = anchor;
      while (wrapper && wrapper.parentElement !== lazyColumn) {
        wrapper = wrapper.parentElement;
      }
      if (!wrapper) return;

      // also grab the next sibling — it's always the _183fed99 separator/hr div
      const separator = wrapper.nextElementSibling;

      wrapper.remove();

      if (separator && separator.querySelector('hr[role="presentation"]')) {
        separator.remove();
      }
    }, profileUrl);

    console.log(`  🗑️  Removed card from DOM: ${profileUrl}`);
  } catch {
    // silently ignore
  }
}

// ✅ Build in-memory Set of all messaged profile URLs at startup
function buildMessagedUrlsSet() {
  const users = loadMessagedUsers();
  return new Set(users.map((u) => u.profileUrl).filter(Boolean));
}

// ✅ Append a single user record to the JSON file without reloading everything
function appendMessagedUser(userRecord, messagedUrlsSet) {
  // Update in-memory set immediately
  messagedUrlsSet.add(userRecord.profileUrl);

  // Append to file — load once, push, save
  const users = loadMessagedUsers();
  users.push(userRecord);
  fs.writeFileSync(MESSAGED_USERS_FILE, JSON.stringify(users, null, 2));
  console.log(`💾 Saved user: ${userRecord.name} (${userRecord.profileUrl})`);
}

// ✅ O(1) lookup — no file read
function hasAlreadyMessaged(profileUrl, messagedUrlsSet) {
  return messagedUrlsSet.has(profileUrl);
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

    let company = null;
    try {
      const companyMatch = headline?.match(/@([^|•\n]+)/);
      const atMatch = headline?.match(/\bat\s+([^|•\n]+)/i);
      company = companyMatch
        ? companyMatch[1].trim()
        : atMatch
          ? atMatch[1].trim()
          : null;
    } catch {
      company = null;
    }

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
  await page.waitForTimeout(3500);
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

/**
 * Wraps buildMessage() so that ANY error while building the templated message
 * (bad name format, weird headline data, etc.) falls back to a minimal,
 * hand-built message instead of skipping the user entirely.
 */
function safeBuildMessage(name, company) {
  try {
    return buildMessage(name, { company: company || undefined });
  } catch (err) {
    console.warn(
      `  ⚠️  buildMessage() failed (${err.message}) — using fallback message`,
    );

    let firstName = "there";
    try {
      firstName = (name || "").split(" ")[0] || "there";
    } catch {
      // keep default
    }

    const lines = [`Hi ${firstName},`];
    lines.push(
      "Hope you're doing well! I'm currently exploring Full Stack Developer opportunities.",
    );

    if (company) {
      lines.push(
        `If there are any suitable openings at ${company}, I'd really appreciate a referral.`,
      );
    } else {
      lines.push(
        "If there are any suitable openings at your company, I'd really appreciate a referral.",
      );
    }

    lines.push(
      "Here's my resume if it helps: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view",
    );
    lines.push("My portfolio: https://ashraf-khan-portfolio.vercel.app");
    lines.push("Thanks a lot!");

    return lines.join("\n");
  }
}

async function sendMessage(page, buttonIndex, name, company) {
  await dismissIncomingMessageBubble(page);
  await closeAllOpenConversations(page);

  const buttons = await getMessageButtons(page);
  await buttons.nth(buttonIndex).click();
  console.log(`  📨 Clicked message button`);

  await page.waitForTimeout(1500);
  await dismissIncomingMessageBubble(page);

  const message = safeBuildMessage(name, company);
  console.log(`  ✉️  Message preview:\n${message}\n`);

  const composeBubble = page
    .locator(".msg-overlay-conversation-bubble--is-compose")
    .last();

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

async function processVisibleButtons(page, messagedUrlsSet, dailyCount) {
  await dismissIncomingMessageBubble(page);
  await closeAllOpenConversations(page);

  const buttonDataList = await collectButtonData(page);
  console.log(`\n🔍 Found ${buttonDataList.length} message buttons in view`);

  for (const { name, profileUrl, headline, company } of buttonDataList) {
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

    // ✅ O(1) in-memory lookup — no file read
    if (hasAlreadyMessaged(profileUrl, messagedUrlsSet)) {
      console.log(`  ⏭️  Already messaged: ${name} (${profileUrl})`);
      await removeConnectionCard(page, profileUrl); // 👈 add this
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

      // ✅ Update both in-memory Set and file in one shot
      appendMessagedUser(
        {
          name,
          profileUrl,
          company: company || null,
          headline: headline || null,
          messagedAt: new Date().toISOString(),
          status,
        },
        messagedUrlsSet,
      );
      dailyCount.value++;
      await removeConnectionCard(page, profileUrl); // 👈 add this

      console.log(
        `  💾 Marked as messaged: ${name} | Status: ${status} | Daily: ${dailyCount.value}/${DAILY_LIMIT}`,
      );

      if (status === "sent") {
        await closeConversation(page);
      }
      await removeConnectionCard(page, profileUrl); // 👈 add this
    } catch (err) {
      console.error(`  ❌ Error processing ${name}:`, err.message);

      const isPageClosed = /Target page, context or browser has been closed/i.test(
        err.message || "",
      );
      if (isPageClosed) {
        console.error(
          "  🛑 Browser/page was closed externally — stopping script.",
        );
        throw err; // bubble up so the main loop stops instead of looping on a dead page
      }

      if (profileUrl) {
        // ✅ Save error_skipped users the same way — update Set + file together
        appendMessagedUser(
          {
            name,
            profileUrl,
            company: company || null,
            headline: headline || null,
            messagedAt: new Date().toISOString(),
            status: "error_skipped",
          },
          messagedUrlsSet,
        );
        dailyCount.value++;
        await removeConnectionCard(page, profileUrl); // 👈 add this
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
  const PROFILE_DIR = path.join(__dirname, "chrome-profile");

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    // Launch maximized. viewport:null is required — otherwise Playwright pins a
    // fixed viewport and the window size is ignored.
    args: ["--start-maximized"],
    viewport: null,
  });

  const page = await context.newPage();

  await page.goto(
    "https://www.linkedin.com/mynetwork/invite-connect/connections/",
    { waitUntil: "load" },
  );

  // "load" fires before the React list populates, so also wait for the first
  // connection card to actually render.
  console.log("");
  console.log("⏳ Waiting for the connections list to render...");
  await page
    .locator('a[aria-label^="Send a message to"]')
    .first()
    .waitFor({ state: "visible", timeout: 60000 });

  // Settle before the first click.
  await page.waitForTimeout(2000);
  console.log("✅ Page loaded — starting.");

  await dismissIncomingMessageBubble(page);
  await closeAllOpenConversations(page);

  // ✅ Build in-memory Set once at startup — all future lookups use this
  const messagedUrlsSet = buildMessagedUrlsSet();
  console.log(
    `\n📦 Loaded ${messagedUrlsSet.size} previously messaged users into memory`,
  );

  // ✅ Count today's messages from file once at startup
  const dailyCount = { value: countMessagedToday() };
  console.log(
    `\n📅 Messages sent today so far: ${dailyCount.value}/${DAILY_LIMIT}`,
  );

  if (dailyCount.value >= DAILY_LIMIT) {
    console.log(`🛑 Daily limit already reached. Come back tomorrow!`);
    await context.close();
    return;
  }

  let previousScrollTop = -1;
  let previousScrollHeight = -1;
  let previousButtonCount = 0;
  let noNewContentCount = 0;
  const MAX_NO_NEW_CONTENT = 3;

  try {
    while (true) {
      // ✅ Pass messagedUrlsSet instead of separate processedUrls
      const limitReached = await processVisibleButtons(
        page,
        messagedUrlsSet,
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
  } catch (err) {
    console.error(`\n🛑 Stopped early due to error: ${err.message}`);
  }

  console.log(
    `\n🏁 Session complete. Total sent today: ${dailyCount.value}/${DAILY_LIMIT}`,
  );
  try {
    await context.close();
  } catch {
    // already closed — nothing to do
  }
})();