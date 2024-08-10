const mongoose = require("mongoose");

const newPlayerQuestNftSchema = new mongoose.Schema({
  nft_id: { type: String, required: true },
  questName: { type: String, required: true },
  completed: { type: Boolean, default: false },
  totalRewardPoints: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
  playerName: { type: String, required: false },
});

const NewPlayerQuestNft = mongoose.model(
  "NewPlayerQuestNft",
  newPlayerQuestNftSchema
);

module.exports = NewPlayerQuestNft;
