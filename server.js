require("dotenv").config();
const express = require("express");
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

dbConnect();

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
app.post("/add-wallet", async (req, res) => {
  const { wallet } = req.body;

  if (!wallet) {
    return res.status(400).json({ error: "Wallet address is required" });
  }

  try {
    const existingWallet = await QuestProgress.findOne({ wallet });

    if (existingWallet) {
      return res.status(400).json({ error: "Wallet already exists" });
    }

    // Creating an initial entry for the wallet
    const quests = ["craft_ships", "battle_pve", "battle_pvp", "claim_energy"];
    for (const quest of quests) {
      await QuestProgress.create({
        wallet,
        questName: quest,
        completedToday: false,
        totalRewardPoints: 0,
      });
    }

    logger.info(`Wallet ${wallet} added successfully`);
    res.status(201).json({ message: "Wallet added successfully" });
  } catch (error) {
    logger.error(`Error adding wallet ${wallet}: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// Endpoint to trigger the cron job
app.get("/run-cron", async (req, res) => {
  try {
    const wallets = await QuestProgress.distinct("wallet");

    for (const wallet of wallets) {
      await checkCraftForDailyQuest({ playerAddr: wallet });
      await checkFaucetForDailyQuest({ playerAddr: wallet });
      await checkCombatToPVEForDailyQuest({ playerAddr: wallet });
      await checkCombatToPVPForDailyQuest({ playerAddr: wallet });
    }

    logger.info("Cron job completed successfully");
    res.status(200).send("Cron job completed successfully");
  } catch (error) {
    logger.error(`Error running cron job: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => {
  logger.info("Server running on port 3000");
});

app.listen(3000, () => {
  logger.info("Server running on port 3000");
});

app.listen(3000, () => {
  logger.info("Server running on port 3000");
});
