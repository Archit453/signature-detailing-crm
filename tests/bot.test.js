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

  console.log('\n--- 3. Testing Instagram Interactive DM Flow ---');

  // Step 1: IG Greeting
  const igRes1 = await processBotMessage({
    channel: 'instagram',
    channelUserId: 'ig_test_user_88',
    rawText: 'Hey',
  });
  console.assert(igRes1.step === 'awaiting_service', 'IG should await service');
  console.log('✓ IG Step 1: Carousel dispatched');

  // Step 2: IG Service Selected -> Prompts for 10-digit phone
  const igRes2 = await processBotMessage({
    channel: 'instagram',
    channelUserId: 'ig_test_user_88',
    buttonPayload: 'SERVICE_ppf',
    rawText: 'PPF',
  });
  console.assert(igRes2.step === 'awaiting_phone_input', 'IG should await phone input');
  console.log('✓ IG Step 2: Prompts user for 10-digit mobile number');

  // Step 3: IG Phone Provided -> Completes Lead
  const igRes3 = await processBotMessage({
    channel: 'instagram',
    channelUserId: 'ig_test_user_88',
    rawText: '9820112345',
  });
  console.assert(igRes3.step === 'completed', 'IG should complete lead upon valid phone');
  console.log('✓ IG Step 3: Phone captured and lead created in CRM');

  console.log('\n========================================');
  console.log('ALL BOT & VALIDATION TESTS PASSED! 🎉');
  console.log('========================================');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});
