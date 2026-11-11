export function normalizeLead(body) {
 if (!body || typeof body.lead_id !== 'string' || !body.lead_id.trim() || body.lead_id.length > 200) throw Error('Lead inválido');
 if (!Array.isArray(body.user_column_data) || body.user_column_data.length > 100) throw Error('Campos inválidos');
 const fields = new Map(body.user_column_data.map(f => [f.column_id, typeof f.string_value === 'string' ? f.string_value.trim() : '']));
 const name = fields.get('FULL_NAME') || [fields.get('FIRST_NAME'), fields.get('LAST_NAME')].filter(Boolean).join(' ') || 'Contato Google Ads';
 const phone = fields.get('PHONE_NUMBER') || '';
 const email = fields.get('EMAIL') || '';
 if (!phone && !email) throw Error('Contato sem telefone ou e-mail');
 const account = String(body.customer_id || '').replace(/\D/g, '');
 return {lead_id:body.lead_id.trim(),name:name.slice(0,140),phone:phone.slice(0,35),email:email.slice(0,254),account_id:account,is_test:body.is_test === true};
}
