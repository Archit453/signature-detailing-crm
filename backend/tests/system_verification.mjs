import { testCredentials } from './test-env.mjs';
import http from 'http';
import app from '../src/app.js';
import { validateAndFormatPhone } from '../src/utils/phoneValidator.js';
import { processBotMessage, buildInstagramServicesCarousel, getBotDisclaimer, withBotDisclaimer } from '../src/services/bot.service.js';
import { handleIncomingInstagramComment } from '../src/services/instagram.service.js';
import { createLead, deleteLead, notifyOwnerNewLead } from '../src/services/lead.service.js';
import { findOrCreateCustomer } from '../src/services/customer.service.js';
import { config } from '../src/config/env.js';
import { STUDIO_CONFIG, getOwnerPhone, getStudioPhone } from '../src/config/studio.config.js';
import { supabase, isSupabaseConfigured } from '../src/config/supabase.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

async function runTests() {
  console.log('\n======================================================');
  console.log('🚀 SIGNATURE DETAILING CRM — SYSTEM VERIFICATION SUITE');
  console.log('======================================================\n');

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}`;
  console.log(`📡 Test server running on ${baseUrl}\n`);

  const createdLeadIds = [];
  let igUserId = null;

  try {
    // 1. Root & Frontend Static SPA Serving Test
    console.log('▶ [1/8] Frontend & Static Serving:');
    const rootRes = await fetch(`${baseUrl}/`);
    const rootHtml = await rootRes.text();
    assert(rootRes.status === 200, 'GET / returns HTTP 200');
    assert(rootHtml.includes('Signature Detailing') || rootHtml.includes('id="root"'), 'Root HTML renders frontend single-page application shell');

    // 2. Health & Diagnostic Check
    console.log('\n▶ [2/8] Health & Diagnostic Check:');
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthJson = await healthRes.json();
    assert(healthRes.status === 200, 'GET /api/health returns HTTP 200');
    assert(healthJson.status === 'online', 'System status is online');
    assert(healthJson.system === 'Signature Detailing CRM API', 'System identity verified');
    assert(
      isSupabaseConfigured ? healthJson.database === 'connected' : ['connected', 'unconfigured'].includes(healthJson.database),
      `Supabase database keep-alive query verified (${healthJson.database})`
    );
    assert(healthJson.keepAlive === 'active', 'Supabase anti-pausing heartbeat is active');

    // 3. Studio Services & Packages
    console.log('\n▶ [3/8] Studio Services Catalog API:');
    const servicesRes = await fetch(`${baseUrl}/api/services`);
    const servicesJson = await servicesRes.json();
    assert(servicesRes.status === 200, 'GET /api/services returns HTTP 200');
    assert(Array.isArray(servicesJson.data) && servicesJson.data.length > 0, `Loaded ${servicesJson.data?.length || 0} active detailing packages`);
    const ceramic = servicesJson.data?.find(s => s.name.toLowerCase().includes('ceramic') || s.name.toLowerCase().includes('paint'));
    assert(!!ceramic, 'Catalog contains premium protection services (Ceramic/PPF)');

    // 4. Lead Creation & Pipeline KPIs
    console.log('\n▶ [4/8] Lead Creation & Pipeline KPIs:');
    const newLeadRes = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rajesh Sharma',
        phone: '9820198201',
        service: '✨ Ceramic Coating',
        vehicle: 'BMW 3 Series (Portimao Blue)',
        source: 'walk_in',
      }),
    });
    const newLeadJson = await newLeadRes.json();
    assert(newLeadRes.status === 201 || newLeadRes.status === 200, 'POST /api/leads creates new lead');
    assert(newLeadJson.data?.id, `New lead generated with ID: ${newLeadJson.data?.id}`);
    if (newLeadJson.data?.id) createdLeadIds.push(newLeadJson.data.id);

    const kpisRes = await fetch(`${baseUrl}/api/leads/kpis`);
    const kpisJson = await kpisRes.json();
    assert(kpisRes.status === 200, 'GET /api/leads/kpis returns HTTP 200');
    assert(typeof kpisJson.data?.counts?.total === 'number', `Total Leads count is tracked (${kpisJson.data?.counts?.total})`);

    // 5. Phone Validator & 3-by-3 Instagram Carousel Engine
    console.log('\n▶ [5/8] Phone Validator & 3-by-3 Instagram Carousel Engine:');
    const invalidShort = validateAndFormatPhone('12345');
    assert(!invalidShort.isValid, 'Rejects short phone numbers (12345)');

    const dummySequence = validateAndFormatPhone('9999999999');
    assert(!dummySequence.isValid, 'Rejects dummy repeating numbers (9999999999)');

    const validMobile = validateAndFormatPhone('+91 98201 12345');
    assert(validMobile.isValid && validMobile.cleanPhone === '+919820112345', 'Validates & formats Indian mobile numbers (+919820112345)');

    const naturalPhone = validateAndFormatPhone('Sure! My number is\n9820112345');
    assert(naturalPhone.isValid && naturalPhone.cleanPhone === '+919820112345', 'Extracts and formats phone from natural sentences ("Sure! My number is 9820112345")');

    // Test 3-by-3 Carousel Layout Generation
    const carouselCards = await buildInstagramServicesCarousel();
    assert(Array.isArray(carouselCards) && carouselCards.length === 2, `Generated ${carouselCards.length} carousel cards for 5 services (3 per card limit)`);
    assert(carouselCards[0].buttons.length === 3, 'Card 1 contains exactly 3 service buttons (PPF, Ceramic, Correction)');
    assert(carouselCards[0].title.includes('(1/2)'), 'Card 1 title includes pagination indicator (1/2)');
    assert(carouselCards[1].buttons.length === 3, 'Card 2 contains 2 services + 1 View Website action button');
    assert(carouselCards[1].title.includes('(2/2)'), 'Card 2 title includes pagination indicator (2/2)');

    // WhatsApp 1-Tap Flow
    const testPhone = `919820${Date.now().toString().slice(-6)}`;

    // Step 1: Client selects service -> Direct 1-Tap booking completes qualification immediately!
    const step1 = await processBotMessage({
      channel: 'whatsapp',
      channelUserId: testPhone,
      rawText: 'Ceramic Coating',
      buttonPayload: 'SERVICE_ceramic',
      profileName: 'Rohit Sharma',
      metaMessageId: `test_msg_${Date.now()}_1`,
    });
    assert(step1.step === 'completed', 'WhatsApp: Service chosen (SERVICE_ceramic) -> Direct 1-Tap booking completes qualification');
    assert(step1.lead?.id, 'WhatsApp: Lead automatically registered in CRM pipeline with name & phone');
    if (step1.lead?.id) createdLeadIds.push(step1.lead.id);

    // Step 2: Client taps "Change Phone Number" button
    const stepChangePhone = await processBotMessage({
      channel: 'whatsapp',
      channelUserId: testPhone,
      rawText: 'Change Phone Number',
      buttonPayload: 'PHONE_CHANGE',
      profileName: 'Rohit Sharma',
      metaMessageId: `test_msg_${Date.now()}_change`,
    });
    assert(stepChangePhone.step === 'awaiting_phone_update', 'WhatsApp: Tapping Change Phone Number prompts for new mobile number');

    // Step 2b: Rejects invalid phone numbers gracefully
    const stepInvalid = await processBotMessage({
      channel: 'whatsapp',
      channelUserId: testPhone,
      rawText: '00000',
      profileName: 'Rohit Sharma',
      metaMessageId: `test_msg_${Date.now()}_invalid`,
    });
    assert(stepInvalid.invalid === true, 'WhatsApp: Rejects invalid phone numbers gracefully (invalid: true)');

    // Step 2c: Entering valid new number updates phone and confirms booking
    const stepUpdatedPhone = await processBotMessage({
      channel: 'whatsapp',
      channelUserId: testPhone,
      rawText: '98201 12345',
      profileName: 'Rohit Sharma',
      metaMessageId: `test_msg_${Date.now()}_updated`,
    });
    assert(stepUpdatedPhone.step === 'completed', 'WhatsApp: Valid new number updates phone and confirms booking');
    assert(stepUpdatedPhone.updatedPhone === '+919820112345', 'WhatsApp: Updated phone formatted correctly (+919820112345)');

    // Step 3: Test CRM Lead Deletion -> Customer starts conversation again on WhatsApp
    if (step1.lead?.id) {
      await deleteLead(step1.lead.id);
      const stepAfterDelete = await processBotMessage({
        channel: 'whatsapp',
        channelUserId: testPhone,
        rawText: 'Hi',
        profileName: 'Rohit Sharma',
        metaMessageId: `test_msg_${Date.now()}_restart`,
      });
      assert(stepAfterDelete.step === 'awaiting_service', 'CRM Lead Deletion: Deleting lead resets WhatsApp flow cleanly to Welcome Menu');
    }

    // Instagram Flow: 3-by-3 Card Tapping + Phone Capture
    const igUserId = `ig_test_${Date.now().toString().slice(-6)}`;
    const igStep1 = await processBotMessage({
      channel: 'instagram',
      channelUserId: igUserId,
      rawText: 'Hi',
    });
    assert(igStep1.step === 'awaiting_service', 'Instagram Greeting: Dispatches 3-by-3 detailing cards');

    // Client taps "✨ Ceramic Coating" button on Card 1
    const igStep2 = await processBotMessage({
      channel: 'instagram',
      channelUserId: igUserId,
      rawText: '✨ Ceramic Coating',
      buttonPayload: 'SERVICE_ceramic',
    });
    assert(igStep2.step === 'awaiting_phone_input', 'Instagram: Tapping "✨ Ceramic Coating" prompts for 10-digit phone');

    // Client enters "Sure! My number is 9820112345"
    const igStep3 = await processBotMessage({
      channel: 'instagram',
      channelUserId: igUserId,
      rawText: 'Sure! My number is\n9820112345',
    });
    assert(igStep3.step === 'completed', 'Instagram: "Sure! My number is 9820112345" instantly completes qualification and registers lead');
    assert(igStep3.phone === '+919820112345', 'Instagram: Correctly extracted "+919820112345"');
    if (igStep3.lead?.id) createdLeadIds.push(igStep3.lead.id);

    // 6. Instagram Comment Automation Test
    console.log('\n▶ [6/8] Instagram Comment Automation (Reel & Post Comments):');
    const commentId = `comment_${Date.now()}`;
    const commentRes = await handleIncomingInstagramComment({
      id: commentId,
      text: 'Cost for ceramic coating on Thar?',
      from: {
        id: '17841400123456789',
        username: 'thar_enthusiast_india',
      },
      media: {
        id: '18023456789012345',
      },
    });

    assert(commentRes.public_replied === true, 'Comment: Public reply posted on post/reel');
    assert(commentRes.public_reply_text?.includes('@thar_enthusiast_india'), 'Comment: Public reply tags the commenter correctly');
    assert(commentRes.private_dm_sent === true, 'Comment: Private DM dispatched to commenter');
    assert(!commentRes.private_dm_error, 'Comment: Private DM contains no template/API errors');

    // Duplicate comment guard test
    const dupCommentRes = await handleIncomingInstagramComment({
      id: commentId,
      text: 'Cost for ceramic coating on Thar?',
      from: { id: '17841400123456789', username: 'thar_enthusiast_india' },
    });
    assert(dupCommentRes.ignored === true && dupCommentRes.reason === 'already_processed', 'Comment: Duplicate comment event ignored (idempotent guard)');

    // Bot self-reply guard test (prevents multi-reply loop on bot's own public comments)
    const botSelfReply = await handleIncomingInstagramComment({
      id: `comment_${Date.now() + 1}`,
      text: 'Hi @thar_enthusiast_india! Thanks for reaching out. We just sent you a DM with our detailing packages. Please check your message requests! 🚗✨',
      from: { id: '17841400123456789', username: 'signaturedetailing_official' },
    });
    assert(botSelfReply.ignored === true && botSelfReply.reason === 'own_bot_reply', 'Comment: Bot ignores its own public reply comments (no multi-reply loop)');

    // Own account ID guard test
    const ownAccountReply = await handleIncomingInstagramComment(
      {
        id: `comment_${Date.now() + 2}`,
        text: 'Studio is open Monday to Saturday!',
        from: { id: '999888777666', username: 'signaturedetailing' },
      },
      '999888777666'
    );
    assert(ownAccountReply.ignored === true && ownAccountReply.reason === 'own_account_comment', 'Comment: Comments from own business account ignored');

    // Non-'add' verb guard test
    const editComment = await handleIncomingInstagramComment({
      id: `comment_${Date.now() + 3}`,
      verb: 'edit',
      text: 'Edited comment',
      from: { id: '17841400123456789', username: 'thar_enthusiast_india' },
    });
    assert(editComment.ignored === true && editComment.reason === 'non_add_verb', 'Comment: Non-add verbs (edits/hides) ignored');

    // 7. Lead & Customer Deduplication Test (Handling 2nd submissions)
    console.log('\n▶ [7/8] Duplicate Data Handling & Pipeline Deduplication:');
    const dedupPhone = `+919876${Date.now().toString().slice(-6)}`;
    
    // Customer submits first time
    const cust1 = await findOrCreateCustomer({
      name: 'Duplicate Test Customer',
      phone: dedupPhone,
    });
    const lead1 = await createLead({
      customerId: cust1.id,
      serviceName: '✨ Ceramic Coating',
      status: 'new',
      notes: 'First inquiry from customer',
    });
    if (lead1?.id) createdLeadIds.push(lead1.id);
    assert(lead1?.id, 'Initial lead created for customer');

    // Customer fills/submits data a 2nd time!
    const lead2 = await createLead({
      customerId: cust1.id,
      serviceName: '🛡️ Paint Protection Film (PPF)',
      status: 'new',
      notes: 'Second inquiry from customer',
    });
    assert(lead2?.id === lead1?.id, 'Lead deduplication: Re-submission updates existing open lead instead of creating duplicate card');
    assert(lead2?.service_name?.includes('PPF') || lead2?.notes?.includes('Re-inquiry'), 'Merged service/notes tracked in open lead');

    // Customer identity deduplication check
    const cust2 = await findOrCreateCustomer({
      name: 'Duplicate Test Customer',
      phone: dedupPhone,
    });
    assert(cust2.id === cust1.id, 'Customer deduplication: Repeated submission preserves exact customer record');

    // 8. Authentication & Webhook Security
    console.log('\n▶ [8/9] Authentication & Webhook Security:');
    const invalidAuthRes = await fetch(`${baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: 'incorrect-test-passcode' }),
    });
    assert(invalidAuthRes.status === 401, 'Authentication rejects an incorrect studio passcode');

    const validAuthRes = await fetch(`${baseUrl}/api/auth/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: testCredentials.studioPasscode }),
    });
    const validAuthJson = await validAuthRes.json();
    assert(validAuthRes.status === 200 && validAuthJson.success, 'Authentication accepts the configured studio passcode');

    const waVerifyRes = await fetch(`${baseUrl}/api/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=${testCredentials.whatsappVerifyToken}&hub.challenge=test_challenge_12345`);
    const waVerifyText = await waVerifyRes.text();
    assert(waVerifyRes.status === 200 && waVerifyText === 'test_challenge_12345', 'WhatsApp webhook GET handshake returns hub.challenge');

    const igVerifyRes = await fetch(`${baseUrl}/api/webhooks/instagram?hub.mode=subscribe&hub.verify_token=${testCredentials.instagramVerifyToken}&hub.challenge=ig_challenge_67890`);
    const igVerifyText = await igVerifyRes.text();
    assert(igVerifyRes.status === 200 && igVerifyText === 'ig_challenge_67890', 'Instagram webhook GET handshake returns hub.challenge');

    // 9. Owner Notification & Bot Transparency Suite
    console.log('\n▶ [9/9] Owner Notification & Bot Transparency Suite:');
    const expectedOwnerPhone = getOwnerPhone();
    const expectedStudioPhone = getStudioPhone();
    assert(Boolean(expectedOwnerPhone), `Owner phone configured in studio.config.js: ${expectedOwnerPhone}`);

    const disclaimer = getBotDisclaimer();
    assert(/bot/i.test(disclaimer), 'Bot disclaimer identifies assistant as a bot');

    const testAppended = withBotDisclaimer('Welcome to studio!');
    assert(testAppended.includes('Welcome to studio!') && /bot/i.test(testAppended), 'withBotDisclaimer appends transparency note correctly');

    // Test Owner Notification on WhatsApp Lead
    const waLeadRes = await notifyOwnerNewLead(
      {
        source: 'whatsapp',
        service_name: '✨ Ceramic Coating',
        notes: 'Test WhatsApp lead',
      },
      { name: 'Amit Verma', phone: '+919820199999' }
    );
    assert(waLeadRes.success === true && waLeadRes.channel === 'WhatsApp Bot', 'Owner Notification: WhatsApp lead triggers real-time owner WhatsApp alert');
    assert(waLeadRes.ownerPhone === expectedOwnerPhone, 'Owner Notification: Dispatched to configured OWNER_PHONE');

    // Test Owner Notification on Instagram Lead
    const igLeadRes = await notifyOwnerNewLead(
      {
        source: 'instagram',
        service_name: '🛡️ PPF (Paint Protection Film)',
      },
      { name: 'Karan Mehra', phone: '+919820188888' }
    );
    assert(igLeadRes.success === true && igLeadRes.channel === 'Instagram DM', 'Owner Notification: Instagram lead triggers real-time owner WhatsApp alert');

    // Test Owner Notification on Website Lead
    const webLeadRes = await notifyOwnerNewLead(
      {
        source: 'website',
        service_name: '🧼 Interior Detailing',
      },
      { name: 'Sanjay Dutt', phone: '+919820177777' }
    );
    assert(webLeadRes.success === true && webLeadRes.channel === 'Website Form', 'Owner Notification: Website lead triggers real-time owner WhatsApp alert');

    // Test Skipping for non-digital channels (e.g. walk_in)
    const walkInLeadRes = await notifyOwnerNewLead({
      source: 'walk_in',
      service_name: '🧼 Interior Detailing',
    });
    assert(walkInLeadRes.skipped === true, 'Owner Notification: Non-digital walk-in leads correctly skip owner alert');

    // Test Website Public API submission includes owner contact info in response
    const webApiRes = await fetch(`${baseUrl}/api/leads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Vikram Singh',
        phone: '9820155555',
        service: '✨ Ceramic Coating',
        source: 'website',
      }),
    });
    const webApiData = await webApiRes.json();
    assert(webApiRes.status === 201, 'Website Lead API: POST /api/leads creates lead');
    assert(webApiData.message?.includes(expectedStudioPhone), 'Website Lead API: Response message contains studio phone number');
    if (webApiData.data?.id) createdLeadIds.push(webApiData.data.id);

  } catch (err) {
    console.error('Fatal error during test run:', err);
    failed++;
  } finally {
    // Hermetic cleanup: delete all test leads generated during test run
    // Hermetic cleanup: delete all test leads and conversations generated during test run
    for (const leadId of createdLeadIds) {
      try {
        await deleteLead(leadId);
      } catch (e) {
        // Ignore cleanup error
      }
    }

    try {
      const { data: testConvs } = await supabase.from('conversations').select('id, channel_user_id, customer_name');
      const toDelete = (testConvs || []).filter((c) => {
        const u = c.channel_user_id || '';
        return (
          u.startsWith('test_') ||
          u.startsWith('audit_') ||
          u.startsWith('ig_test_') ||
          u.startsWith('919820') ||
          u.startsWith('919830') ||
          u.startsWith('9198610') ||
          u.startsWith('9198619') ||
          u.startsWith('919876543210') ||
          (igUserId && u === igUserId) ||
          c.customer_name === 'Rohit Sharma'
        );
      }).map((c) => c.id);
      if (toDelete.length > 0) {
        await supabase.from('conversations').delete().in('id', toDelete);
      }
    } catch (e) {
      console.warn('[Test conversations cleanup note]', e.message);
    }

    await new Promise((resolve) => server.close(resolve));
    console.log('\n------------------------------------------------------');
    console.log(`🏁 Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('------------------------------------------------------\n');
    process.exit(failed > 0 ? 1 : 0);
  }
}

runTests();
