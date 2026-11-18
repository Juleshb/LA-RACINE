export function feeCurrency(fee) {
  const code = String(fee?.currency || '').toUpperCase();
  if (code === 'USD') return 'USD';
  const text = `${fee?.notes || ''} ${fee?.label || ''}`;
  if (/dollar|paiement en dollars/i.test(text)) return 'USD';
  return 'RWF';
}

export function formatMoney(amount, currency = 'RWF') {
  if (amount == null || amount === '') return '—';
  const code = String(currency || 'RWF').toUpperCase() === 'USD' ? 'USD' : 'RWF';
  return new Intl.NumberFormat(code === 'USD' ? 'en-US' : 'en-RW', {
    style: 'currency',
    currency: code,
    minimumFractionDigits: code === 'USD' ? 2 : 0,
    maximumFractionDigits: code === 'USD' ? 2 : 0,
  }).format(Number(amount) || 0);
}
