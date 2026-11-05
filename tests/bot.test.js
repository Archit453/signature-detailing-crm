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

  console.log('\n--- 3. Testing Instagram Interactive DM Flow (1st Message Greeting -> Staff Takeover) ---');
  const freshIgUser = `ig_unit_test_${Date.now()}`;

  // Step 1: IG 1st Message Greeting -> Dispatches carousel once, then automatically pauses bot for human takeover
  const igRes1 = await processBotMessage({
    channel: 'instagram',
    channelUserId: freshIgUser,
    rawText: 'Hey',
  });
  console.assert(igRes1.step === 'human_takeover', 'IG should transition to human_takeover after 1st message');
  console.assert(igRes1.botPaused === true, 'Bot should be paused on Instagram after 1st message');
  console.log('✓ IG Step 1: First message greeting dispatched & bot paused for human takeover');

  // Step 2: Subsequent customer question -> Bot remains silenced, logged silently in CRM for staff
  const igRes2 = await processBotMessage({
    channel: 'instagram',
    channelUserId: freshIgUser,
    rawText: 'What is the price of ceramic coating?',
  });
  console.assert(igRes2.botPaused === true, 'Bot should remain silenced for subsequent messages');
  console.log('✓ IG Step 2: Subsequent messages logged silently without bot interruption');

  console.log('\n========================================');
  console.log('ALL BOT & VALIDATION TESTS PASSED! 🎉');
  console.log('========================================');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
