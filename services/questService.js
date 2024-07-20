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
  return Math.floor(date.getTime() / 1000);
};

const startAt = getTimestamp(-1, 9, 59); // 9:59:00 from the last day
const endedAt = getTimestamp(0, 9, 58, 59); // 9:58:59 today

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
  } else {
    questProgress.completedToday = completed;
    if (completed) {
      questProgress.totalRewardPoints += points;
    }
    await questProgress.save();
  }
  logger.info(
    `Quest progress updated for ${playerAddr} - ${questName}: ${
      completed ? "completed" : "not completed"
    } with ${points} points`
  );
}

async function checkCraftForDailyQuest({ playerAddr }) {
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
