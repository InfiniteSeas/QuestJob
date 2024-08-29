const axios = require("axios");
const dbConnect = require("../lib/dbConnect");
const QuestProgress = require("../models/QuestProgress");
const logger = require("../lib/logger");

const INDEXER_BASE_URL = process.env.INDEXER_BASE_URL || "";
const MAP_ID = process.env.MAP_ID || "";

// Function to get the current start and end timestamps
function getStartAndEndTimestamps() {
  const currentDate = new Date();
  const currentYear = currentDate.getUTCFullYear();
  const currentMonth = currentDate.getUTCMonth() + 1; // getUTCMonth() returns month from 0-11
  const currentDay = currentDate.getUTCDate();

  const startAt = Date.UTC(currentYear, currentMonth - 1, currentDay, 0, 1); // 12:01 AM today UTC
  const endedAt = Date.UTC(
    currentYear,
    currentMonth - 1,
    currentDay + 1,
    0,
    0,
    59
  ); // 12:00:59 AM tomorrow UTC

  return { startAt, endedAt };
}

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

async function getPlayerNamesByAddresses(playerAddrs) {
  try {
    // Fetch all players
    const { data: players } = await axios.get(`${INDEXER_BASE_URL}/Players`);

    // Create a map of player addresses to player names
    const playerNamesMap = playerAddrs.reduce((acc, addr) => {
      const player = players.find((p) => p.owner === addr);
      acc[addr] = player ? player.name || "" : "";
      return acc;
    }, {});

    return playerNamesMap; // Return the map of player addresses to player names
  } catch (error) {
    logger.error(`Error retrieving player names: ${error.message}`);
    return playerAddrs.reduce((acc, addr) => {
      acc[addr] = "";
      return acc;
    }, {}); // Return a map with empty strings if an error occurs
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
  const { startAt, endedAt } = getStartAndEndTimestamps();

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
  const { startAt, endedAt } = getStartAndEndTimestamps();

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

async function checkCombatToPVEForDailyQuest(playerAddr, playerName) {
  const { startAt, endedAt } = getStartAndEndTimestamps();

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
  const { startAt, endedAt } = getStartAndEndTimestamps();

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

async function checkCraftForDailyQuestBatch(playerAddrList) {
  const { startAt, endedAt } = getStartAndEndTimestamps();

  const senderAddresses = playerAddrList.map(({ playerAddr }) => playerAddr);

  try {
    const { data: craftRecords } = await axios.post(
      `${INDEXER_BASE_URL}/contractEvents/batchShipProductionCompletedEvents`,
      {
        startAt,
        endAt: endedAt,
        senderAddresses,
      }
    );

    const senderCountMap = craftRecords.reduce((acc, record) => {
      const { suiSender } = record;
      acc[suiSender] = (acc[suiSender] || 0) + 1;
      return acc;
    }, {});

    for (const { playerAddr, playerName } of playerAddrList) {
      if (await isQuestCompletedToday(playerAddr, "craft_ships")) {
        logger.info(
          `Quest 'craft_ships' already completed today for ${playerAddr}`
        );
        continue;
      }

      const completed = senderCountMap[playerAddr] >= 4;
      const points = completed ? getRewardPoints("craft_ships") : 0;

      await updateQuestProgressInDB(
        playerAddr,
        "craft_ships",
        points,
        completed,
        playerName
      );
    }

    logger.info("Batch ship production quest progress updated for all players");
  } catch (error) {
    logger.error(
      `Error checking batch ship production quests: ${error.message}`
    );
  }
}

async function checkFaucetForDailyQuestBatch(playerAddrList) {
  const { startAt, endedAt } = getStartAndEndTimestamps();

  const senderAddresses = playerAddrList.map(({ playerAddr }) => playerAddr);

  try {
    const { data: faucetRecords } = await axios.post(
      `${INDEXER_BASE_URL}/contractEvents/batchFaucetRequestedEvents`,
      {
        startAt,
        endAt: endedAt,
        senderAddresses,
      }
    );

    for (const { playerAddr, playerName } of playerAddrList) {
      if (await isQuestCompletedToday(playerAddr, "claim_energy")) {
        logger.info(
          `Quest 'claim_energy' already completed today for ${playerAddr}`
        );
        continue;
      }

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
    }

    logger.info("Batch faucet quest progress updated for all players");
  } catch (error) {
    logger.error(`Error checking batch faucet quests: ${error.message}`);
  }
}

async function checkCombatToPVEForDailyQuestBatch(playerAddrList) {
  const { startAt, endedAt } = getStartAndEndTimestamps();

  const senderAddresses = playerAddrList.map(({ playerAddr }) => playerAddr);

  try {
    const { data: combats } = await axios.post(
      `${INDEXER_BASE_URL}/contractEvents/batchGetPlayerVsEnvironmentEvents`,
      {
        startAt,
        endAt: endedAt,
        senderAddresses,
      }
    );

    const senderCountMap = combats.reduce((acc, record) => {
      const { suiSender, winner } = record;
      if (winner === 1) {
        acc[suiSender] = (acc[suiSender] || 0) + 1;
      }
      return acc;
    }, {});

    for (const { playerAddr, playerName } of playerAddrList) {
      if (await isQuestCompletedToday(playerAddr, "battle_pve")) {
        logger.info(
          `Quest 'battle_pve' already completed today for ${playerAddr}`
        );
        continue;
      }

      const completed = senderCountMap[playerAddr] >= 3;
      const points = completed ? getRewardPoints("battle_pve") : 0;

      await updateQuestProgressInDB(
        playerAddr,
        "battle_pve",
        points,
        completed,
        playerName
      );
    }

    logger.info("Batch PVE combat quest progress updated for all players");
  } catch (error) {
    logger.error(`Error checking batch PVE combat quests: ${error.message}`);
  }
}

async function checkCombatToPVPForDailyQuestBatch(playerAddrList) {
  const { startAt, endedAt } = getStartAndEndTimestamps();

  const senderAddresses = playerAddrList.map(({ playerAddr }) => playerAddr);

  try {
    const { data: combats } = await axios.post(
      `${INDEXER_BASE_URL}/contractEvents/batchGetPlayerVsPlayerEvents`,
      {
        startAt,
        endAt: endedAt,
        senderAddresses,
      }
    );

    const senderCountMap = combats.reduce((acc, record) => {
      const {
        suiSender,
        initiatorSenderAddress,
        responderSenderAddress,
        winner,
      } = record;

      if (
        (initiatorSenderAddress === suiSender && winner === 1) ||
        (responderSenderAddress === suiSender && winner === 0)
      ) {
        acc[suiSender] = (acc[suiSender] || 0) + 1;
      }

      return acc;
    }, {});

    for (const { playerAddr, playerName } of playerAddrList) {
      if (await isQuestCompletedToday(playerAddr, "battle_pvp")) {
        logger.info(
          `Quest 'battle_pvp' already completed today for ${playerAddr}`
        );
        continue;
      }

      const completed = senderCountMap[playerAddr] >= 1;
      const points = completed ? getRewardPoints("battle_pvp") : 0;

      await updateQuestProgressInDB(
        playerAddr,
        "battle_pvp",
        points,
        completed,
        playerName
      );
    }

    logger.info("Batch PVP combat quest progress updated for all players");
  } catch (error) {
    logger.error(`Error checking batch PVP combat quests: ${error.message}`);
  }
}

module.exports = {
  checkCraftForDailyQuest,
  checkCraftForDailyQuestBatch,
  checkFaucetForDailyQuest,
  checkFaucetForDailyQuestBatch,
  checkCombatToPVEForDailyQuest,
  checkCombatToPVEForDailyQuestBatch,
  checkCombatToPVPForDailyQuest,
  checkCombatToPVPForDailyQuestBatch,
  getWalletsFromWhitelist,
  getPlayerNameByAddress,
  getPlayerNamesByAddresses,
};
