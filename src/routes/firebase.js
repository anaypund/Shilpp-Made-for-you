require("dotenv").config();
const fs = require("fs");
const admin = require("firebase-admin");

const SERVICE_ACCOUNT_PATH = process.env.SERVICE_ACCOUNT_PATH;

let serviceAccount;
try {
  serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
} catch (err) {
  console.error("❌ Failed to load Firebase service account:", SERVICE_ACCOUNT_PATH);
  console.error(err);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
