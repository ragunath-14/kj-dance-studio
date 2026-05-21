const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const phoneId = process.env.META_PHONE_NUMBER_ID;
const token = process.env.META_ACCESS_TOKEN;

async function checkPhone() {
  try {
    const res = await axios.get(`https://graph.facebook.com/v19.0/${phoneId}?fields=display_phone_number,verified_name,quality_rating,status`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    console.log('Phone Details:', res.data);
  } catch (e) {
    console.error('Error:', e.response ? e.response.data : e.message);
  }
}

checkPhone();
