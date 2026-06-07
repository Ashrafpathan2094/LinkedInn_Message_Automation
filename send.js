const { chromium } = require("playwright");
const fs = require("fs");

const MESSAGED_USERS_FILE = "messaged_users.json";

// ─── Message builder ──────────────────────────────────────────────────────────

function buildMessage(name, company) {
  const firstName = name.split(" ")[0]; // use first name only
  const companyLine = company
    ? `If there are any suitable openings at ${company}, I'd really appreciate a referral.`
    : `If there are any suitable openings at your company, I'd really appreciate a referral.`;

  return `Hi ${firstName},
Hope you're doing well. I'm currently looking for Full Stack Developer opportunities. ${companyLine}
I've attached my resume and here's the link: https://drive.google.com/file/d/1tf4mLHNT6mvEQ_ipLuHqx8vpdaqfUGxY/view
Thank you!`;
}

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

// ─── DOM helpers ─────────────────────────────────────────────────────────────

async function getMessageButtons(page) {
  return page.locator('a[aria-label^="Send a message to"]');
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

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
      const headlineEl = card.querySelector("span"); // first meaningful span in headline area
      // grab the deeper headline span (the one with job title text)
      const headlineSpans = card.querySelectorAll("p span");
      let headline = null;
      // the headline span is usually the longest one
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

    // ✅ profileUrl from DOM already has /in/... so don't prepend if it's already absolute
    const normalizedUrl = profileUrl
      ? profileUrl.startsWith("http")
        ? profileUrl.split("?")[0].replace(/\/$/, "")
        : "https://www.linkedin.com" +
          profileUrl.split("?")[0].replace(/\/$/, "")
      : null;

    // Extract company from headline — looks for @CompanyName pattern
    const companyMatch = headline?.match(/@([^|•\n]+)/);
    // fallback: try "at CompanyName" if no @ found
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
// ─── Scroll helpers ───────────────────────────────────────────────────────────

async function scrollDown(page) {
  await page.evaluate(() => window.scrollBy(0, 800));
  await page.waitForTimeout(2000);
}

async function getScrollHeight(page) {
  return page.evaluate(() => document.documentElement.scrollHeight);
}

// ─── Message action ───────────────────────────────────────────────────────────

async function clickMessageAndClose(page, buttonIndex, name, company) {
  const buttons = await getMessageButtons(page);
  await buttons.nth(buttonIndex).click();
  console.log(`  📨 Clicked message button`);

  await page.waitForTimeout(1500);

  const message = buildMessage(name, company);
  console.log(`  ✉️  Message preview:\n${message}\n`);

  await page
    .locator('[contenteditable="true"]')
    .first()
    .pressSequentially(message, { delay: 2 }); // delay avoids dropped chars

  await page.waitForTimeout(1000);

  const sendButton = page.getByRole("button", {
    name: "Send",
    exact: true,
  });
  await sendButton.waitFor({ state: "visible" });
  await sendButton.click();
  await page.waitForTimeout(1000);

const closeButton = page.getByRole("button", {
  name: /Close your (draft conversation|conversation with)/,
});

await closeButton.waitFor({ state: "visible" });
await closeButton.click();

  await page.waitForTimeout(1000);
}

// ─── Process a batch of visible buttons ──────────────────────────────────────

async function processVisibleButtons(page, processedUrls) {
  const buttonDataList = await collectButtonData(page);
  console.log(`\n🔍 Found ${buttonDataList.length} message buttons in view`);

  let newlyProcessed = 0;

  // ✅ destructure company and headline too
  for (const { name, profileUrl, headline, company, index } of buttonDataList) {
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

      await clickMessageAndClose(page, targetIndex, name, company);

      processedUrls.add(profileUrl);
      saveMessagedUser({
        name,
        profileUrl,
        company: company || null,
        headline: headline || null,
        messagedAt: new Date().toISOString(),
      });
      newlyProcessed++;
    } catch (err) {
      console.error(`  ❌ Error processing ${name}:`, err.message);
    }
  }

  return newlyProcessed;
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

  // Runtime set to avoid redundant file reads in same session
  const processedUrls = new Set(loadMessagedUsers().map((u) => u.profileUrl));

  let previousScrollHeight = 0;
  let noNewContentCount = 0;
  const MAX_NO_NEW_CONTENT = 3; // Stop after 3 scrolls with no new buttons

  while (true) {
    await processVisibleButtons(page, processedUrls);

    // Try scrolling for more
    const currentScrollHeight = await getScrollHeight(page);

    if (currentScrollHeight === previousScrollHeight) {
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
      previousScrollHeight = currentScrollHeight;
    }

    console.log("\n⬇️  Scrolling for more connections...");
    await scrollDown(page);
  }

  await browser.close();
})();
