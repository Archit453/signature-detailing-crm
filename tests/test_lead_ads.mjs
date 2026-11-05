import { normalizeAdFormFields, processIncomingAdLead } from '../backend/src/services/leadAd.service.js';

async function runTests() {
  console.log('--- Running Lead Ad Field Normalizer Tests ---');

  // Test 1: Standard Meta Graph API format with custom question names
  const metaSample = {
    id: 'leadgen_test_999',
    ad_id: 'ad_123',
    form_id: 'form_456',
    field_data: [
      { name: 'full_name', values: ['Aman Verma'] },
      { name: 'what_is_your_phone_number?', values: ['+91 98765 43210'] },
      { name: 'email', values: ['aman@example.com'] },
      { name: 'which_car_do_you_drive?', values: ['Tata Safari Dark Edition'] },
      { name: 'service_interested_in', values: ['PPF (Paint Protection Film)'] },
      { name: 'city', values: ['Bhubaneswar'] },
    ],
  };

  const norm1 = normalizeAdFormFields(metaSample);
  console.log('Test 1 (Meta Graph API Format):', norm1);
  if (norm1.fullName !== 'Aman Verma') throw new Error('Expected Aman Verma');
  if (!norm1.phone.includes('98765')) throw new Error('Phone mismatch');
  if (!norm1.vehicle.includes('Tata Safari')) throw new Error('Vehicle mismatch');
  if (!norm1.service.includes('PPF')) throw new Error('Service mismatch');

  // Test 2: Agency custom question naming
  const agencySample = {
    field_data: [
      { name: 'your_name', values: ['Sneha Patel'] },
      { name: 'mobile_no', values: ['9861201770'] },
      { name: 'automobile_model', values: ['Hyundai Ioniq 5'] },
      { name: 'package_type', values: ['Ceramic Coating'] },
    ],
  };

  const norm2 = normalizeAdFormFields(agencySample);
  console.log('Test 2 (Agency Custom Questions):', norm2);
  if (norm2.fullName !== 'Sneha Patel') throw new Error('Expected Sneha Patel');
  if (norm2.phone !== '9861201770') throw new Error('Phone mismatch');
  if (!norm2.vehicle.includes('Ioniq 5')) throw new Error('Vehicle mismatch');

  // Test 3: Direct JSON flat payload (Simulator & External API)
  const flatSample = {
    name: 'Vikramaditya Roy',
    phone: '9861201770',
    service: 'Ceramic Coating',
    vehicle: 'BMW M340i',
    email: 'vikram@bmw.com',
  };

  const norm3 = normalizeAdFormFields(flatSample);
  console.log('Test 3 (Direct Flat JSON):', norm3);
  if (norm3.fullName !== 'Vikramaditya Roy') throw new Error('Expected Vikramaditya Roy');
  if (norm3.phone !== '9861201770') throw new Error('Phone mismatch');

  // Test 4: Pipeline execution
  console.log('--- Testing Ingestion Pipeline ---');
  const pipelineResult = await processIncomingAdLead(flatSample);
  console.log('Pipeline Result:', {
    success: pipelineResult.success,
    leadId: pipelineResult.lead?.id,
    source: pipelineResult.lead?.source,
    customerName: pipelineResult.lead?.customer_name,
    customerPhone: pipelineResult.lead?.customer_phone,
    serviceName: pipelineResult.lead?.service_name,
    prospectNotified: pipelineResult.prospectNotified,
  });

  if (!pipelineResult.success) throw new Error('Pipeline failed');
  if (pipelineResult.lead?.source !== 'instagram_ad') throw new Error('Source mismatch');

  console.log('✅ ALL LEAD AD TESTS PASSED SUCCESSFULLY!');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
