const axios = require("axios");
const dbConnect = require("../lib/dbConnect");
const NewPlayerQuestNft = require("../models/NewPlayerQuestNft");
const logger = require("../lib/logger");

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

// August 8th, 2024 timestamp
const startAt = getUnixTimestamp(2024, 8, 8, 0, 0, 0);

const INDEXER_BASE_URL = process.env.INDEXER_BASE_URL || "";

//ADD CRAFT & PVE
const getRewardPoints = (questName) => {
  switch (questName) {
    case "addedToRoster1ShipQuantity":
      return 5;
    case "cutWoodQuantity":
      return 3;
    case "minedOreQuantity":
      return 3;
    case "plantedCottonQuantity":
      return 3;
    case "rosterSailed":
      return 10;
    case "shipOrderArranged":
      return 3;
    case "first4Craft":
      return 10;
    case "firstPveWin":
      return 15;
    case "claimedIsland":
      return 5;
    case "walletCreated":
      return 2;
    default:
      return 0;
  }
};

async function isQuestCompleted(nft_id, questName) {
  const questProgress = await NewPlayerQuestNft.findOne({
    nft_id: nft_id,
    questName,
  });
  return questProgress ? questProgress.completed : false;
}

async function updateQuestProgressInDB(
  nft_id,
  questName,
  points,
  completed,
  playerName
) {
  await dbConnect();
  const questProgress = await NewPlayerQuestNft.findOne({
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

    await NewPlayerQuestNft.create({
      nft_id: nft_id,
      questName,
      completed: completed,
      totalRewardPoints: completed ? points : 0,
      playerName: playerName,
    });
    logger.info(
      `Created new quest progress for ${nft_id} - ${questName}: completed=${completed} with ${points} points`
    );
  } else if (!questProgress.completed) {
    questProgress.completed = completed;
    if (completed) {
      questProgress.totalRewardPoints += points;
    }
    await questProgress.save();
    logger.info(
      `Updated quest progress for ${nft_id} - ${questName}: completed=${completed} with ${points} points`
    );
  } else {
    logger.info(
      `No update needed for ${nft_id} - ${questName} as it is already completed`
    );
  }
}

async function checkQuestAPI(
  playerAddr,
  nft_id,
  playerName,
  apiEndpoint,
  questName,
  requiredValue
) {
  if (await isQuestCompleted(nft_id, questName)) {
    logger.info(`Quest '${questName}' already completed for ${playerAddr}`);
    return;
  }

  try {
    const { data } = await axios.get(`${INDEXER_BASE_URL}${apiEndpoint}`, {
      params: {
        senderAddress: playerAddr,
      },
    });

    const completed = data >= requiredValue;
    const points = completed ? getRewardPoints(questName) : 0;
    await updateQuestProgressInDB(
      nft_id,
      questName,
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking quest '${questName}' for ${playerAddr}: ${error.message}`
    );
  }
}

async function checkBooleanQuestAPI(
  playerAddr,
  nft_id,
  playerName,
  apiEndpoint,
  questName
) {
  if (await isQuestCompleted(nft_id, questName)) {
    logger.info(`Quest '${questName}' already completed for ${nft_id}`);
    return;
  }

  try {
    const { data } = await axios.get(`${INDEXER_BASE_URL}${apiEndpoint}`, {
      params: {
        senderAddress: playerAddr,
      },
    });

    const completed = data === true;
    const points = completed ? getRewardPoints(questName) : 0;
    await updateQuestProgressInDB(
      nft_id,
      questName,
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking quest '${questName}' for ${nft_id}: ${error.message}`
    );
  }
}

async function checkFirst4Craft(playerAddr, nft_id, playerName) {
  if (await isQuestCompleted(nft_id, "first4Craft")) {
    logger.info(`Quest 'first4Craft' already completed for ${nft_id}`);
    return;
  }

  // Current date
  const currentDate = new Date();
  const currentYear = currentDate.getUTCFullYear();
  const currentMonth = currentDate.getUTCMonth() + 1; // getUTCMonth() returns month from 0-11
  const currentDay = currentDate.getUTCDate();
  const currentHour = currentDate.getUTCHours();
  const currentMin = currentDate.getUTCMinutes();
  const currentSec = currentDate.getUTCSeconds();

  // Current timestamp
  const endedAt = getUnixTimestamp(
    currentYear,
    currentMonth,
    currentDay,
    currentHour,
    currentMin,
    currentSec
  );

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
    const points = completed ? getRewardPoints("first4Craft") : 0;
    await updateQuestProgressInDB(
      nft_id,
      "first4Craft",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking first4Craft quest for ${nft_id}: ${error.message}`
    );
  }
}

async function checkFirstPveWin(playerAddr, nft_id, playerName) {
  if (await isQuestCompleted(nft_id, "firstPveWin")) {
    logger.info(`Quest 'firstPveWin' already completed for ${nft_id}`);
    return;
  }
  // Current date
  const currentDate = new Date();
  const currentYear = currentDate.getUTCFullYear();
  const currentMonth = currentDate.getUTCMonth() + 1; // getUTCMonth() returns month from 0-11
  const currentDay = currentDate.getUTCDate();
  const currentHour = currentDate.getUTCHours();
  const currentMin = currentDate.getUTCMinutes();
  const currentSec = currentDate.getUTCSeconds();

  // Current timestamp
  const endedAt = getUnixTimestamp(
    currentYear,
    currentMonth,
    currentDay,
    currentHour,
    currentMin,
    currentSec
  );
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
      combats.filter((combat) => combat.winner === 1).length >= 1;
    const points = completed ? getRewardPoints("firstPveWin") : 0;
    await updateQuestProgressInDB(
      nft_id,
      "firstPveWin",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking firstPveWin quest for ${nft_id}: ${error.message}`
    );
  }
}

