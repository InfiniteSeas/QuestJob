require("dotenv").config();
const express = require("express");
const cors = require("cors");
const dbConnect = require("./lib/dbConnect");
const QuestProgress = require("./models/QuestProgress");
const logger = require("./lib/logger");
const {
  checkCraftForDailyQuest,
  checkFaucetForDailyQuest,
  checkCombatToPVEForDailyQuest,
  checkCombatToPVPForDailyQuest,
} = require("./services/questService");
const app = express();

const NFT = require("./models/NFT"); // Ensure you import the NFT model

const port = process.env.PORT || 3000;

// Allow requests from any subdomain of galxe.com
const allowedOrigins = [
  /\.galxe\.com$/,
  /\.vercel\.app$/,
  /\.localhost\$/,
  /\.infiniteseas\.io$/,
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.some((pattern) => pattern.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));

// Middleware to parse JSON request bodies
app.use(express.json());

dbConnect();

app.get("/", async (req, res) => {
  res.status(200).json({ status: true });
});

app.get("/nfts", async (req, res) => {
  try {
    const nfts = await NFT.find({}, "image_url account_address playerId"); // Retrieve only image_url and account_address fields
    res.json(nfts);
  } catch (error) {
    logger.error(`Error fetching NFTs: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Add this endpoint in your existing Express app

app.get("/nft-by-playerId", async (req, res) => {
  const { playerId } = req.query;

  if (!playerId) {
    return res.status(400).json({ error: "Account playerId is required" });
  }

  try {
    const nft = await NFT.findOne({ playerId: playerId }, "image_url");
    if (nft) {
      res.json({ image_url: nft.image_url });
    } else {
      res.status(404).json({ error: "NFT not found for the given playerId" });
    }
  } catch (error) {
    logger.error(
      `Error fetching NFT for playerId ${playerId}: ${error.message}`
    );
    res.status(500).json({ error: error.message });
  }
});

app.get("/check-quest", async (req, res) => {
  const { wallet, quest } = req.query;

  try {
    const questProgress = await QuestProgress.findOne({
      wallet,
      questName: quest,
    });
    if (questProgress && questProgress.completedToday) {
      res.json({ is_ok: true });
    } else {
      res.json({ is_ok: false });
    }
  } catch (error) {
    logger.error(
      `Error checking quest for ${wallet} - ${quest}: ${error.message}`
    );
    res.status(500).json({ error: error.message });
  }
});

app.get("/get-all-quests", async (req, res) => {
  const { wallet } = req.query;

  try {
    await checkCraftForDailyQuest({ playerAddr: wallet });
    await checkFaucetForDailyQuest({ playerAddr: wallet });
    await checkCombatToPVEForDailyQuest({ playerAddr: wallet });
    await checkCombatToPVPForDailyQuest({ playerAddr: wallet });
    logger.info("Indexer pull completed successfully");
  } catch (error) {
    logger.error(`Error running indexer pull: ${error.message}`);
    res.status(500).json({ error: error.message });
  }

  try {
    const quests = ["craft_ships", "battle_pve", "battle_pvp", "claim_energy"];
    const questStatuses = await QuestProgress.find({ wallet });

    const response = quests.map((quest) => {
      const questProgress = questStatuses.find((q) => q.questName === quest);
      return {
        questName: quest,
        completedToday: questProgress ? questProgress.completedToday : false,
        totalRewardPoints: questProgress ? questProgress.totalRewardPoints : 0,
      };
    });

    res.json(response);
  } catch (error) {
    logger.error(`Error getting all quests for ${wallet}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get("/get-wallets-and-points", async (req, res) => {
  try {
    const wallets = await QuestProgress.aggregate([
      {
        $group: {
          _id: "$wallet",
          totalRewardPoints: { $sum: "$totalRewardPoints" },
        },
      },
    ]);

    res.json(wallets);
  } catch (error) {
    logger.error(`Error getting wallets and points: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to add a new wallet to the database
// Updated Endpoint to add a new wallet to the database
app.post("/add-wallet", async (req, res) => {
  const { wallet, playerId } = req.body;

  if (!wallet || !playerId) {
    return res
      .status(400)
      .json({ error: "Wallet address and Player ID are required" });
  }

  try {
    const existingWallet = await QuestProgress.findOne({ wallet });

    if (existingWallet) {
      return res.status(400).json({ error: "Wallet already exists" });
    }

    // Creating an initial entry for the wallet in QuestProgress
    const quests = ["craft_ships", "battle_pve", "battle_pvp", "claim_energy"];
    for (const quest of quests) {
      await QuestProgress.create({
        wallet,
        questName: quest,
        completedToday: false,
        totalRewardPoints: 0,
      });
    }

    // Updating the playerId in the NFT collection
    const nft = await NFT.findOne({ account_address: wallet });
    if (nft) {
      nft.playerId = playerId;
      await nft.save();
    } else {
      return res
        .status(404)
        .json({ error: "NFT not found for the given address" });
    }

    logger.info(
      `Wallet ${wallet} and Player ID ${playerId} added successfully`
    );
    res
      .status(201)
      .json({ message: "Wallet and Player ID added successfully" });
  } catch (error) {
    logger.error(
      `Error adding wallet ${wallet} and Player ID ${playerId}: ${error.message}`
    );
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to trigger the cron job
// app.get("/run-cron", async (req, res) => {
//   try {
//     const wallets = await QuestProgress.distinct("wallet");

//     for (const wallet of wallets) {
//       await checkCraftForDailyQuest({ playerAddr: wallet });
//       await checkFaucetForDailyQuest({ playerAddr: wallet });
//       await checkCombatToPVEForDailyQuest({ playerAddr: wallet });
//       await checkCombatToPVPForDailyQuest({ playerAddr: wallet });
//     }

//     logger.info("Cron job completed successfully");
//     res.status(200).send("Cron job completed successfully");
//   } catch (error) {
//     logger.error(`Error running cron job: ${error.message}`);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.get("/reset-task", async (req, res) => {
//   try {
//     await QuestProgress.updateMany({}, { $set: { completedToday: false } });
//     logger.info("Reset completedToday for all quests");
//   } catch (error) {
//     logger.error(`Error resetting quest progress: ${error.message}`);
//   }
// });

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});
