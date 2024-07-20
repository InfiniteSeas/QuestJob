const mongoose = require("mongoose");

const questProgressSchema = new mongoose.Schema({
  wallet: { type: String, required: true },
  questName: { type: String, required: true },
  completedToday: { type: Boolean, default: false },
  totalRewardPoints: { type: Number, required: true },
  timestamp: { type: Date, default: Date.now },
});

const QuestProgress = mongoose.model("QuestProgress", questProgressSchema);

module.exports = QuestProgress;
