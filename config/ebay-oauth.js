const axios = require('axios');
require('dotenv').config();

async function getAccessToken() {
  const base64Credentials = Buffer.from(
    `${process.env.EBAY_CLIENT_ID}:${process.env.EBAY_CLIENT_SECRET}`
  ).toString('base64');

  try {
    const res = await axios.post('https://api.sandbox.ebay.com/identity/v1/oauth2/token',
      new URLSearchParams({
        grant_type: 'client_credentials',
        scope: 'https://api.ebay.com/oauth/api_scope'
      }),
      {
        headers: {
          'Authorization': `Basic ${base64Credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        }
      }
    );

    return res.data.access_token;
  } catch (err) {
    console.error('Failed to get access token:', err.response?.data || err.message);
    throw err;
  }
}

module.exports = { getAccessToken };