// Function to handle the /api/Players?owner=address API call
async function checkWalletAndIslandQuests(playerAddr, nft_id, playerName) {
  try {
    const { data: players } = await axios.get(`${INDEXER_BASE_URL}/Players`, {
      params: {
        owner: playerAddr,
      },
    });

    // Check if any players exist for this owner
    if (players.length > 0) {
      // Mark walletCreated quest as completed
      const walletPoint = getRewardPoints("walletCreated");
      await updateQuestProgressInDB(
        nft_id,
        "walletCreated",
        walletPoint,
        true,
        playerName
      );

      // Check if any player has claimedIsland
      const hasClaimedIsland = players.some(
        (player) => player.claimedIsland !== null
      );

      if (hasClaimedIsland) {
        const claimedPoint = getRewardPoints("claimedIsland");
        await updateQuestProgressInDB(
          nft_id,
          "claimedIsland",
          claimedPoint,
          true,
          playerName
        );
      }
    }
  } catch (error) {
    logger.error(
      `Error checking wallet and island quests for ${playerAddr}: ${error.message}`
    );
  }
}

async function runNewbieQuestsForPlayerNft(playerAddr, nft_id, playerName) {
  await checkQuestAPI(
    playerAddr,
    nft_id,
    playerName,
    "/quests/addedToRoster1ShipQuantity",
    "addedToRoster1ShipQuantity",
    4
  );
  await checkQuestAPI(
    playerAddr,
    nft_id,
    playerName,
    "/quests/cutWoodQuantity",
    "cutWoodQuantity",
    5
  );
  await checkQuestAPI(
    playerAddr,
    nft_id,
    playerName,
    "/quests/minedOreQuantity",
    "minedOreQuantity",
    5
  );
  await checkQuestAPI(
    playerAddr,
    nft_id,
    playerName,
    "/quests/plantedCottonQuantity",
    "plantedCottonQuantity",
    5
  );
  await checkBooleanQuestAPI(
    playerAddr,
    nft_id,
    playerName,
    "/quests/rosterSailed",
    "rosterSailed"
  );
  await checkBooleanQuestAPI(
    playerAddr,
    nft_id,
    playerName,
    "/quests/shipOrderArranged",
    "shipOrderArranged"
  );
  await checkFirst4Craft(playerAddr, nft_id, playerName);
  await checkFirstPveWin(playerAddr, nft_id, playerName);
  await checkWalletAndIslandQuests(playerAddr, nft_id, playerName);
}

module.exports = {
  runNewbieQuestsForPlayerNft,
};
