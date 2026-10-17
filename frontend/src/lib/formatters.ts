/**
 * Formats a raw phone string into standard Indian format (+91 XXXXX XXXXX)
 */
export function formatDisplayPhone(rawPhone?: string | null): string {
  if (!rawPhone) return '—';
  let digits = String(rawPhone).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('01') && digits.length === 12) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && digits.length === 11) {
    digits = digits.slice(1);
  }
  if (digits.length === 10) {
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return rawPhone;
}

/**
 * Generates two-letter initials from customer name
 */
export function getInitials(name?: string): string {
  if (!name || name === 'Customer') return 'C';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

