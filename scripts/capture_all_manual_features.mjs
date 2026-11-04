import { testCredentials } from '../backend/tests/test-env.mjs';
import { chromium } from 'playwright';
import http from 'http';
import app from '../backend/src/app.js';
import path from 'path';
import fs from 'fs';

const targetDir = 'C:\\Users\\USER\\.gemini\\antigravity\\brain\\f3a7324c-cae0-48fb-8179-d47930c5e539\\screenshots';
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

async function run() {
  console.log('🚀 Starting Comprehensive Feature Visual Capture...');
  const browser = await chromium.launch({ headless: true });

  // 1. Capture Landing Page Features
  console.log('📸 [1/2] Capturing Live Landing Page Features...');
  const landingContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const landingPage = await landingContext.newPage();

  try {
    await landingPage.goto('https://signature-detailing.pages.dev/', { waitUntil: 'networkidle', timeout: 30000 });
    await landingPage.waitForTimeout(1000);

    // 1.1 Hero Section
    await landingPage.screenshot({ path: path.join(targetDir, '01_landing_hero.png'), clip: { x: 0, y: 0, width: 1440, height: 850 } });
    console.log('  ✔ Captured 01_landing_hero.png');

    // 1.2 Services Grid
    const servicesEl = landingPage.locator('#services');
    if (await servicesEl.count() > 0) {
      await servicesEl.scrollIntoViewIfNeeded();
      await landingPage.waitForTimeout(600);
      await landingPage.screenshot({ path: path.join(targetDir, '02_landing_services.png') });
      console.log('  ✔ Captured 02_landing_services.png');
    }

    // 1.3 Free Protection Consultation Form
    const consultationEl = landingPage.locator('#consultation');
    if (await consultationEl.count() > 0) {
      await consultationEl.scrollIntoViewIfNeeded();
      await landingPage.waitForTimeout(600);
      await landingPage.screenshot({ path: path.join(targetDir, '03_landing_consultation_form.png') });
      console.log('  ✔ Captured 03_landing_consultation_form.png');
    }

    // 1.4 Why PPF & Real Results
    const whyPpfEl = landingPage.locator('#why-ppf, text=WHY PAINT PROTECTION FILM');
    if (await whyPpfEl.count() > 0) {
      await whyPpfEl.first().scrollIntoViewIfNeeded();
      await landingPage.waitForTimeout(600);
      await landingPage.screenshot({ path: path.join(targetDir, '04_landing_why_ppf.png') });
      console.log('  ✔ Captured 04_landing_why_ppf.png');
    }
  } catch (err) {
    console.warn('⚠️ Landing page capture note:', err.message);
  } finally {
    await landingContext.close();
  }

  // 2. Capture Live CRM Dashboard Features
  console.log('📸 [2/2] Capturing CRM Dashboard & Bot Management Features...');
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;

  const crmContext = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const crmPage = await crmContext.newPage();

  try {
    await crmPage.goto(baseUrl, { waitUntil: 'networkidle', timeout: 30000 });

    // Handle Login Modal
    const pinInput = crmPage.locator('input[type="password"]');
    if (await pinInput.count() > 0) {
      await pinInput.fill(testCredentials.studioPasscode);
      await crmPage.keyboard.press('Enter');
      await crmPage.waitForTimeout(800);
    }

    await crmPage.waitForSelector('text=Studio Operations', { timeout: 10000 });

    // 2.1 Table View
    await crmPage.screenshot({ path: path.join(targetDir, '05_crm_table_view.png') });
    console.log('  ✔ Captured 05_crm_table_view.png');

    // 2.2 Kanban Board View
    const kanbanBtn = crmPage.locator('button:has-text("Kanban")').first();
    if (await kanbanBtn.count() > 0) {
      await kanbanBtn.click();
      await crmPage.waitForTimeout(600);
      await crmPage.screenshot({ path: path.join(targetDir, '06_crm_kanban_view.png') });
      console.log('  ✔ Captured 06_crm_kanban_view.png');
    }

    // 2.3 Lead Detail Modal
    const leadRows = crmPage.locator('tbody tr');
    // Switch back to table to open modal reliably
    const tableBtn = crmPage.locator('button:has-text("Table")').first();
    if (await tableBtn.count() > 0) {
      await tableBtn.click();
      await crmPage.waitForTimeout(400);
    }
    if (await leadRows.count() > 0) {
      await leadRows.first().click();
      await crmPage.waitForTimeout(700);
      await crmPage.screenshot({ path: path.join(targetDir, '07_crm_lead_detail_modal.png') });
      console.log('  ✔ Captured 07_crm_lead_detail_modal.png');
      await crmPage.keyboard.press('Escape');
      await crmPage.waitForTimeout(400);
    }

    // 2.4 Quick Lead Modal (+ Add button in TopBar)
    const addBtn = crmPage.locator('button:has-text("Add")').first();
    if (await addBtn.count() > 0) {
      await addBtn.click();
      await crmPage.waitForTimeout(600);
      await crmPage.screenshot({ path: path.join(targetDir, '08_crm_new_lead_modal.png') });
      console.log('  ✔ Captured 08_crm_new_lead_modal.png');
      await crmPage.keyboard.press('Escape');
      await crmPage.waitForTimeout(400);
    }

    // 2.5 Services Management View
    const servicesNav = crmPage.locator('button:has-text("Services"), a:has-text("Services")').first();
    if (await servicesNav.count() > 0) {
      await servicesNav.click();
      await crmPage.waitForTimeout(600);
      await crmPage.screenshot({ path: path.join(targetDir, '09_crm_services_management.png') });
      console.log('  ✔ Captured 09_crm_services_management.png');
    }

    // 2.6 Studio Settings View
    const settingsNav = crmPage.locator('button:has-text("Settings"), a:has-text("Settings")').first();
    if (await settingsNav.count() > 0) {
      await settingsNav.click();
      await crmPage.waitForTimeout(600);
      await crmPage.screenshot({ path: path.join(targetDir, '10_crm_studio_settings.png') });
      console.log('  ✔ Captured 10_crm_studio_settings.png');
    }

  } catch (err) {
    console.error('❌ CRM capture error:', err.message);
  } finally {
    await crmContext.close();
    await browser.close();
    server.close();
  }

  console.log('🎉 All feature visual artifacts saved successfully!');
}

run().catch(console.error);
