// models/NFT.js
const mongoose = require("mongoose");

const nftSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    image_url: { type: String, required: true },
    description: { type: String, required: true },
    background_color: { type: Number, required: true },
    race: { type: String, required: true },
    nft_id: { type: String, required: true },
    skin: { type: Number, required: true },
    eyes: { type: Number, required: true },
    mouth: { type: Number, required: true },
    haircut: { type: Number, required: true },
    outfit: { type: Number, required: true },
    accessories: { type: Number, required: true },
    account_address: { type: String, required: true },
    playerId: { type: String, required: false },
    playerName: { type: String, required: false },
  },
  {
    timestamps: true,
  }
);

const nft = mongoose.model("nft", nftSchema);

nft.createIndexes();

module.exports = nft;
