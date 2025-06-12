const admin = require("firebase-admin");
const serviceAccount = require("../../etc/secrets/shilp-india-firebase-adminsdk-fbsvc-5af0cebbdf.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
