import { testCredentials } from '../backend/tests/test-env.mjs';
import { chromium } from 'playwright';
import http from 'http';
import app from '../backend/src/app.js';
import path from 'path';

const screenshotPath = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\f3a7324c-cae0-48fb-8179-d47930c5e539\\fixed_inbox_view.png';

async function run() {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  try {
    await page.goto(baseUrl, { waitUntil: 'networkidle' });

    // Handle Login Modal
    const pinInput = page.locator('input[type="password"]');
    if (await pinInput.count() > 0) {
      await pinInput.fill(testCredentials.studioPasscode);
      await page.keyboard.press('Enter');
      await page.waitForTimeout(800);
    }

    // Click on Inbox nav
    const inboxNav = page.locator('button:has-text("Inbox"), a:has-text("Inbox")').first();
    if (await inboxNav.count() > 0) {
      await inboxNav.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: screenshotPath });
      console.log('📸 Fixed Inbox screenshot captured successfully!');
    }
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch(console.error);
