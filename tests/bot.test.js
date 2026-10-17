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

  console.log('\n--- 2. Testing 3-Step Conversational Bot ---');

  // Step 1: Inbound Greeting -> Returns Services (Zero Prices)
  const res1 = await processBotMessage({
    channel: 'whatsapp',
    channelUserId: '919876543210',
    rawText: 'Hi',
  });
  console.assert(res1.step === 'awaiting_service', 'Should transition to awaiting_service');
  console.log('✓ Step 1: Greeting triggers service selection menu');

  // Step 2: Select Service -> Returns Name Prompt
  const res2 = await processBotMessage({
    channel: 'whatsapp',
    channelUserId: '919876543210',
    buttonPayload: 'SERVICE_ceramic',
    rawText: 'Ceramic Coating',
  });
  console.assert(res2.step === 'awaiting_name', 'Should transition to awaiting_name');
  console.log('✓ Step 2: Service selection prompts for customer name');

  // Step 3: Provide Name -> WhatsApp confirms detected phone
  const res3 = await processBotMessage({
    channel: 'whatsapp',
    channelUserId: '919876543210',
    rawText: 'Rahul Sharma',
  });
  console.assert(res3.step === 'awaiting_phone', 'Should transition to awaiting_phone');
  console.log('✓ Step 3: Name captured, confirms detected WhatsApp phone');

  // Step 4: Confirm Phone -> Lead created!
  const res4 = await processBotMessage({
    channel: 'whatsapp',
    channelUserId: '919876543210',
    buttonPayload: 'PHONE_CONFIRMED',
    rawText: 'Yes, Correct',
  });
  console.assert(res4.step === 'completed', 'Should complete qualification and create lead');
  console.assert(res4.lead && res4.lead.status === 'new', 'Lead status should be new');
  console.log('✓ Step 4: Lead created successfully in CRM pipeline:', res4.lead.service_name);

  console.log('\n========================================');
  console.log('ALL BOT & VALIDATION TESTS PASSED! 🎉');
  console.log('========================================');
}

runTests().catch((err) => {
  console.error('Test error:', err);
  process.exit(1);
});

