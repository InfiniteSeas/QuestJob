require("dotenv").config();
const cron = require("node-cron");
const dbConnect = require("./lib/dbConnect");
const QuestProgress = require("./models/QuestProgress");
const logger = require("./lib/logger");
const {
  checkCraftForDailyQuest,
  checkFaucetForDailyQuest,
  checkCombatToPVEForDailyQuest,
  checkCombatToPVPForDailyQuest,
} = require("./services/questService");

dbConnect();

const updateQuestProgress = async () => {
  try {
    const wallets = await QuestProgress.distinct("wallet");

    for (const wallet of wallets) {
      await checkCraftForDailyQuest({ playerAddr: wallet });
      await checkFaucetForDailyQuest({ playerAddr: wallet });
      await checkCombatToPVEForDailyQuest({ playerAddr: wallet });
      await checkCombatToPVPForDailyQuest({ playerAddr: wallet });
    }
    logger.info("Quest progress updated for all wallets");
  } catch (error) {
    logger.error(`Error processing quests: ${error.message}`);
  }
};

// Schedule the cron job to run every day at 10 PM UTC
// cron.schedule("0 22 * * *", updateQuestProgress);

// Schedule the cron job to run every 5 minutes for testing
cron.schedule("*/5 * * * *", updateQuestProgress);
