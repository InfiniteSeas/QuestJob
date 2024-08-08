require("dotenv").config();
const cron = require("node-cron");
const dbConnect = require("./lib/dbConnect");
const QuestProgress = require("./models/QuestProgress");
const NewPlayerQuest = require("./models/NewPlayerQuest");
const logger = require("./lib/logger");
const {
  checkCraftForDailyQuest,
  checkFaucetForDailyQuest,
  checkCombatToPVEForDailyQuest,
  checkCombatToPVPForDailyQuest,
} = require("./services/questService");
const { runNewbieQuestsForPlayer } = require("./services/newbieQuestService");

dbConnect();

const updateQuestProgress = async () => {
  try {
    const wallets = await QuestProgress.distinct("wallet");

    for (const wallet of wallets) {
      await checkCraftForDailyQuest({ playerAddr: wallet });
      await checkFaucetForDailyQuest({ playerAddr: wallet });
      await checkCombatToPVEForDailyQuest({ playerAddr: wallet });
      await checkCombatToPVPForDailyQuest({ playerAddr: wallet });
      // Check and update newbie quests progress
      await runNewbieQuestsForPlayer(wallet);
    }
    logger.info("Quest progress updated for all wallets");
  } catch (error) {
    logger.error(`Error processing quests: ${error.message}`);
  }
};

const resetQuestProgress = async () => {
  try {
    await QuestProgress.updateMany({}, { $set: { completedToday: false } });
    logger.info("Reset completedToday for all quests");
  } catch (error) {
    logger.error(`Error resetting quest progress: ${error.message}`);
  }
};

// Schedule the cron job to run every day at 12:01 AM UTC
cron.schedule("1 0 * * *", resetQuestProgress);

// Schedule the cron job to run every day at 10 PM UTC
// cron.schedule("0 22 * * *", updateQuestProgress);

// Schedule the cron job to run every 30 minutes, starting at 2 minutes past the hour
cron.schedule("2,32 * * * *", updateQuestProgress);
