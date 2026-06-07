const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    storageState: "linkedin-session.json",
  });

  const page = await context.newPage();

  await page.goto(
    "https://www.linkedin.com/mynetwork/invite-connect/connections/",
  );

  await page.waitForTimeout(5000);

  const messageLinks = page.locator('a[aria-label^="Send a message to"]');

  const count = await messageLinks.count();

  console.log(`Found ${count} message buttons`);

  for (let i = 0; i < Math.min(count, 10); i++) {
    const label = await messageLinks.nth(i).getAttribute("aria-label");

    console.log(i, label);
  }

  if (count > 0) {
    await messageLinks.first().click();
    console.log("Clicked first message button");
    await page
      .locator('[contenteditable="true"]')
      .first()
      .pressSequentially("Hello");
    await page.waitForTimeout(1000);
    const sendButton = page.getByRole("button", {
      name: "Send",
      exact: true,
    });

    await sendButton.waitFor({ state: "visible" });
    await sendButton.click();

    await page
      .getByRole("button", {
        name: /Close your conversation with/,
      })
      .click();
  }

  await page.waitForTimeout(10000);
})();
