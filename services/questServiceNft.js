const axios = require("axios");
const dbConnect = require("../lib/dbConnect");
const QuestProgressNft = require("../models/QuestProgressNft");
const logger = require("../lib/logger");

const INDEXER_BASE_URL = process.env.INDEXER_BASE_URL || "";

const getUnixTimestamp = (
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0
) => {
  return Date.UTC(year, month - 1, day, hour, minute, second);
};

// Current date
const currentDate = new Date();
const currentYear = currentDate.getUTCFullYear();
const currentMonth = currentDate.getUTCMonth() + 1; // getUTCMonth() returns month from 0-11
const currentDay = currentDate.getUTCDate();

// Adjusted times to match the new reset period
const startAt = getUnixTimestamp(currentYear, currentMonth, currentDay, 0, 1); // 12:01 AM today UTC
const endedAt = getUnixTimestamp(
  currentYear,
  currentMonth,
  currentDay + 1,
  0,
  0,
  59
); // 12:00:59 AM tomorrow UTC

const getRewardPoints = (questName) => {
  switch (questName) {
    case "craft_ships":
      return 5;
    case "sail_distance":
      return 10;
    case "battle_pve":
      return 15;
    case "battle_pvp":
      return 20;
    case "claim_energy":
      return 3;
    default:
      return 0;
  }
};

// Function to pull wallets from MapClaimIslandWhitelistItems API
async function getIdAndWalletsFromNFT() {
  try {
    const { data } = await axios.get(`${INDEXER_BASE_URL}/Avatars`);

    return data.map((item) => ({
      id: item.id,
      owner: item.owner,
    })); // Extracting the wallet addresses from the response
  } catch (error) {
    logger.error(`Error fetching wallets from whitelist: ${error.message}`);
    return [];
  }
}

async function isQuestCompletedToday(nft_id, questName) {
  const questProgress = await QuestProgressNft.findOne({
    nft_id: nft_id,
    questName,
  });
  return questProgress ? questProgress.completedToday : false;
}

async function updateQuestProgressInDB(
  nft_id,
  questName,
  points,
  completed,
  playerName
) {
  await dbConnect();
  const questProgress = await QuestProgressNft.findOne({
    nft_id: nft_id,
    questName,
  });

  if (!questProgress) {
    // if (!playerName) {
    //   logger.info(
    //     `Skipping creation of quest progress for ${nft_id} - ${questName} as playerName is not provided`
    //   );
    //   return;
    // }

    await QuestProgressNft.create({
      nft_id: nft_id,
      questName,
      completedToday: completed,
      totalRewardPoints: completed ? points : 0,
      playerName: playerName,
    });
    logger.info(
      `Created new quest progress for ${nft_id} - ${questName}: completedToday=${completed} with ${points} points`
    );
  } else if (!questProgress.completedToday) {
    questProgress.completedToday = completed;
    if (completed) {
      questProgress.totalRewardPoints += points;
    }
    await questProgress.save();
    logger.info(
      `Updated quest progress for ${nft_id} - ${questName}: completedToday=${completed} with ${points} points`
    );
  } else {
    logger.info(
      `No update needed for ${nft_id} - ${questName} as it is already completed today`
    );
  }
}

async function checkCraftForDailyQuestNft(playerAddr, nft_id, playerName) {
  if (await isQuestCompletedToday(nft_id, "craft_ships")) {
    logger.info(
      `Quest 'craft_ships' already completed today for ${playerAddr}`
    );
    return;
  }

  try {
    const { data: craftRecords } = await axios.get(
      `${INDEXER_BASE_URL}/contractEvents/getShipProductionCompletedEvents`,
      {
        params: {
          startAt,
          endedAt,
          senderAddress: playerAddr,
        },
      }
    );

    const completed = craftRecords.length >= 4;
    const points = completed ? getRewardPoints("craft_ships") : 0;
    await updateQuestProgressInDB(
      nft_id,
      "craft_ships",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking craft for daily quest for ${nft_id}: ${error.message}`
    );
  }
}

async function checkFaucetForDailyQuestNft(playerAddr, nft_id, playerName) {
  if (await isQuestCompletedToday(nft_id, "claim_energy")) {
    logger.info(
      `Quest 'claim_energy' already completed today for ${playerAddr}`
    );
    return;
  }
  try {
    const { data: faucetRecords } = await axios.get(
      `${INDEXER_BASE_URL}/contractEvents/getFaucetRequestedEvents`,
      {
        params: {
          startAt,
          endedAt,
          senderAddress: playerAddr,
        },
      }
    );

    const completed = faucetRecords.some(
      (record) => record.suiSender === playerAddr
    );
    const points = completed ? getRewardPoints("claim_energy") : 0;
    await updateQuestProgressInDB(
      nft_id,
      "claim_energy",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking faucet for daily quest for ${nft_id}: ${error.message}`
    );
  }
}

async function checkCombatToPVEForDailyQuestNft(
  playerAddr,
  nft_id,
  playerName
) {
  if (await isQuestCompletedToday(nft_id, "battle_pve")) {
    logger.info(`Quest 'battle_pve' already completed today for ${playerAddr}`);
    return;
  }
  try {
    const { data: combats } = await axios.get(
      `${INDEXER_BASE_URL}/contractEvents/getPlayerVsEnvironmentEvents`,
      {
        params: {
          startAt,
          endedAt,
          senderAddress: playerAddr,
        },
      }
    );

    const completed =
      combats.filter((combat) => combat.winner === 1).length >= 3;
    const points = completed ? getRewardPoints("battle_pve") : 0;
    await updateQuestProgressInDB(
      nft_id,
      "battle_pve",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking combat to PVE for daily quest for ${nft_id}: ${error.message}`
    );
  }
}

async function checkCombatToPVPForDailyQuestNft(
  playerAddr,
  nft_id,
  playerName
) {
  if (await isQuestCompletedToday(nft_id, "battle_pvp")) {
    logger.info(`Quest 'battle_pvp' already completed today for ${playerAddr}`);
    return;
  }
  try {
    const { data: combats } = await axios.get(
      `${INDEXER_BASE_URL}/contractEvents/getPlayerVsPlayerEvents`,
      {
        params: {
          startAt,
          endedAt,
          senderAddress: playerAddr,
        },
      }
    );

    const completed = combats.some(
      ({ initiatorSenderAddress, responderSenderAddress, winner }) =>
        (initiatorSenderAddress === playerAddr && winner === 1) ||
        (responderSenderAddress === playerAddr && winner === 0)
    );
    const points = completed ? getRewardPoints("battle_pvp") : 0;
    await updateQuestProgressInDB(
      nft_id,
      "battle_pvp",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking combat to PVP for daily quest for ${nft_id}: ${error.message}`
    );
  }
}

module.exports = {
  checkCraftForDailyQuestNft,
  checkFaucetForDailyQuestNft,
  checkCombatToPVEForDailyQuestNft,
  checkCombatToPVPForDailyQuestNft,
  getIdAndWalletsFromNFT,
};
