const { chromium } = require("playwright");
const path = require("path");

const LINKEDIN_EMAIL = "";
const LINKEDIN_PASSWORD = "";

const PROFILE_DIR = path.join(__dirname, "chrome-profile"); // persisted profile folder

(async () => {
  const context = await chromium.launchPersistentContext(PROFILE_DIR, {
    headless: false,
    slowMo: 200, // only in login.js
    args: ["--start-maximized"],
    viewport: null,
  });

  const page = await context.newPage();

  async function getVisibleLocator(locator) {
    const count = await locator.count();

    for (let i = 0; i < count; i++) {
      const element = locator.nth(i);

      try {
        if (await element.isVisible()) {
          return element;
        }
      } catch {}
    }

    return null;
  }

  async function saveSession() {
    await context.storageState({
      path: "linkedin-session.json",
    });

    console.log("Session saved -> linkedin-session.json");
  }

  try {
    await page.goto("https://www.linkedin.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    console.log("Current URL:", page.url());
    console.log("Page Title:", await page.title());

    const hasCredentials = LINKEDIN_EMAIL?.trim() && LINKEDIN_PASSWORD?.trim();

    if (hasCredentials) {
      try {
        console.log("Searching for login form...");

        await page.waitForTimeout(3000);

        const emailInput = await getVisibleLocator(
          page.locator('input[type="email"]'),
        );

        const passwordInput = await getVisibleLocator(
          page.locator('input[type="password"]'),
        );

        if (!emailInput) {
          throw new Error("Visible email field not found");
        }

        if (!passwordInput) {
          throw new Error("Visible password field not found");
        }

        console.log("Login form found");

        await emailInput.click();
        await emailInput.fill("");

        await emailInput.type(LINKEDIN_EMAIL, {
          delay: 30,
        });

        await passwordInput.click();
        await passwordInput.fill("");

        await passwordInput.type(LINKEDIN_PASSWORD, {
          delay: 30,
        });

        console.log("Credentials entered");

        console.log("Submitting form using ENTER...");

        await passwordInput.press("Enter");

        try {
          await page.waitForURL(
            (url) =>
              url.href.includes("/feed") ||
              url.href.includes("/checkpoint") ||
              url.href.includes("/challenge") ||
              url.href.includes("/in/"),
            {
              timeout: 30000,
            },
          );

          console.log("After login URL:");
          console.log(page.url());

          if (page.url().includes("/feed") || page.url().includes("/in/")) {
            console.log("Login successful");

            await saveSession();

            await context.close();
            process.exit(0);
          }

          console.log("LinkedIn requires verification (OTP/Captcha/MFA)");
        } catch (err) {
          console.log("Could not verify automatic login.");
          console.log(err.message);
        }
      } catch (err) {
        console.log("Auto login failed:");
        console.log(err.message);
      }
    }

    console.log("");
    console.log("================================");
    console.log("MANUAL LOGIN FALLBACK");
    console.log("================================");
    console.log("1. Login manually");
    console.log("2. Reach LinkedIn Feed");
    console.log("3. Press ENTER here");
    console.log("================================");
    console.log("");

    process.stdin.resume();

    process.stdin.once("data", async () => {
      try {
        console.log("Current URL:");
        console.log(page.url());

        await saveSession();

        console.log("Manual session saved");
      } catch (err) {
        console.error(err);
      }

      await context.close();
      process.exit(0);
    });
  } catch (err) {
    console.error("Fatal Error:");
    console.error(err);

    console.log("Manual login fallback enabled.");

    process.stdin.resume();

    process.stdin.once("data", async () => {
      try {
        await saveSession();
      } catch (err) {
        console.error(err);
      }

      await context.close();
      process.exit(0);
    });
  }
})();
