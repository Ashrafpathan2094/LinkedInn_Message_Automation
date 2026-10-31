const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

const GROW_URL = "https://www.linkedin.com/mynetwork/grow/";
// Tried in order — the second is only used if the first isn't on the page
const SECTION_TITLES = [
  "People you may know based on your recent activity",
  "Suggestions for you",
];
const COMPANY_COUNTS_FILE = "connected_companies.json";
const DAILY_COUNTS_FILE = "connections_per_day.json";
const MAX_PER_COMPANY = 3;
// LinkedIn's weekly invite limit (100, verified on our account). The run also
// stops as soon as LinkedIn shows its limit message.
const WEEKLY_LIMIT = 100;
const MAX_SECTION_SCROLLS = 12;
const MAX_NO_NEW_CONTENT = 3;
const MAX_FAILED_IN_A_ROW = 3;
const DRY_RUN = process.argv.includes("--dry-run");

// LinkedIn's toast: "Your invitation to <name> was not sent because you have
// reached the weekly limit for connection invitations. Please try again next week"
const LIMIT_POPUP_REGEX = /weekly limit|invitation limit/i;
const EMAIL_REQUIRED_REGEX =
  /enter (?:their|the member'?s) email|email to connect/i;
// LinkedIn's popups are native <dialog open> elements (no role attribute);
// role="dialog" covers the older UI
const DIALOG_SELECTOR = 'dialog[open], [role="dialog"]';

// ─── Headline filters ────────────────────────────────────────────────────────
// Terms match as whole words, case-insensitive: "HR" won't match "Shriram" and
// "TA" won't match "Data". A space inside a term also matches "-", "_" or no
// space, so "talent acquisition" catches "#TalentAcquisition" too.
// Add your own terms anywhere in the list, e.g. "software development".

const HEADLINE_KEYWORDS = [
  // Talent acquisition
  "talent acquisition",
  "TA", // also short for "Teaching Assistant" on some student profiles
  "talent partner",
  "talent advisor",
  "talent specialist",
  "talent consultant",
  "talent sourcer",
  "talent sourcing",
  "talent scout",
  "talent hunter",
  "talent researcher",
  "talent lead",
  "talent team",
  "talent manager",
  "talent management",
  "head of talent",
  "connecting talent",

  // Recruiting & staffing
  "recruiter",
  "recruiters",
  "recruiting",
  "recruitment",
  "recruit",
  "sourcer",
  "head hunter",
  "head hunting",
  "executive search",
  "staffing",
  "manpower",
  "placement",
  "placements",
  "RPO",
  "bench sales",

  // Also catches hiring managers and founders who put "#hiring" in a headline
  "hiring",

  // HR
  "HR",
  "human resources",
  "human resource",
  "HRBP",
  "HRIS",
  "HRMS",
  "HRM",
  "HRD",
  "HRO",
  "CHRO",
  "chief people officer",
  "head of people",
  "vp people",
  "vp of people",
  "people operations",
  "people ops",
  "people partner",
  "people business partner",
  "people and culture",
  "people & culture",
  "people team",
  "people experience",
  "people analytics",
  "employee experience",
  "employee relations",
  "employee engagement",
  "employer brand",
  "employer branding",
  "human capital",
  "personnel",
  "workforce planning",
  "industrial relations",
  "organizational development",
  "organisational development",
  "global mobility",

  // HR specialisms
  "total rewards",
  "compensation and benefits",
  "compensation & benefits",
  "C&B",
  "payroll",
  "learning and development",
  "learning & development",
  "L&D",
  "DEI",
  "DEIB",
  "diversity and inclusion",
  "diversity & inclusion",
];

// Headlines with these belong to people who aren't working in HR yet
const EXCLUDE_KEYWORDS = ["aspiring", "open to work"];

// ─── File helpers ────────────────────────────────────────────────────────────

// Both files hold a plain { key: count } object, loaded once at startup.
// Missing files are created right away (like send.js) except on a dry run.
function loadCounts(file) {
  if (!fs.existsSync(file)) {
    if (!DRY_RUN) saveCounts(file, {});
    return {};
  }
  try {
    const content = fs.readFileSync(file, "utf-8").trim();
    const counts = content ? JSON.parse(content) : {};
    if (!counts || typeof counts !== "object" || Array.isArray(counts)) {
      throw new Error("not an object");
    }
    return counts;
  } catch {
    console.warn(`⚠️  ${file} was corrupted, starting from empty counts...`);
    return {};
  }
}

function saveCounts(file, counts) {
  fs.writeFileSync(file, JSON.stringify(counts, null, 2));
}

function dayKey(daysAgo = 0) {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

// LinkedIn's limit is weekly, so add up today and the 6 days before it
function countSentThisWeek(dailyCounts) {
  let total = 0;
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    total += dailyCounts[dayKey(daysAgo)] || 0;
  }
  return total;
}

// ✅ Update the in-memory counts first, then write both files (not on a dry run)
function recordInvite(company, counts) {
  if (company) {
    counts.companies[company] = (counts.companies[company] || 0) + 1;
  }
  const today = dayKey();
  counts.daily[today] = (counts.daily[today] || 0) + 1;

  if (DRY_RUN) return;
  saveCounts(COMPANY_COUNTS_FILE, counts.companies);
  saveCounts(DAILY_COUNTS_FILE, counts.daily);
}

// ─── Headline helpers ────────────────────────────────────────────────────────

function escapeRegex(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termRegex(term) {
  const pattern = escapeRegex(term.trim()).replace(/\s+/g, "[\\s\\-_]*");
  return new RegExp(`(?<![a-z0-9])${pattern}(?![a-z0-9])`, "i");
}

// First term from the list that appears in the text, or null
function findKeyword(text, terms) {
  if (!text) return null;
  return terms.find((term) => termRegex(term).test(text)) || null;
}

// Same rule send.js uses: text after "@" or "at", up to "|", "•" or newline
function extractCompany(headline) {
  const atSign = headline?.match(/@([^|•\n]+)/);
  const atWord = headline?.match(/\bat\s+([^|•\n]+)/i);
  return (atSign?.[1] || atWord?.[1] || "").trim() || null;
}

// Card lines that are never the headline
const CARD_NOISE = [
  /^(connect|follow|following|message|pending|dismiss|withdraw)$/i,
  /mutual connections?/i,
  /^followed by/i,
  /^·?\s*(1st|2nd|3rd\+?)(\s+degree.*)?$/i,
  /^verified$/i,
  /^status is /i,
  /^\(?(he|she|they)\s*\/\s*\w+\)?$/i,
  /\bfollowers?$/i,
];

// The headline is the first real line under the name. If the name can't be
// found, fall back to the longest line (same idea as send.js).
function pickHeadline(lines, name) {
  const lowerName = (name || "").toLowerCase();
  const isName = (line) =>
    Boolean(lowerName) && line.toLowerCase().startsWith(lowerName);
  const useful = lines.filter(
    (line) => !CARD_NOISE.some((re) => re.test(line)),
  );

  const nameIndex = useful.findIndex(isName);
  if (nameIndex !== -1) {
    const next = useful.slice(nameIndex + 1).find((line) => !isName(line));
    if (next) return next;
  }
  return (
    useful
      .filter((line) => !isName(line))
      .sort((a, b) => b.length - a.length)[0] || null
  );
}

// ─── Who gets an invite ──────────────────────────────────────────────────────

/**
 * Decides whether one person from the list gets an invite.
 *
 * @param {string|null} headline  e.g. "Talent Acquisition at Acme | Hiring"
 * @param {string|null} company   parsed from the headline, null if none found
 * @param {Object<string, number>} companyCounts  invites sent so far, per company
 * @returns {{ connect: boolean, reason: string }}  reason is printed in the log
 */
function decideConnection(headline, company, companyCounts) {
  const keyword = findKeyword(headline, HEADLINE_KEYWORDS);
  if (!keyword) return { connect: false, reason: "no HR keyword in headline" };

  const excluded = findKeyword(headline, EXCLUDE_KEYWORDS);
  if (excluded) {
    return { connect: false, reason: `headline says "${excluded}"` };
  }

  // no company in the headline → still connect, it just isn't counted
  if (company && (companyCounts[company] || 0) >= MAX_PER_COMPANY) {
    return {
      connect: false,
      reason: `already ${MAX_PER_COMPANY} invites at ${company}`,
    };
  }

  return { connect: true, reason: `matched "${keyword}"` };
}

// ─── DOM helpers ─────────────────────────────────────────────────────────────

async function getScrollTop(page) {
  return page.evaluate(
    () =>
      (document.querySelector("main#workspace")?.scrollTop || 0) +
      window.scrollY,
  );
}

// Returns false when the page didn't move (already at the bottom)
async function scrollPage(page) {
  const before = await getScrollTop(page);
  await page.evaluate(() => {
    const main = document.querySelector("main#workspace");
    if (main) main.scrollBy({ top: 900, behavior: "smooth" });
    window.scrollBy({ top: 900, behavior: "smooth" });
  });
  await page.waitForTimeout(2000);
  return (await getScrollTop(page)) !== before;
}

async function scrollToTop(page) {
  await page.evaluate(() => {
    document.querySelector("main#workspace")?.scrollTo({ top: 0 });
    window.scrollTo({ top: 0 });
  });
  await page.waitForTimeout(1000);
}

/**
 * Scrolls the Grow page until the section called `title` shows up. If the
 * section has a "Show all", clicks it and returns "dialog" (list opens in a
 * popup) or "page" (LinkedIn navigates instead). If it has no "Show all" but
 * lists people right on the page (like "Suggestions for you"), marks it and
 * returns "section". Returns null when the section can't be used.
 */
async function openSectionList(page, title) {
  const titleRegex = new RegExp(`^\\s*${escapeRegex(title)}\\s*$`, "i");
  let stuckCount = 0;

  for (let attempt = 1; attempt <= MAX_SECTION_SCROLLS; attempt++) {
    const heading = page.getByText(titleRegex).filter({ visible: true }).first();

    const kind =
      (await heading.count()) > 0 &&
      (await heading.evaluate((el) => {
        const headingSelector = 'h1, h2, h3, h4, h5, h6, [role="heading"]';
        const isShowAll = (node) =>
          /show all/i.test(
            `${node.innerText || ""} ${node.getAttribute("aria-label") || ""}`,
          );
        const isConnectButton = (button) =>
          /^invite .+ to connect$/i.test(button.getAttribute("aria-label") || "") ||
          /^connect$/i.test((button.innerText || "").trim());
        const ownHeading = el.closest(headingSelector) || el;
        document
          .querySelectorAll("[data-auto-connect]")
          .forEach((node) => node.removeAttribute("data-auto-connect"));

        // the section is the smallest container around the title that holds
        // a "Show all" or people with a Connect button
        for (let node = ownHeading.parentElement; node && node !== document.body; node = node.parentElement) {
          const controls = [...node.querySelectorAll('button, a, [role="button"]')];
          const showAll = controls.find(isShowAll);
          if (!showAll && !controls.some(isConnectButton)) continue;

          // another heading inside means we climbed into a parent of several
          // sections — its "Show all" or people belong to someone else
          const otherHeadings = [...node.querySelectorAll(headingSelector)].filter(
            (h) => h !== ownHeading && !h.contains(ownHeading) && !ownHeading.contains(h),
          );
          if (otherHeadings.length > 0) return null;

          if (showAll) {
            showAll.setAttribute("data-auto-connect", "show-all");
            return "show-all";
          }
          node.setAttribute("data-auto-connect", "section");
          return "section";
        }
        return null;
      }));

    if (kind === "section") {
      console.log(`📋 "${title}" has no "Show all" — using its list on the page`);
      return "section";
    }

    if (kind === "show-all") {
      const urlBefore = page.url();
      const showAll = page.locator('[data-auto-connect="show-all"]').first();
      await showAll.scrollIntoViewIfNeeded();
      await showAll.click();
      console.log(`👆 Clicked "Show all" on "${title}"`);

      const dialogOpened = await page
        .locator(DIALOG_SELECTOR)
        .locator('a[href*="/in/"]')
        .first()
        .waitFor({ state: "visible", timeout: 15000 })
        .then(() => true)
        .catch(() => false);
      if (dialogOpened) return "dialog";
      return page.url() !== urlBefore ? "page" : null;
    }

    console.log(
      `⬇️  Looking for "${title}"... (${attempt}/${MAX_SECTION_SCROLLS})`,
    );
    stuckCount = (await scrollPage(page)) ? 0 : stuckCount + 1;
    if (stuckCount >= 2) break; // bottom of the page — the section isn't here
  }
  return null;
}

/**
 * Reads every card in the list that still shows a Connect button, or returns
 * null if the list is gone. Each Connect button gets a data-auto-connect-id
 * so sendInvite() can click exactly that one later.
 */
async function collectCards(page, listMode) {
  return page.evaluate(({ listMode, dialogSelector }) => {
    const isConnectButton = (button) =>
      /^invite .+ to connect$/i.test(button.getAttribute("aria-label") || "") ||
      /^connect$/i.test((button.innerText || "").trim());

    let listRoot;
    if (listMode === "dialog") {
      // the popup holding the list is the dialog with the most profile links
      listRoot = [...document.querySelectorAll(dialogSelector)]
        .map((dialog) => ({
          dialog,
          links: dialog.querySelectorAll('a[href*="/in/"]').length,
        }))
        .filter(({ links }) => links > 0)
        .sort((a, b) => b.links - a.links)[0]?.dialog;
    } else if (listMode === "section") {
      listRoot = document.querySelector('[data-auto-connect="section"]');
    } else {
      listRoot = document.querySelector("main") || document.body;
    }
    if (!listRoot) return null;

    window.__autoConnectSeq = window.__autoConnectSeq || 0;
    const cards = [];

    for (const button of listRoot.querySelectorAll("button")) {
      if (!isConnectButton(button)) continue;

      // smallest container around the button that also has a profile link
      let card = button.parentElement;
      while (
        card &&
        card !== listRoot &&
        !card.querySelector('a[href*="/in/"]')
      ) {
        card = card.parentElement;
      }
      if (!card || card === listRoot) continue;
      // more than one Connect button means we climbed past a single card
      const connectButtons = [...card.querySelectorAll("button")].filter(
        isConnectButton,
      );
      if (connectButtons.length > 1) continue;

      if (!button.dataset.autoConnectId) {
        button.dataset.autoConnectId = String(++window.__autoConnectSeq);
      }

      const label = button.getAttribute("aria-label") || "";
      const name = label.match(/^invite (.+) to connect$/i)?.[1]?.trim() || null;
      const links = [...card.querySelectorAll('a[href*="/in/"]')];
      const profileLink =
        links.find((a) => name && a.innerText.includes(name)) || links[0];

      cards.push({
        id: button.dataset.autoConnectId,
        name,
        profileUrl: profileLink.href.split("?")[0].replace(/\/$/, ""),
        lines: card.innerText
          .split("\n")
          .map((line) => line.trim())
          .filter(Boolean),
      });
    }
    return cards;
  }, { listMode, dialogSelector: DIALOG_SELECTOR });
}

// Text of every popup and toast on screen, except the "Show all" list itself
// (so a headline can never look like a LinkedIn warning)
async function getPopupText(page) {
  return page.evaluate(
    (dialogSelector) =>
      [
        ...document.querySelectorAll(
          `${dialogSelector}, [role="alertdialog"], [role="alert"], [aria-live], .artdeco-modal, .artdeco-toast-item`,
        ),
      ]
        .filter((el) => !el.querySelector("[data-auto-connect-id]"))
        .map((el) => el.innerText || "")
        .join("\n"),
    DIALOG_SELECTOR,
  );
}

// Closes popups on top of the list (note prompt, email prompt...), never the
// list itself
async function closeExtraDialogs(page) {
  const extras = page
    .locator(DIALOG_SELECTOR)
    .filter({ hasNot: page.locator("[data-auto-connect-id]") })
    .filter({ visible: true });

  for (let i = (await extras.count()) - 1; i >= 0; i--) {
    const closeButton = extras
      .nth(i)
      .locator('button[aria-label*="dismiss" i], button[aria-label*="close" i]')
      .first();
    if (await closeButton.isVisible()) {
      await closeButton.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(500);
    }
  }
}

// Scrolls the open list so LinkedIn loads more people
async function scrollList(page, listMode) {
  const lastCard = page.locator("[data-auto-connect-id]").last();
  if ((await lastCard.count()) > 0) {
    await lastCard.scrollIntoViewIfNeeded().catch(() => {});
  }

  await page.evaluate(({ listMode, dialogSelector }) => {
    if (listMode === "dialog") {
      const dialog = [...document.querySelectorAll(dialogSelector)].find(
        (d) => d.querySelector("[data-auto-connect-id]"),
      );
      if (!dialog) return;
      // the list scrolls inside the popup, not the page
      for (const el of [dialog, ...dialog.querySelectorAll("*")]) {
        const { overflowY } = getComputedStyle(el);
        if (
          el.scrollHeight > el.clientHeight + 20 &&
          /(auto|scroll)/.test(overflowY)
        ) {
          el.scrollBy({ top: 1200, behavior: "smooth" });
        }
      }
      return;
    }
    const main = document.querySelector("main#workspace");
    if (main) main.scrollBy({ top: 1200, behavior: "smooth" });
    window.scrollBy({ top: 1200, behavior: "smooth" });
  }, { listMode, dialogSelector: DIALOG_SELECTOR });

  // some lists load more with a button instead of on scroll — only look inside
  // the list, buttons on the page behind the popup can't be clicked
  const listRoots = {
    dialog: page
      .locator(DIALOG_SELECTOR)
      .filter({ has: page.locator("[data-auto-connect-id]") }),
    section: page.locator('[data-auto-connect="section"]'),
    page: page.locator("main"),
  };
  const loadMore = listRoots[listMode]
    .first()
    .getByRole("button", { name: /^(show more|load more)/i })
    .filter({ visible: true })
    .first();
  if ((await loadMore.count()) > 0) {
    await loadMore.click({ timeout: 5000 }).catch(() => {});
    console.log('  👆 Clicked "Show more"');
  }

  await page.waitForTimeout(3500);
}

// ─── Invite action ────────────────────────────────────────────────────────────

/**
 * Clicks Connect on one card, then handles whatever LinkedIn shows next.
 * Returns "sent", "unconfirmed", "limit", "email_required" or "missing".
 */
async function sendInvite(page, card) {
  // LinkedIn's refusal can arrive after the previous invite's checks — a limit
  // toast still on screen means stop before clicking again
  if (LIMIT_POPUP_REGEX.test(await getPopupText(page))) return "limit";

  const button = page.locator(`[data-auto-connect-id="${card.id}"]`);
  if ((await button.count()) === 0) return "missing";

  await button.scrollIntoViewIfNeeded();
  await button.click({ timeout: 10000 });
  console.log("  🤝 Clicked Connect");
  await page.waitForTimeout(1500);

  if (LIMIT_POPUP_REGEX.test(await getPopupText(page))) return "limit";

  // some invites first ask "Add a note to your invitation?"
  const sendWithoutNote = page
    .getByRole("button", { name: /send without a note/i })
    .first();
  if (await sendWithoutNote.isVisible()) {
    await sendWithoutNote.click({ timeout: 10000 });
    console.log("  📨 Sent without a note");
    await page.waitForTimeout(1500);
    if (LIMIT_POPUP_REGEX.test(await getPopupText(page))) return "limit";
  }

  if (EMAIL_REQUIRED_REGEX.test(await getPopupText(page))) {
    await closeExtraDialogs(page);
    return "email_required";
  }
  await closeExtraDialogs(page);

  // the card is often swapped for a new suggestion once the invite is sent
  if ((await button.count()) === 0) return "sent";
  const buttonText = await button.evaluate(
    (el) => `${el.innerText} ${el.getAttribute("aria-label") || ""}`,
  );
  return /\b(pending|withdraw|invited|sent)\b/i.test(buttonText)
    ? "sent"
    : "unconfirmed";
}

// 2s, then a random 2–5s more (4–7s in total)
async function waitBetweenConnections(page) {
  const extraSeconds = 2 + Math.floor(Math.random() * 4);
  console.log(`  ⏳ Waiting 2s + ${extraSeconds}s = ${2 + extraSeconds}s`);
  await page.waitForTimeout(2000);
  await page.waitForTimeout(extraSeconds * 1000);
}

// ─── Process the cards in view ───────────────────────────────────────────────

// Returns a reason string when the run should stop, otherwise null
async function processVisibleCards(page, listMode, seen, counts, stats) {
  const rawCards = await collectCards(page, listMode);
  if (!rawCards) return "the list is no longer on the page";

  const cards = rawCards.map((card) => {
    const name = card.name || card.lines[0] || "Unknown";
    return { ...card, name, headline: pickHeadline(card.lines, name) };
  });
  const fresh = cards.filter((card) => !seen.has(card.profileUrl));
  console.log(
    `\n🔍 Found ${cards.length} Connect buttons in view (${fresh.length} new)`,
  );

  for (const card of fresh) {
    seen.add(card.profileUrl);

    if (stats.weekly >= WEEKLY_LIMIT) {
      return `weekly cap of ${WEEKLY_LIMIT} invites reached`;
    }

    const company = extractCompany(card.headline);
    const { connect, reason } = decideConnection(
      card.headline,
      company,
      counts.companies,
    );
    if (!connect) {
      stats.skipped++;
      console.log(`  ⏭️  Skipped ${card.name} — ${reason}`);
      continue;
    }

    console.log(`\n➡️  Connecting: ${card.name} (${card.profileUrl})`);
    console.log(`  📝 Headline: ${card.headline}`);
    console.log(`  🏢 Company: ${company || "unknown"}`);
    console.log(`  ✅ ${reason}`);

    let status = "dry_run";
    if (!DRY_RUN) {
      try {
        status = await sendInvite(page, card);
      } catch (err) {
        const isPageClosed =
          /Target page, context or browser has been closed/i.test(
            err.message || "",
          );
        if (isPageClosed) throw err; // stop instead of looping on a dead page
        console.error(`  ❌ Error connecting with ${card.name}:`, err.message);
        await closeExtraDialogs(page).catch(() => {});
        status = "error";
      }
    }

    if (status === "limit") {
      return "LinkedIn showed its invitation limit popup";
    }
    if (status === "missing") {
      seen.delete(card.profileUrl); // re-rendered — retry on the next pass
      console.log(`  ⚠️  Connect button for ${card.name} went away, will retry`);
      continue;
    }

    if (status === "email_required") {
      stats.skipped++;
      console.log(
        `  ✉️  ${card.name} only accepts invites that include their email — skipped`,
      );
    } else if (status === "error") {
      console.log(`  ⚠️  Invite not saved for ${card.name}`);
    } else {
      // "unconfirmed" still counts — better to undercount what's left this week
      recordInvite(company, counts);
      stats.sent++;
      stats.weekly++;
      if (status === "unconfirmed") {
        console.log(
          "  ⚠️  Couldn't confirm the invite went through (button didn't change to Pending)",
        );
      }
      const companyCount = company
        ? `${company}: ${counts.companies[company]}/${MAX_PER_COMPANY}`
        : "no company";
      console.log(
        `  💾 ${DRY_RUN ? "Dry run, would send" : "Invite saved"} | ${companyCount} | Last 7 days: ${stats.weekly}/${WEEKLY_LIMIT}`,
      );
    }

    const failed = status === "unconfirmed" || status === "error";
    stats.failedInARow = failed ? stats.failedInARow + 1 : 0;
    if (stats.failedInARow >= MAX_FAILED_IN_A_ROW) {
      return `${MAX_FAILED_IN_A_ROW} invites in a row didn't go through — LinkedIn may be limiting invites, check the browser`;
    }

    if (!DRY_RUN) await waitBetweenConnections(page);
  }

  return null;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

(async () => {
  // ✅ Load both count files once — every check after this is in memory
  const counts = {
    companies: loadCounts(COMPANY_COUNTS_FILE),
    daily: loadCounts(DAILY_COUNTS_FILE),
  };
  const stats = {
    sent: 0,
    skipped: 0,
    failedInARow: 0,
    weekly: countSentThisWeek(counts.daily),
  };

  console.log(
    `\n📦 Loaded invite counts for ${Object.keys(counts.companies).length} companies`,
  );
  console.log(`📅 Invites sent in the last 7 days: ${stats.weekly}/${WEEKLY_LIMIT}`);
  if (DRY_RUN) {
    console.log("🧪 Dry run — no invites are sent and nothing is saved");
  }

  if (stats.weekly >= WEEKLY_LIMIT) {
    console.log("🛑 Weekly cap already reached. Try again in a few days!");
    return;
  }

  const PROFILE_DIR = path.join(__dirname, "chrome-profile");

  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    // viewport:null keeps the maximized window size (see send.js)
    args: ["--start-maximized"],
    viewport: null,
  });

  const page = await context.newPage();

  try {
    await page.goto(GROW_URL, { waitUntil: "load" });
    if (/linkedin\.com\/(login|authwall|checkpoint|uas)/.test(page.url())) {
      throw new Error("Not logged in — run `node login.js` first");
    }
    console.log("✅ Grow page loaded — looking for the section.");

    let listMode = null;
    for (const title of SECTION_TITLES) {
      listMode = await openSectionList(page, title);
      if (listMode) break;
      console.log(`⚠️  Couldn't find or open "${title}"`);
      await scrollToTop(page);
    }
    if (!listMode) {
      throw new Error(`None of these sections opened: ${SECTION_TITLES.join(", ")}`);
    }
    await page.waitForTimeout(2000);

    const seen = new Set();
    let noNewContentCount = 0;

    while (true) {
      const seenBefore = seen.size;
      const stopReason = await processVisibleCards(
        page,
        listMode,
        seen,
        counts,
        stats,
      );
      if (stopReason) {
        console.log(`\n🛑 Stopping: ${stopReason}`);
        break;
      }

      if (seen.size === seenBefore) {
        noNewContentCount++;
        console.log(
          `\n📏 No new people after scroll (${noNewContentCount}/${MAX_NO_NEW_CONTENT})`,
        );
        if (noNewContentCount >= MAX_NO_NEW_CONTENT) {
          console.log("\n✅ Reached the end of the list. Done!");
          break;
        }
      } else {
        noNewContentCount = 0;
      }

      console.log("\n⬇️  Scrolling for more people...");
      await scrollList(page, listMode);
    }
  } catch (err) {
    console.error(`\n🛑 Stopped early due to error: ${err.message}`);
  }

  console.log(
    `\n🏁 Session complete. ${DRY_RUN ? "Would send" : "Sent"}: ${stats.sent} | Skipped: ${stats.skipped} | Last 7 days: ${stats.weekly}/${WEEKLY_LIMIT}`,
  );
  try {
    await context.close();
  } catch {
    // already closed — nothing to do
  }
})();
