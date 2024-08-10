const mongoose = require("mongoose");

const questProgressNftSchema = new mongoose.Schema({
  nft_id: { type: String, required: true },
  questName: { type: String, required: true },
  completedToday: { type: Boolean, default: false },
  totalRewardPoints: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  playerName: { type: String, required: false },
});

const QuestProgressNft = mongoose.model(
  "QuestProgressNft",
  questProgressNftSchema
);

module.exports = QuestProgressNft;
