require("dotenv").config();
const cron = require("node-cron");
const dbConnect = require("./lib/dbConnect");
const QuestProgress = require("./models/QuestProgress");
const QuestProgressNft = require("./models/NewPlayerQuestNft");
const logger = require("./lib/logger");
const {
  checkCraftForDailyQuest,
  checkFaucetForDailyQuest,
  checkCombatToPVEForDailyQuest,
  checkCombatToPVPForDailyQuest,
  getWalletsFromWhitelist,
  getPlayerNameByAddress,
  checkFaucetForDailyQuestBatch,
} = require("./services/questService");
const {
  checkCraftForDailyQuestNft,
  checkFaucetForDailyQuestNft,
  checkCombatToPVEForDailyQuestNft,
  checkCombatToPVPForDailyQuestNft,
  getIdAndWalletsFromNFT,
  checkFaucetForDailyQuestNftBatch,
} = require("./services/questServiceNft");
const { runNewbieQuestsForPlayer } = require("./services/newbieQuestService");
const {
  runNewbieQuestsForPlayerNft,
} = require("./services/newbieQuestServiceNft");

dbConnect();

const updateQuestProgress = async () => {
  try {
    const wallets = await getWalletsFromWhitelist();

    const playerAddrList = wallets.map((wallet) => ({ playerAddr: wallet }));

    await checkFaucetForDailyQuestBatch(playerAddrList);

    // for (const wallet of wallets) {
    //   // Check if a quest exists for this wallet
    //   const quest = await QuestProgress.findOne({ wallet: wallet });

    //   let playerName;
    //   if (quest && quest.playerName) {
    //     // If quest exists and has a playerName, use it
    //     playerName = quest.playerName;
    //   } else {
    //     // If no quest or no playerName, fetch it
    //     playerName = await getPlayerNameByAddress(playerAddr);
    //   }

    //   // Only process quests if playerName is not empty
    //   // if (playerName) {
    //   await checkCraftForDailyQuest(wallet, playerName);
    //   await checkFaucetForDailyQuest(wallet, playerName);
    //   await checkCombatToPVEForDailyQuest(wallet, playerName);
    //   await checkCombatToPVPForDailyQuest(wallet, playerName);
    //   // Check and update newbie quests progress
    //   await runNewbieQuestsForPlayer(wallet, playerName);
    //   // } else {
    //   //   logger.info(
    //   //     `Skipping quest processing for ${playerAddr} as playerName is empty.`
    //   //   );
    //   // }
    // }
    logger.info("Quest progress updated for all wallets");
  } catch (error) {
    logger.error(`Error processing quests: ${error.message}`);
  }
};

const updateQuestNftProgress = async () => {
  try {
    const nftData = await getIdAndWalletsFromNFT();

    const playerAddrNftList = nftData.map(({ owner, id }) => ({
      playerAddr: owner,
      nft_id: id,
    }));

    await checkFaucetForDailyQuestNftBatch(playerAddrNftList);

    // for (const { owner: playerAddr, id } of nftData) {
    //   // Check if a quest exists for this wallet
    //   const quest = await QuestProgressNft.findOne({ nft_id: id });

    //   let playerName;
    //   if (quest && quest.playerName) {
    //     // If quest exists and has a playerName, use it
    //     playerName = quest.playerName;
    //   } else {
    //     // If no quest or no playerName, fetch it
    //     playerName = await getPlayerNameByAddress(playerAddr);
    //   }

    //   // Only process quests if playerName is not empty
    //   // if (playerName) {
    //   await checkCraftForDailyQuestNft(playerAddr, id, playerName);
    //   await checkFaucetForDailyQuestNft(playerAddr, id, playerName);
    //   await checkCombatToPVEForDailyQuestNft(playerAddr, id, playerName);
    //   await checkCombatToPVPForDailyQuestNft(playerAddr, id, playerName);

    //   // Check and update newbie quests progress
    //   await runNewbieQuestsForPlayerNft(playerAddr, id, playerName);
    //   // } else {
    //   //   logger.info(
    //   //     `Skipping quest processing for ${playerAddr} as playerName is empty.`
    //   //   );
    //   // }
    // }
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
const resetQuestNftProgress = async () => {
  try {
    await QuestProgressNft.updateMany({}, { $set: { completedToday: false } });
    logger.info("Reset completedToday for all quests");
  } catch (error) {
    logger.error(`Error resetting quest progress: ${error.message}`);
  }
};

// Schedule the cron job to run every day at 12:01 AM UTC
cron.schedule("1 0 * * *", resetQuestProgress);
cron.schedule("1 0 * * *", resetQuestNftProgress);

// Schedule the cron job to run every day at 10 PM UTC
// cron.schedule("0 22 * * *", updateQuestProgress);

// Schedule the cron job to run every 30 minutes, starting at 2 minutes past the hour
cron.schedule("2,32 * * * *", updateQuestProgress);
cron.schedule("2,32 * * * *", updateQuestNftProgress);

// This will run the job every 2 minutes
// cron.schedule("*/2 * * * *", updateQuestProgress);
// cron.schedule("*/2 * * * *", updateQuestNftProgress);
