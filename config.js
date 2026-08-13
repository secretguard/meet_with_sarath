// Committed intentionally — neither value here is a secret.
// API_URL is a public endpoint (every browser calling the booking page
// already sees it in network requests). RAZORPAY_KEY_ID is Razorpay's
// publishable key, designed to be public/client-side — it's meaningless
// without RAZORPAY_KEY_SECRET, which lives only in Apps Script's Script
// Properties and is never checked in anywhere. See config.example.js for
// the shape and SETUP.md for how these values are obtained.

const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyZ0MnTwo1zGttXNkKU-7EgrjWkfAn00zebit9C1cgTsCnax-M4qoQMBY7rphuqHhytVg/exec',
  RAZORPAY_KEY_ID: 'rzp_test_TPALC8ZMPlVgAs'
};
