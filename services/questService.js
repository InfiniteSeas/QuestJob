const axios = require("axios");
const dbConnect = require("../lib/dbConnect");
const QuestProgress = require("../models/QuestProgress");
const logger = require("../lib/logger");

const INDEXER_BASE_URL = process.env.INDEXER_BASE_URL || "";
const MAP_ID = process.env.MAP_ID || "";

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

async function isQuestCompletedToday(playerAddr, questName) {
  const questProgress = await QuestProgress.findOne({
    wallet: playerAddr,
    questName,
  });
  return questProgress ? questProgress.completedToday : false;
}

async function updateQuestProgressInDB(
  playerAddr,
  questName,
  points,
  completed,
  playerName
) {
  await dbConnect();
  const questProgress = await QuestProgress.findOne({
    wallet: playerAddr,
    questName,
  });

  if (!questProgress) {
    // if (!playerName) {
    //   logger.info(
    //     `Skipping creation of quest progress for ${playerAddr} - ${questName} as playerName is not provided`
    //   );
    //   return;
    // }

    await QuestProgress.create({
      wallet: playerAddr,
      questName,
      completedToday: completed,
      totalRewardPoints: completed ? points : 0,
      playerName: playerName,
    });
    logger.info(
      `Created new quest progress for ${playerAddr} - ${questName}: completedToday=${completed} with ${points} points`
    );
  } else if (!questProgress.completedToday) {
    questProgress.completedToday = completed;
    if (completed) {
      questProgress.totalRewardPoints += points;
    }
    await questProgress.save();
    logger.info(
      `Updated quest progress for ${playerAddr} - ${questName}: completedToday=${completed} with ${points} points`
    );
  } else {
    logger.info(
      `No update needed for ${playerAddr} - ${questName} as it is already completed today`
    );
  }
}

// Function to pull wallets from MapClaimIslandWhitelistItems API
async function getWalletsFromWhitelist() {
  try {
    const { data } = await axios.get(
      `${INDEXER_BASE_URL}/Maps/${MAP_ID}/MapClaimIslandWhitelistItems`
    );
    return data.map((item) => item.key); // Extracting the wallet addresses from the response
  } catch (error) {
    logger.error(`Error fetching wallets from whitelist: ${error.message}`);
    return [];
  }
}

async function getPlayerNameByAddress(playerAddr) {
  try {
    const { data: players } = await axios.get(`${INDEXER_BASE_URL}/Players`, {
      params: {
        owner: playerAddr,
      },
    });

    // If players exist, return the name of the first player
    if (players.length > 0) {
      return players[0].name || ""; // Assuming 'name' is the field containing the player's name
    }

    // Return an empty string if no players found
    return "";
  } catch (error) {
    logger.error(
      `Error retrieving player name for ${playerAddr}: ${error.message}`
    );
    return ""; // Return an empty string in case of error as well
  }
}

async function checkCraftForDailyQuest(playerAddr, playerName) {
  if (await isQuestCompletedToday(playerAddr, "craft_ships")) {
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
      playerAddr,
      "craft_ships",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking craft for daily quest for ${playerAddr}: ${error.message}`
    );
  }
}

async function checkFaucetForDailyQuest(playerAddr, playerName) {
  if (await isQuestCompletedToday(playerAddr, "claim_energy")) {
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
      playerAddr,
      "claim_energy",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking faucet for daily quest for ${playerAddr}: ${error.message}`
    );
  }
}

async function checkFaucetForDailyQuestBatch(playerAddrList) {
  const senderAddresses = playerAddrList.map(({ playerAddr }) => {
    return playerAddr;
  });

  try {
    const { data: faucetRecords } = await axios.post(
      `${INDEXER_BASE_URL}/contractEvents/batchFaucetRequestedEvents`,
      {
        startAt,
        endAt: endedAt,
        senderAddresses,
      }
    );
    for (const record of faucetRecords) {
      const playerAddr = record.suiSender;

      // Check if the quest is already completed today for the player
      if (await isQuestCompletedToday(playerAddr, "claim_energy")) {
        logger.info(
          `Quest 'claim_energy' already completed today for ${playerAddr}`
        );
        continue;
      }

      const completed = true;
      const points = completed ? getRewardPoints("claim_energy") : 0;

      await updateQuestProgressInDB(
        playerAddr,
        "claim_energy",
        points,
        completed,
        ""
      );
    }

    logger.info("Batch faucet quest progress updated for all players");
  } catch (error) {
    logger.error(`Error checking batch faucet quests: ${error.message}`);
  }
}

async function checkCombatToPVEForDailyQuest(playerAddr, playerName) {
  if (await isQuestCompletedToday(playerAddr, "battle_pve")) {
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
      playerAddr,
      "battle_pve",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking combat to PVE for daily quest for ${playerAddr}: ${error.message}`
    );
  }
}

async function checkCombatToPVPForDailyQuest(playerAddr, playerName) {
  if (await isQuestCompletedToday(playerAddr, "battle_pvp")) {
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
      playerAddr,
      "battle_pvp",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking combat to PVP for daily quest for ${playerAddr}: ${error.message}`
    );
  }
}

module.exports = {
  checkCraftForDailyQuest,
  checkFaucetForDailyQuest,
  checkCombatToPVEForDailyQuest,
  checkCombatToPVPForDailyQuest,
  getWalletsFromWhitelist,
  getPlayerNameByAddress,
  checkFaucetForDailyQuestBatch,
};
