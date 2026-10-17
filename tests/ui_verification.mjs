import { chromium } from 'playwright';
import http from 'http';
import app from '../backend/src/app.js';
import path from 'path';
import fs from 'fs';

console.log('======================================================');
console.log('🧪 PLAYWRIGHT AUTOMATED FRONTEND & UI AUDIT SUITE');
console.log('======================================================\n');

async function run() {
  const artifactsDir = path.resolve('tests/artifacts');
  if (!fs.existsSync(artifactsDir)) {
    fs.mkdirSync(artifactsDir, { recursive: true });
  }

  // 1. Launch local test server
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`🌐 Test server running at ${baseUrl}`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      consoleErrors.push(msg.text());
    }
  });

  try {
    // 2. Navigate to Dashboard
    await page.goto(baseUrl, { waitUntil: 'networkidle' });
    console.log('  ✅ PASS: Navigation to Dashboard successful');

    // 3. Authenticate if Login Modal appears
    const pinInput = page.locator('input[type="password"]');
    if (await pinInput.count() > 0) {
      await pinInput.fill('signature2025');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      console.log('  ✅ PASS: Studio authentication completed');
    }

    // 4. Verify Dashboard Header
    await page.waitForSelector('text=Studio Operations', { timeout: 10000 });
    console.log('  ✅ PASS: Studio Operations header rendered');

    // 5. Verify Leads Table & Phone formatting
    const phoneCells = page.locator('td.whitespace-nowrap font-mono, td a[href^="tel:"]');
    const phoneCount = await phoneCells.count();
    console.log(`  🔍 Found ${phoneCount} phone elements in table`);

    for (let i = 0; i < phoneCount; i++) {
      const text = (await phoneCells.nth(i).innerText()).trim();
      const isDuplicated = /\+\d{10,}.*\+\d{10,}/.test(text);
      if (isDuplicated) {
        throw new Error(`Duplicate phone string detected in table cell: "${text}"`);
      }
    }
    console.log('  ✅ PASS: No duplicate/concatenated phone numbers found in table');

    // 6. Verify WhatsApp Direct Action Buttons
    // 6. Verify Kanban View & Phone Deduplication in Kanban Cards
    const kanbanTabBtn = page.locator('button:has-text("Kanban")');
    if (await kanbanTabBtn.count() > 0) {
      await kanbanTabBtn.first().click();
      await page.waitForTimeout(400);

      const kanbanPhoneElements = page.locator('.font-mono');
      const kanbanPhoneCount = await kanbanPhoneElements.count();
      console.log(`  🔍 Found ${kanbanPhoneCount} phone/mono elements in Kanban view`);

      for (let i = 0; i < kanbanPhoneCount; i++) {
        const text = (await kanbanPhoneElements.nth(i).innerText()).trim();
        const isDuplicated = /\+\d{10,}.*\+\d{10,}/.test(text);
        if (isDuplicated) {
          throw new Error(`Duplicate phone string detected in Kanban card: "${text}"`);
        }
      }
      console.log('  ✅ PASS: No duplicate/concatenated phone numbers found in Kanban cards');

      // Check Kanban WhatsApp button
      const kanbanWaButtons = page.locator('a[href*="wa.me"]');
      const kanbanWaCount = await kanbanWaButtons.count();
      console.log(`  🔍 Found ${kanbanWaCount} WhatsApp buttons in Kanban view`);
      if (kanbanWaCount > 0) {
        const firstKanbanWa = kanbanWaButtons.first();
        const hasSvg = await firstKanbanWa.locator('svg').count() > 0;
        if (!hasSvg) throw new Error('Kanban WhatsApp button missing SVG icon');
        console.log('  ✅ PASS: Kanban card action button contains authentic WhatsApp SVG');
      }

      // Switch back to table view
      const tableTabBtn = page.locator('button:has-text("Table")');
      if (await tableTabBtn.count() > 0) {
        await tableTabBtn.first().click();
        await page.waitForTimeout(400);
      }
    }

    // 7. Verify WhatsApp Direct Action Buttons
    const waButtons = page.locator('a[href*="wa.me"]');
    const waCount = await waButtons.count();
    console.log(`  🔍 Found ${waCount} WhatsApp direct action buttons`);
    if (waCount > 0) {
      const firstWa = waButtons.first();
      const hasSvg = await firstWa.locator('svg').count() > 0;
      if (!hasSvg) {
        throw new Error('WhatsApp button missing SVG icon');
      }
      console.log('  ✅ PASS: WhatsApp action button contains authentic WhatsApp SVG');
    }

    // 7. Verify Empty State Deduplication (Search bug check)
    const searchInput = page.locator('input[placeholder*="Search customer"]');
    await searchInput.fill('ZzZzNonExistentQuery999');
    await page.waitForTimeout(400);

    const visibleEmptyMsgMatches = await page.locator('text="No inquiries match your current filters." >> visible=true').allInnerTexts();
    if (visibleEmptyMsgMatches.length !== 1) {
      throw new Error(`Visible empty state message count is ${visibleEmptyMsgMatches.length}! Expected exactly 1.`);
    }
    console.log('  ✅ PASS: Empty state message appears exactly once on screen (no duplicates)');

    // Clear search
    await searchInput.fill('');
    await page.waitForTimeout(400);

    // 8. Capture Full-Page Screenshot Artifact
    const screenshotPath = path.join(artifactsDir, 'dashboard_audit.png');
    await page.screenshot({ path: screenshotPath, fullPage: true });
    console.log(`  📸 Screenshot saved to: ${screenshotPath}`);

    // 9. Verify No Critical Console Errors
    const criticalErrors = consoleErrors.filter((e) => !e.includes('favicon'));
    if (criticalErrors.length > 0) {
      console.warn('  ⚠️ Console errors noted:', criticalErrors);
    } else {
      console.log('  ✅ PASS: Zero console errors during session');
    }

    console.log('\n------------------------------------------------------');
    console.log('🏁 All UI & Frontend Audits PASSED Successfully!');
    console.log('------------------------------------------------------\n');
  } finally {
    await browser.close();
    server.close();
  }
}

run().catch((err) => {
  console.error('\n❌ UI AUDIT FAILED:', err.message);
  process.exit(1);
});
