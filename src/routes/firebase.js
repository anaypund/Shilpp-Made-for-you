require("dotenv").config();
const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_PATH;
const admin = require("firebase-admin");
const serviceAccount = require(SERVICE_ACCOUNT_PATH);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
