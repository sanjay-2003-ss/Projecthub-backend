var admin = require("firebase-admin");

var serviceAccount = require("Server/config/peer-project-hub-dde4c-firebase-adminsdk-fbsvc-9e4965acef.json.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
