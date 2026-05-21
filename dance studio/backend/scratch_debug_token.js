const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const token = process.env.META_ACCESS_TOKEN;

async function debugToken() {
  try {
    const res = await axios.get(`https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`);
    console.log('Token Info:', JSON.stringify(res.data, null, 2));
  } catch (err) {
    console.error('Error debugging token:', err.response ? err.response.data : err.message);
  }
}

debugToken();
