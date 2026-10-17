export function validateAndFormatPhone(rawInput, defaultCountryCode = '91') {
  if (!rawInput || typeof rawInput !== 'string') {
    return { isValid: false, reason: 'empty_input', cleanPhone: null, displayPhone: null };
  }

  const digits = rawInput.trim().replace(/\D/g, '');
  if (digits.length < 10) return { isValid: false, reason: 'too_short', cleanPhone: null, displayPhone: null };
  if (digits.length > 15) return { isValid: false, reason: 'too_long', cleanPhone: null, displayPhone: null };

  if (/^(\d)\1{9,}$/.test(digits) || digits.includes('1234567890')) {
    return { isValid: false, reason: 'dummy_number', cleanPhone: null, displayPhone: null };
  }

  let standardized = digits;
  if (digits.length === 10) {
    if (!['6', '7', '8', '9'].includes(digits[0])) {
      return { isValid: false, reason: 'invalid_first_digit', cleanPhone: null, displayPhone: null };
    }
    standardized = `${defaultCountryCode}${digits}`;
  } else if (digits.length === 11 && digits.startsWith('0')) {
    standardized = `${defaultCountryCode}${digits.slice(1)}`;
  }

  const cleanPhone = `+${standardized}`;
  const displayPhone = standardized.startsWith('91') && standardized.length === 12
    ? `+91 ${standardized.slice(2, 7)} ${standardized.slice(7)}`
    : cleanPhone;

  return { isValid: true, reason: null, cleanPhone, displayPhone };
}
