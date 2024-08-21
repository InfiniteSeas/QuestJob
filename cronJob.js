require("dotenv").config();
const cron = require("node-cron");
const dbConnect = require("./lib/dbConnect");
const QuestProgress = require("./models/QuestProgress");
const QuestProgressNft = require("./models/QuestProgressNft");
const logger = require("./lib/logger");
const {
  checkCraftForDailyQuestBatch,
  checkFaucetForDailyQuestBatch,
  checkCombatToPVEForDailyQuestBatch,
  checkCombatToPVPForDailyQuestBatch,
  getWalletsFromWhitelist,
  getPlayerNamesByAddresses,
} = require("./services/questService");
const {
  checkCraftForDailyQuestNftBatch,
  checkFaucetForDailyQuestNftBatch,
  checkCombatToPVEForDailyQuestNftBatch,
  checkCombatToPVPForDailyQuestNftBatch,
  getIdAndWalletsFromNFT,
} = require("./services/questServiceNft");
const { runNewbieQuestsForPlayer } = require("./services/newbieQuestService");
const {
  runNewbieQuestsForPlayerNft,
} = require("./services/newbieQuestServiceNft");

dbConnect();

const updateQuestProgress = async () => {
  try {
    const wallets = await getWalletsFromWhitelist();

    // Get player names for the wallets
    const playerNamesMap = await getPlayerNamesByAddresses(wallets);

    // Create the player address list with names
    const playerAddrList = wallets.map((wallet) => ({
      playerAddr: wallet,
      playerName: playerNamesMap[wallet] || "",
    }));

    // Call all batch functions for non-NFT quests
    await Promise.all([
      checkCraftForDailyQuestBatch(playerAddrList),
      checkFaucetForDailyQuestBatch(playerAddrList),
      checkCombatToPVEForDailyQuestBatch(playerAddrList),
      checkCombatToPVPForDailyQuestBatch(playerAddrList),
    ]);

    // Run newbie quests for all players
    for (const { playerAddr, playerName } of playerAddrList) {
      await runNewbieQuestsForPlayer(playerAddr, playerName);
    }

    logger.info("Quest progress updated for all wallets");
  } catch (error) {
    logger.error(`Error processing quests: ${error.message}`);
  }
};

const updateQuestNftProgress = async () => {
  try {
    const nftData = await getIdAndWalletsFromNFT();

    // Extract the addresses and get player names
    const walletAddresses = nftData.map(({ owner }) => owner);
    const playerNamesMap = await getPlayerNamesByAddresses(walletAddresses);

    // Create the player address and NFT list with names
    const playerAddrNftList = nftData.map(({ owner, id }) => ({
      playerAddr: owner,
      nft_id: id,
      playerName: playerNamesMap[owner] || "",
    }));

    // Call all batch functions for NFT quests
    await Promise.all([
      checkCraftForDailyQuestNftBatch(playerAddrNftList),
      checkFaucetForDailyQuestNftBatch(playerAddrNftList),
      checkCombatToPVEForDailyQuestNftBatch(playerAddrNftList),
      checkCombatToPVPForDailyQuestNftBatch(playerAddrNftList),
    ]);

    // Run newbie quests for all NFT players
    for (const { playerAddr, nft_id, playerName } of playerAddrNftList) {
      await runNewbieQuestsForPlayerNft(playerAddr, nft_id, playerName);
    }

    logger.info("Quest progress updated for all wallets");
  } catch (error) {
    logger.error(`Error processing NFT quests: ${error.message}`);
  }
};

const resetQuestProgress = async () => {
  try {
    const count = await QuestProgress.countDocuments({});
    logger.info(`QuestProgress document count: ${count}`);
    const matchedDocs = await QuestProgress.find({});
    logger.info(
      `Number of documents that QuestProgress match the filter: ${matchedDocs.length}`
    );

    const bulkOps = await QuestProgress.collection.bulkWrite([
      {
        updateMany: { filter: {}, update: { $set: { completedToday: false } } },
      },
    ]);
    logger.info(
      `Bulk reset QuestProgress complete results: ${JSON.stringify(bulkOps)}`
    );
  } catch (error) {
    logger.error(`Error resetting quest progress: ${error.message}`);
  }
};

const resetQuestNftProgress = async () => {
  try {
    const count = await QuestProgressNft.countDocuments({});
    logger.info(`QuestProgressNft document count: ${count}`);
    const matchedDocs = await QuestProgressNft.find({});
    logger.info(
      `Number of documents that match the filter: ${matchedDocs.length}`
    );

    const bulkOps = await QuestProgressNft.collection.bulkWrite([
      {
        updateMany: { filter: {}, update: { $set: { completedToday: false } } },
      },
    ]);
    logger.info(`Bulk reset complete results: ${JSON.stringify(bulkOps)}`);
  } catch (error) {
    logger.error(`Error resetting NFT quest progress: ${error.message}`);
  }
};

// Schedule the cron job to run every day at 12:02 AM UTC
cron.schedule("2 0 * * *", resetQuestProgress);
cron.schedule("2 0 * * *", resetQuestNftProgress);

// Schedule the cron job to run every 30 minutes, starting at 2 minutes past the hour
cron.schedule("2,32 * * * *", updateQuestProgress);
cron.schedule("2,32 * * * *", updateQuestNftProgress);

// This will run the job every 2 minutes
// cron.schedule("*/2 * * * *", updateQuestProgress);
// cron.schedule("*/2 * * * *", updateQuestNftProgress);
