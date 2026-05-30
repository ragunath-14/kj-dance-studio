const axios = require('axios');
require('dotenv').config();

async function checkStatus() {
  const sid = 'SM427bd44ca81a55d1c959133e4bf1b8af';
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;

  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  try {
    const response = await axios.get(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages/${sid}.json`,
      {
        headers: {
          'Authorization': `Basic ${auth}`
        }
      }
    );
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('Error fetching status:', error.response?.data || error.message);
  }
}

checkStatus();
