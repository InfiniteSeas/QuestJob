const mongoose = require("mongoose");

const newPlayerQuestSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  questName: { type: String, required: true },
  completed: { type: Boolean, default: false },
  totalRewardPoints: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  playerName: { type: String, required: false },
});

const NewPlayerQuest = mongoose.model("NewPlayerQuest", newPlayerQuestSchema);

module.exports = NewPlayerQuest;
