const axios = require("axios");
const dbConnect = require("../lib/dbConnect");
const NewPlayerQuest = require("../models/NewPlayerQuest");
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

// Current date
const currentDate = new Date();
const currentYear = currentDate.getUTCFullYear();
const currentMonth = currentDate.getUTCMonth() + 1; // getUTCMonth() returns month from 0-11
const currentDay = currentDate.getUTCDate();
const currentHour = currentDate.getUTCHours();
const currentMin = currentDate.getUTCMinutes();
const currentSec = currentDate.getUTCSeconds();

// August 8th, 2024 timestamp
const startAt = getUnixTimestamp(2024, 8, 8, 0, 0, 0);
// Current timestamp
const endedAt = getUnixTimestamp(
  currentYear,
  currentMonth,
  currentDay,
  currentHour,
  currentMin,
  currentSec
);

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

async function isQuestCompleted(playerAddr, questName) {
  const questProgress = await NewPlayerQuest.findOne({
    wallet: playerAddr,
    questName,
  });
  return questProgress ? questProgress.completed : false;
}

async function updateQuestProgressInDB(
  playerAddr,
  questName,
  points,
  completed,
  playerName
) {
  await dbConnect();
  const questProgress = await NewPlayerQuest.findOne({
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

    await NewPlayerQuest.create({
      wallet: playerAddr,
      questName,
      completed: completed,
      totalRewardPoints: completed ? points : 0,
      playerName: playerName,
    });
    logger.info(
      `Created new quest progress for ${playerAddr} - ${questName}: completed=${completed} with ${points} points`
    );
  } else if (!questProgress.completed) {
    questProgress.completed = completed;
    if (completed) {
      questProgress.totalRewardPoints += points;
    }
    await questProgress.save();
    logger.info(
      `Updated quest progress for ${playerAddr} - ${questName}: completed=${completed} with ${points} points`
    );
  } else {
    logger.info(
      `No update needed for ${playerAddr} - ${questName} as it is already completed`
    );
  }
}

async function checkQuestAPI(
  playerAddr,
  playerName,
  apiEndpoint,
  questName,
  requiredValue
) {
  if (await isQuestCompleted(playerAddr, questName)) {
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
      playerAddr,
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
  playerName,
  apiEndpoint,
  questName
) {
  if (await isQuestCompleted(playerAddr, questName)) {
    logger.info(`Quest '${questName}' already completed for ${playerAddr}`);
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
      playerAddr,
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

async function checkFirst4Craft(playerAddr, playerName) {
  if (await isQuestCompleted(playerAddr, "first4Craft")) {
    logger.info(`Quest 'first4Craft' already completed for ${playerAddr}`);
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
    const points = completed ? getRewardPoints("first4Craft") : 0;
    await updateQuestProgressInDB(
      playerAddr,
      "first4Craft",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking first4Craft quest for ${playerAddr}: ${error.message}`
    );
  }
}

async function checkFirstPveWin(playerAddr, playerName) {
  if (await isQuestCompleted(playerAddr, "firstPveWin")) {
    logger.info(`Quest 'firstPveWin' already completed for ${playerAddr}`);
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
      combats.filter((combat) => combat.winner === 1).length >= 1;
    const points = completed ? getRewardPoints("firstPveWin") : 0;
    await updateQuestProgressInDB(
      playerAddr,
      "firstPveWin",
      points,
      completed,
      playerName
    );
  } catch (error) {
    logger.error(
      `Error checking firstPveWin quest for ${playerAddr}: ${error.message}`
    );
  }
}

// Function to handle the /api/Players?owner=address API call
async function checkWalletAndIslandQuests(playerAddr, playerName) {
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
        playerAddr,
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
          playerAddr,
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

async function runNewbieQuestsForPlayer(playerAddr, playerName) {
  await checkQuestAPI(
    playerAddr,
    playerName,
    "/quests/addedToRoster1ShipQuantity",
    "addedToRoster1ShipQuantity",
    4
  );
  await checkQuestAPI(
    playerAddr,
    playerName,
    "/quests/cutWoodQuantity",
    "cutWoodQuantity",
    5
  );
  await checkQuestAPI(
    playerAddr,
    playerName,
    "/quests/minedOreQuantity",
    "minedOreQuantity",
    5
  );
  await checkQuestAPI(
    playerAddr,
    playerName,
    "/quests/plantedCottonQuantity",
    "plantedCottonQuantity",
    5
  );
  await checkBooleanQuestAPI(
    playerAddr,
    playerName,
    "/quests/rosterSailed",
    "rosterSailed"
  );
  await checkBooleanQuestAPI(
    playerAddr,
    playerName,
    "/quests/shipOrderArranged",
    "shipOrderArranged"
  );
  await checkFirst4Craft(playerAddr, playerName);
  await checkFirstPveWin(playerAddr, playerName);
  await checkWalletAndIslandQuests(playerAddr, playerName);
}

module.exports = {
  runNewbieQuestsForPlayer,
};
