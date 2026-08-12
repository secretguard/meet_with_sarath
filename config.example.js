// Copy this file to config.js and fill in your real values.
// config.js is gitignored — it should never be committed.
//
// API_URL         = the /exec URL you get after deploying Code.gs as a Web App
//                   (Code.gs is kept locally, outside this repo — see SETUP.md)
// RAZORPAY_KEY_ID = your Razorpay PUBLIC key id (safe to expose client-side)
//
// Never put RAZORPAY_KEY_SECRET here or in any front-end file — it belongs
// only in Apps Script's Script Properties. See SETUP.md.

const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/PASTE_YOUR_DEPLOYMENT_ID_HERE/exec',
  RAZORPAY_KEY_ID: 'rzp_test_PASTE_YOUR_KEY_ID_HERE'
};
