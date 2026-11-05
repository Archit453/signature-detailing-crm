import { processBotMessage } from '../backend/src/services/bot.service.js';
import { validateAndFormatPhone } from '../backend/src/utils/phoneValidator.js';

async function runTests() {
  console.log('--- 1. Testing Phone Validator ---');
  
  const shortPhone = validateAndFormatPhone('12345');
  console.assert(!shortPhone.isValid, 'Short phone should be invalid');
  console.log('✓ Rejects short phone');

  const dummyPhone = validateAndFormatPhone('1111111111');
  console.assert(!dummyPhone.isValid, 'Dummy phone should be invalid');
  console.log('✓ Rejects dummy phone sequence');

  const validIndianPhone = validateAndFormatPhone('9876543210');
  console.assert(validIndianPhone.isValid, 'Valid 10-digit Indian phone should pass');
  console.assert(validIndianPhone.cleanPhone === '+919876543210', 'Should format with country code');
  console.log('✓ Validates & formats 10-digit Indian mobile:', validIndianPhone.displayPhone);

  console.log('\n--- 2. Testing WhatsApp 2-Tap Qualification Bot ---');

  // Step 1: Inbound Greeting -> Returns Services
  const res1 = await processBotMessage({
    channel: 'whatsapp',
    channelUserId: '919876543210',
    rawText: 'Hi',
  });
  console.assert(res1.step === 'awaiting_service', 'Should transition to awaiting_service');
  console.log('✓ Step 1: Greeting triggers service selection menu');

  // Step 2: Select Service -> Direct 1-Tap Qualification & Lead Creation
  const res2 = await processBotMessage({
    channel: 'whatsapp',
    channelUserId: '919876543210',
    buttonPayload: 'SERVICE_ceramic',
    rawText: 'Ceramic Coating',
  });
  console.assert(res2.step === 'completed', 'Should complete qualification and create lead');
  console.assert(res2.lead && res2.lead.status === 'new', 'Lead status should be new');
  console.log('✓ Step 2: 1-Tap Booking completed and lead registered:', res2.lead.service_name);

  console.log('\n--- 3. Testing Instagram Interactive DM Flow (Cards + Full Qualification) ---');
  const freshIgUser = `ig_unit_test_${Date.now()}`;

  // Step 1: IG Greeting -> Dispatches carousel cards without sacrificing cards
  const igRes1 = await processBotMessage({
    channel: 'instagram',
    channelUserId: freshIgUser,
    rawText: 'Hey',
  });
  console.assert(igRes1.step === 'awaiting_service', 'IG should await service selection with active bot');
  console.assert(!igRes1.botPaused, 'Bot should remain active on Instagram');
  console.log('✓ IG Step 1: First message greeting dispatched cards carousel with active bot');

  // Step 2: User taps package card button -> Prompts for customer name
  const igRes2 = await processBotMessage({
    channel: 'instagram',
    channelUserId: freshIgUser,
    buttonPayload: 'SERVICE_ppf',
    rawText: 'Paint Protection Film',
  });
  console.assert(igRes2.step === 'awaiting_name', 'IG should await name input');
  console.log('✓ IG Step 2: Package selected from card, prompted for customer name');

  // Step 3: User provides their name -> Prompts for car & phone number
  const igRes3 = await processBotMessage({
    channel: 'instagram',
    channelUserId: freshIgUser,
    rawText: 'Archit Panda',
  });
  console.assert(igRes3.step === 'awaiting_phone_input', 'IG should await phone input');
  console.assert(igRes3.name === 'Archit Panda', 'Customer name should be extracted');
  console.log('✓ IG Step 3: Customer name captured, prompted for vehicle and phone number');

  // Step 4: User provides vehicle & phone number -> Completes lead capture
  const igRes4 = await processBotMessage({
    channel: 'instagram',
    channelUserId: freshIgUser,
    rawText: 'Mahindra Thar, my number is 9861201770',
  });
  console.assert(igRes4.step === 'completed', 'IG should complete lead qualification');
  console.assert(igRes4.lead && igRes4.lead.status === 'new', 'Lead should be registered in CRM');
  console.log('✓ IG Step 4: Mobile & vehicle captured, lead confirmed in CRM:', igRes4.lead.service_name);

  console.log('\n--- 4. Testing Human Takeover Edge Cases & Closing Details ---');
  const takeoverUser = `ig_takeover_test_${Date.now()}`;

  // Test 4A: Explicit Request to Speak with a Human
  const humanReqRes = await processBotMessage({
    channel: 'instagram',
    channelUserId: takeoverUser,
    rawText: 'Can I speak with a real person please?',
  });
  console.assert(humanReqRes.step === 'human_takeover', 'Should transition to human_takeover step');
  console.assert(humanReqRes.botPaused === true, 'Bot should be paused for human intervention');
  console.log('✓ Test 4A: Explicit human request pauses bot and sets human_takeover');

  // Test 4B: Inbound message while paused stays paused without bot intervention
  const silencedRes = await processBotMessage({
    channel: 'instagram',
    channelUserId: takeoverUser,
    rawText: 'Are you guys available today?',
  });
  console.assert(silencedRes.botPaused === true, 'Bot should stay silenced during human takeover');
  console.log('✓ Test 4B: Customer messages while paused do not trigger bot auto-replies');

  // Test 4C: Customer sends reset/menu keyword -> Reactivates bot
  const reactivateRes = await processBotMessage({
    channel: 'instagram',
    channelUserId: takeoverUser,
    rawText: 'menu',
  });
  console.assert(reactivateRes.step === 'awaiting_service', 'Sending menu should reset and reactivate bot');
  console.assert(!reactivateRes.botPaused, 'Bot should no longer be paused');
  console.log('✓ Test 4C: Sending "menu" reactivates bot from paused state');

  // Test 4D: 2-Strike Unrecognized Query Auto-Transfer to Human
  const fallbackUser = `ig_fallback_test_${Date.now()}`;
  // 1st unrecognized message
  const strike1 = await processBotMessage({
    channel: 'instagram',
    channelUserId: fallbackUser,
    rawText: 'What are your views on quantum mechanics?',
  });
  console.assert(strike1.handled === true && strike1.step !== 'human_takeover', 'Strike 1 should show guided fallback');
  console.log('✓ Test 4D-1: 1st unhandled query offers quick actions guidance');

  // 2nd unrecognized message -> Auto-escalate to human handover
  const strike2 = await processBotMessage({
    channel: 'instagram',
    channelUserId: fallbackUser,
    rawText: 'Tell me more about string theory',
  });
  console.assert(strike2.step === 'human_takeover', 'Strike 2 should auto-transfer to human_takeover');
  console.assert(strike2.botPaused === true, 'Bot should pause after 2 unrecognized inquiries');
  console.log('✓ Test 4D-2: 2nd consecutive unhandled query auto-escalates to human handover');

  console.log('\n========================================');
  console.log('ALL BOT & VALIDATION TESTS PASSED! 🎉');
  console.log('========================================');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
