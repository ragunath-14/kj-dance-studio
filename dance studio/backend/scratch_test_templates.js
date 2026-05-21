const axios = require('axios');
const phoneId = '1014007845139975';
const token = 'EAANZAioWVy4kBRWjYcYlm1Kbzx0ZAR6k2qdFrbD6fqMAw3tDNjC6Nguvf5t0x3jMV5BULyFaT2BmI0XbVhYHLfCyC3ZBqzsuLYhUiGwMqKFbv4y2n124EoZAr4Hj78okpRyCPZAq5pK7GAaXs7RO3jHl31O6UiIqPvCIt3hA5jxm7BwX9n70vbZAhpcG9ZANgOuQIXiOEMG5Bznb0fJY9hpCFGAZAtfBOmOl9qzt5KZB1nu6zLMxNYxzj9183Pb5WhVmo3HIBvDc35ZC6V7syhXDZAn';
const number = '918610766098';

axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
  messaging_product: 'whatsapp',
  to: number,
  type: 'template',
  template: {
    name: 'welcome_message',
    language: { code: 'en' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Ragu' },
          { type: 'text', text: 'Dance Class' },
          { type: 'text', text: '6 PM' }
        ]
      }
    ]
  }
}, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => {
  console.log('Success welcome_message:', res.data);
}).catch(e => console.error('Error welcome_message:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message));

axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
  messaging_product: 'whatsapp',
  to: number,
  type: 'template',
  template: {
    name: 'payment_remainder',
    language: { code: 'en' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Ragu' },
          { type: 'text', text: '1000' },
          { type: 'text', text: '1' }
        ]
      }
    ]
  }
}, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => {
  console.log('Success payment_remainder:', res.data);
}).catch(e => console.error('Error payment_remainder:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message));

axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
  messaging_product: 'whatsapp',
  to: number,
  type: 'template',
  template: {
    name: 'payment_completed',
    language: { code: 'en' },
    components: [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Ragu' },
          { type: 'text', text: '1000' },
          { type: 'text', text: 'Monthly Fee' },
          { type: 'text', text: 'May 2026' }
        ]
      }
    ]
  }
}, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => {
  console.log('Success payment_completed:', res.data);
}).catch(e => console.error('Error payment_completed:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message));

axios.post(`https://graph.facebook.com/v19.0/${phoneId}/messages`, {
  messaging_product: 'whatsapp',
  to: number,
  type: 'template',
  template: {
    name: 'hello_world',
    language: { code: 'en_US' }
  }
}, {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(res => {
  console.log('Success hello_world:', res.data);
}).catch(e => console.error('Error hello_world:', e.response ? JSON.stringify(e.response.data, null, 2) : e.message));

