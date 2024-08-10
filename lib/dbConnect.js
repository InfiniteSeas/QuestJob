const mongoose = require("mongoose");

const mongodb = process.env.MONGODB_URI || "";

async function dbConnect() {
  if (mongoose.connection.readyState >= 1) return;

  return mongoose.connect(mongodb, {
    dbName: "QuestTestSUI",
  });
}

module.exports = dbConnect;
