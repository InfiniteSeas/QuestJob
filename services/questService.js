const axios = require("axios");
const dbConnect = require("../lib/dbConnect");
const QuestProgress = require("../models/QuestProgress");
const logger = require("../lib/logger");

const INDEXER_BASE_URL = process.env.INDEXER_BASE_URL || "";

const getTimestamp = (offsetDays = 0, offsetHours = 0, offsetMinutes = 0) => {
  const date = new Date();
  date.setDate(date.getDate() + offsetDays);
  date.setHours(date.getHours() + offsetHours);
  date.setMinutes(date.getMinutes() + offsetMinutes);
  return date.getTime(); // Return time in milliseconds
};

// Update these times to match the new reset period
const startAt = getTimestamp(-1, 0, 1); // 12:01 AM from the last day
const endedAt = getTimestamp(0, 0, 0, 59); // 12:00:59 AM toda

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
  completed
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

async function checkCraftForDailyQuest({ playerAddr }) {
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
    await updateQuestProgressInDB(playerAddr, "craft_ships", points, completed);
  } catch (error) {
    logger.error(
      `Error checking craft for daily quest for ${playerAddr}: ${error.message}`
    );
  }
}

async function checkFaucetForDailyQuest({ playerAddr }) {
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
      completed
    );
  } catch (error) {
    logger.error(
      `Error checking faucet for daily quest for ${playerAddr}: ${error.message}`
    );
  }
}

async function checkCombatToPVEForDailyQuest({ playerAddr }) {
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
    await updateQuestProgressInDB(playerAddr, "battle_pve", points, completed);
  } catch (error) {
    logger.error(
      `Error checking combat to PVE for daily quest for ${playerAddr}: ${error.message}`
    );
  }
}

async function checkCombatToPVPForDailyQuest({ playerAddr }) {
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
    await updateQuestProgressInDB(playerAddr, "battle_pvp", points, completed);
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
};
