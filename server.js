require("dotenv").config();
const express = require("express");
const cors = require("cors");
const dbConnect = require("./lib/dbConnect");
const QuestProgress = require("./models/QuestProgress");
const NewPlayerQuest = require("./models/NewPlayerQuest");
const QuestProgressNft = require("./models/QuestProgressNft");
const NewPlayerQuestNft = require("./models/NewPlayerQuestNft");
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
const { runNewbieQuestsForPlayer } = require("./services/newbieQuestService");
const {
  checkCraftForDailyQuestNft,
  checkFaucetForDailyQuestNft,
  checkCombatToPVEForDailyQuestNft,
  checkCombatToPVPForDailyQuestNft,
  getIdAndWalletsFromNFT,
  checkFaucetForDailyQuestNftBatch,
} = require("./services/questServiceNft");
const {
  runNewbieQuestsForPlayerNft,
} = require("./services/newbieQuestServiceNft");

const app = express();

const NFT = require("./models/nft"); // Ensure you import the NFT model

const port = process.env.PORT || 3002;

// TODO: ADD Sailing on daily

// Allow requests from any subdomain of galxe.com
const allowedOrigins = [
  /\.galxe\.com$/,
  /\.vercel\.app$/,
  /\.localhost\$/,
  /\.infiniteseas\.io$/,
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.some((pattern) => pattern.test(origin))) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
};

app.use(cors(corsOptions));

// Middleware to parse JSON request bodies
app.use(express.json());

dbConnect();

app.get("/", async (req, res) => {
  res.status(200).json({ status: true });
});

app.get("/check-quest", async (req, res) => {
  const { wallet, quest } = req.query;

  try {
    const questProgress = await QuestProgress.findOne({
      wallet,
      questName: quest,
    });
    if (questProgress && questProgress.completedToday) {
      res.json({ is_ok: true });
    } else {
      res.json({ is_ok: false });
    }
  } catch (error) {
    logger.error(
      `Error checking quest for ${wallet} - ${quest}: ${error.message}`
    );
    res.status(500).json({ error: error.message });
  }
});

app.get("/check-quest-nft", async (req, res) => {
  const { nft_id, quest } = req.query;

  try {
    const questProgress = await QuestProgressNft.findOne({
      nft_id,
      questName: quest,
    });
    if (questProgress && questProgress.completedToday) {
      res.json({ is_ok: true });
    } else {
      res.json({ is_ok: false });
    }
  } catch (error) {
    logger.error(
      `Error checking quest for ${nft_id} - ${quest}: ${error.message}`
    );
    res.status(500).json({ error: error.message });
  }
});

app.get("/get-all-quests", async (req, res) => {
  const { wallet } = req.query;

  try {
    // Fetch quest progress for the given wallet
    const quest = await QuestProgress.findOne({ wallet });

    let playerName;
    if (quest && quest.playerName) {
      // If quest exists and has a playerName, use it
      playerName = quest.playerName;
    } else {
      // If no quest or no playerName, fetch it
      playerName = await getPlayerNameByAddress(wallet);
    }

    // Only process quests if playerName is not empty
    if (playerName) {
      try {
        // Check and update daily quests
        await checkCraftForDailyQuest(wallet, playerName);
        await checkFaucetForDailyQuest(wallet, playerName);
        await checkCombatToPVEForDailyQuest(wallet, playerName);
        await checkCombatToPVPForDailyQuest(wallet, playerName);
        logger.info("Indexer pull completed successfully");
      } catch (error) {
        logger.error(`Error running indexer pull: ${error.message}`);
        return res.status(500).json({ error: error.message });
      }

      try {
        const quests = [
          "craft_ships",
          "battle_pve",
          "battle_pvp",
          "claim_energy",
        ];
        const questStatuses = await QuestProgress.find({ wallet });

        const response = quests.map((quest) => {
          const questProgress = questStatuses.find(
            (q) => q.questName === quest
          );
          return {
            questName: quest,
            completedToday: questProgress
              ? questProgress.completedToday
              : false,
            totalRewardPoints: questProgress
              ? questProgress.totalRewardPoints
              : 0,
          };
        });

        res.json(response);
      } catch (error) {
        logger.error(
          `Error getting all quests for ${wallet}: ${error.message}`
        );
        res.status(500).json({ error: error.message });
      }
    } else {
      // If playerName is empty, return an error response
      res.status(200).json({ message: "Player name could not be retrieved." });
    }
  } catch (error) {
    logger.error(
      `Error fetching quest progress for ${wallet}: ${error.message}`
    );
    res.status(500).json({ error: error.message });
  }
});

app.get("/get-all-quests-nft", async (req, res) => {
  const { wallet, nft_id } = req.query;

  try {
    // Fetch quest progress for the given nft_id
    const quest = await QuestProgressNft.findOne({ nft_id });

    let playerName;
    if (quest && quest.playerName) {
      // If quest exists and has a playerName, use it
      playerName = quest.playerName;
    } else {
      // If no quest or no playerName, fetch it
      playerName = await getPlayerNameByAddress(wallet);
    }

    // Only process quests if playerName is not empty
    if (playerName) {
      try {
        // Check and update daily quests
        await checkCraftForDailyQuestNft(wallet, nft_id, playerName);
        await checkFaucetForDailyQuestNft(wallet, nft_id, playerName);
        await checkCombatToPVEForDailyQuestNft(wallet, nft_id, playerName);
        await checkCombatToPVPForDailyQuestNft(wallet, nft_id, playerName);
        logger.info("Indexer pull completed successfully");
      } catch (error) {
        logger.error(`Error running indexer pull: ${error.message}`);
        return res.status(500).json({ error: error.message });
      }

      try {
        // Define the list of quests to check
        const quests = [
          "craft_ships",
          "battle_pve",
          "battle_pvp",
          "claim_energy",
        ];
        // Fetch all quest progress for the given wallet
        const questStatuses = await QuestProgressNft.find({ nft_id });

        // Prepare the response by mapping over the list of quests
        const response = quests.map((quest) => {
          const questProgress = questStatuses.find(
            (q) => q.questName === quest
          );
          return {
            questName: quest,
            completedToday: questProgress
              ? questProgress.completedToday
              : false,
            totalRewardPoints: questProgress
              ? questProgress.totalRewardPoints
              : 0,
          };
        });

        res.json(response);
      } catch (error) {
        logger.error(
          `Error getting all quests for ${wallet}: ${error.message}`
        );
        res.status(500).json({ error: error.message });
      }
    } else {
      // If playerName is empty, return an error response
      res.status(200).json({ message: "Player name could not be retrieved." });
    }
  } catch (error) {
    logger.error(
      `Error fetching quest progress for ${nft_id}: ${error.message}`
    );
    res.status(500).json({ error: error.message });
  }
});

app.get("/get-all-newplayer-quests", async (req, res) => {
  const { wallet } = req.query;

  try {
    // Fetch quest progress for the given wallet
    const quest = await NewPlayerQuest.findOne({ wallet });

    let playerName;
    if (quest && quest.playerName) {
      // If quest exists and has a playerName, use it
      playerName = quest.playerName;
    } else {
      // If no quest or no playerName, fetch it
      playerName = await getPlayerNameByAddress(wallet);
    }

    // Only process quests if playerName is not empty
    if (playerName) {
      try {
        await runNewbieQuestsForPlayer(wallet, playerName);
        logger.info("New player quests pull completed successfully");
      } catch (error) {
        logger.error(`Error running newbie quests pull: ${error.message}`);
        return res.status(500).json({ error: error.message });
      }

      try {
        const quests = [
          "addedToRoster1ShipQuantity",
          "cutWoodQuantity",
          "minedOreQuantity",
          "plantedCottonQuantity",
          "rosterSailed",
          "shipOrderArranged",
          "walletCreated",
          "claimedIsland",
          "first4Craft",
          "firstPveWin",
        ];
        const questStatuses = await NewPlayerQuest.find({ wallet });

        const response = quests.map((quest) => {
          const questProgress = questStatuses.find(
            (q) => q.questName === quest
          );
          return {
            questName: quest,
            completed: questProgress ? questProgress.completed : false,
            totalRewardPoints: questProgress
              ? questProgress.totalRewardPoints
              : 0,
          };
        });

        res.json(response);
      } catch (error) {
        logger.error(
          `Error getting all new player quests for ${wallet}: ${error.message}`
        );
        res.status(500).json({ error: error.message });
      }
    } else {
      // If playerName is empty, return an error response
      res.status(200).json({ message: "Player name could not be retrieved." });
    }
  } catch (error) {
    logger.error(
      `Error fetching quest progress for ${wallet}: ${error.message}`
    );
    res.status(500).json({ error: error.message });
  }
});

app.get("/get-all-newplayer-quests-nft", async (req, res) => {
  const { wallet, nft_id } = req.query;

  try {
    // Fetch quest progress for the given nft_id
    const quest = await NewPlayerQuestNft.findOne({ nft_id });

    let playerName;
    if (quest && quest.playerName) {
      // If quest exists and has a playerName, use it
      playerName = quest.playerName;
    } else {
      // If no quest or no playerName, fetch it
      playerName = await getPlayerNameByAddress(wallet);
    }

    // Only process quests if playerName is not empty
    if (playerName) {
      try {
        await runNewbieQuestsForPlayerNft(wallet, nft_id, playerName);
        logger.info("New player quests NFT pull completed successfully");
      } catch (error) {
        logger.error(`Error running newbie quests NFT pull: ${error.message}`);
        return res.status(500).json({ error: error.message });
      }

      try {
        const quests = [
          "addedToRoster1ShipQuantity",
          "cutWoodQuantity",
          "minedOreQuantity",
          "plantedCottonQuantity",
          "rosterSailed",
          "shipOrderArranged",
          "walletCreated",
          "claimedIsland",
          "first4Craft",
          "firstPveWin",
        ];
        const questStatuses = await NewPlayerQuestNft.find({ nft_id });

        const response = quests.map((quest) => {
          const questProgress = questStatuses.find(
            (q) => q.questName === quest
          );
          return {
            questName: quest,
            completed: questProgress ? questProgress.completed : false,
            totalRewardPoints: questProgress
              ? questProgress.totalRewardPoints
              : 0,
          };
        });

        res.json(response);
      } catch (error) {
        logger.error(
          `Error getting all new player quests for ${nft_id}: ${error.message}`
        );
        res.status(500).json({ error: error.message });
      }
    } else {
      // If playerName is empty, return an error response
      res.status(200).json({ message: "Player name could not be retrieved." });
    }
  } catch (error) {
    logger.error(
      `Error fetching quest progress for ${nft_id}: ${error.message}`
    );
    res.status(500).json({ error: error.message });
  }
});

app.get("/get-names-and-points", async (req, res) => {
  try {
    // Aggregate points based on wallet for QuestProgress and NewPlayerQuest
    const dailyPoints = await QuestProgress.aggregate([
      {
        $group: {
          _id: "$wallet",
          totalRewardPoints: { $sum: "$totalRewardPoints" },
          playerName: { $first: "$playerName" },
        },
      },
    ]);

    const newbiePoints = await NewPlayerQuest.aggregate([
      {
        $group: {
          _id: "$wallet",
          totalRewardPoints: { $sum: "$totalRewardPoints" },
          playerName: { $first: "$playerName" },
        },
      },
    ]);

    // Aggregate points based on nft_id for QuestProgressNft and NewPlayerQuestNft
    const dailyPointsNft = await QuestProgressNft.aggregate([
      {
        $group: {
          _id: "$nft_id",
          totalRewardPoints: { $sum: "$totalRewardPoints" },
          playerName: { $first: "$playerName" },
        },
      },
    ]);

    const newbiePointsNft = await NewPlayerQuestNft.aggregate([
      {
        $group: {
          _id: "$nft_id",
          totalRewardPoints: { $sum: "$totalRewardPoints" },
          playerName: { $first: "$playerName" },
        },
      },
    ]);

    // Combine dailyPoints and newbiePoints based on wallet
    const combinedWalletPoints = dailyPoints.map((daily) => {
      const newbie = newbiePoints.find(
        (newbie) => newbie._id.toString() === daily._id.toString()
      );
      return {
        wallet: daily._id,
        totalRewardPoints:
          daily.totalRewardPoints + (newbie ? newbie.totalRewardPoints : 0),
        playerName: daily.playerName || (newbie ? newbie.playerName : null),
      };
    });

    newbiePoints.forEach((newbie) => {
      if (
        !combinedWalletPoints.some((combined) => combined.wallet === newbie._id)
      ) {
        combinedWalletPoints.push({
          wallet: newbie._id,
          totalRewardPoints: newbie.totalRewardPoints,
          playerName: newbie.playerName,
        });
      }
    });

    // Combine dailyPointsNft and newbiePointsNft based on nft_id
    const combinedNftPoints = dailyPointsNft.map((dailyNft) => {
      const newbieNft = newbiePointsNft.find(
        (newbieNft) => newbieNft._id.toString() === dailyNft._id.toString()
      );
      return {
        nft_id: dailyNft._id,
        totalRewardPoints:
          dailyNft.totalRewardPoints +
          (newbieNft ? newbieNft.totalRewardPoints : 0),
        playerName:
          dailyNft.playerName || (newbieNft ? newbieNft.playerName : null),
      };
    });

    newbiePointsNft.forEach((newbieNft) => {
      if (
        !combinedNftPoints.some((combined) => combined.nft_id === newbieNft._id)
      ) {
        combinedNftPoints.push({
          nft_id: newbieNft._id,
          totalRewardPoints: newbieNft.totalRewardPoints,
          playerName: newbieNft.playerName,
        });
      }
    });

    // Combine both wallet and nft results into a single array
    const combinedPoints = [...combinedWalletPoints, ...combinedNftPoints];

    res.json(combinedPoints);
  } catch (error) {
    logger.error(`Error getting wallets and points: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

app.get("/get-faucet-leaderboard", async (req, res) => {
  try {
    // Fetch NFT data and wallet data
    const nftData = await getIdAndWalletsFromNFT();
    const wallets = await getWalletsFromWhitelist();

    // Prepare the player address list for both batch functions
    const playerAddrList = wallets.map((wallet) => ({ playerAddr: wallet }));
    const playerAddrNftList = nftData.map(({ owner, id }) => ({
      playerAddr: owner,
      nft_id: id,
    }));

    // Call the batch functions to update the faucet quest progress
    await checkFaucetForDailyQuestBatch(playerAddrList);
    await checkFaucetForDailyQuestNftBatch(playerAddrNftList);

    // Aggregate points based on wallet for QuestProgress and NewPlayerQuest
    const dailyPoints = await QuestProgress.aggregate([
      {
        $group: {
          _id: "$wallet",
          totalRewardPoints: { $sum: "$totalRewardPoints" },
        },
      },
    ]);

    const newbiePoints = await NewPlayerQuest.aggregate([
      {
        $group: {
          _id: "$wallet",
          totalRewardPoints: { $sum: "$totalRewardPoints" },
        },
      },
    ]);

    // Aggregate points based on nft_id for QuestProgressNft and NewPlayerQuestNft
    const dailyPointsNft = await QuestProgressNft.aggregate([
      {
        $group: {
          _id: "$nft_id",
          totalRewardPoints: { $sum: "$totalRewardPoints" },
        },
      },
    ]);

    const newbiePointsNft = await NewPlayerQuestNft.aggregate([
      {
        $group: {
          _id: "$nft_id",
          totalRewardPoints: { $sum: "$totalRewardPoints" },
        },
      },
    ]);

    // Combine dailyPoints and newbiePoints based on wallet
    const combinedWalletPoints = dailyPoints.map((daily) => {
      const newbie = newbiePoints.find(
        (newbie) => newbie._id.toString() === daily._id.toString()
      );
      return {
        wallet: daily._id,
        totalRewardPoints:
          daily.totalRewardPoints + (newbie ? newbie.totalRewardPoints : 0),
      };
    });

    newbiePoints.forEach((newbie) => {
      if (
        !combinedWalletPoints.some((combined) => combined.wallet === newbie._id)
      ) {
        combinedWalletPoints.push({
          wallet: newbie._id,
          totalRewardPoints: newbie.totalRewardPoints,
        });
      }
    });

    // Combine dailyPointsNft and newbiePointsNft based on nft_id
    const combinedNftPoints = dailyPointsNft.map((dailyNft) => {
      const newbieNft = newbiePointsNft.find(
        (newbieNft) => newbieNft._id.toString() === dailyNft._id.toString()
      );
      return {
        nft_id: dailyNft._id,
        totalRewardPoints:
          dailyNft.totalRewardPoints +
          (newbieNft ? newbieNft.totalRewardPoints : 0),
      };
    });

    newbiePointsNft.forEach((newbieNft) => {
      if (
        !combinedNftPoints.some((combined) => combined.nft_id === newbieNft._id)
      ) {
        combinedNftPoints.push({
          nft_id: newbieNft._id,
          totalRewardPoints: newbieNft.totalRewardPoints,
        });
      }
    });

    // Combine both wallet and nft results into a single array
    const combinedPoints = [...combinedWalletPoints, ...combinedNftPoints];

    res.json(combinedPoints);
  } catch (error) {
    logger.error(`Error getting wallets and points: ${error.message}`);
    res.status(500).json({ error: error.message });
  }
});

// app.get("/get-wallets-and-points", async (req, res) => {
//   try {
//     const wallets = await QuestProgress.aggregate([
//       {
//         $group: {
//           _id: "$wallet",
//           totalRewardPoints: { $sum: "$totalRewardPoints" },
//           playerName: { $first: "$playerName" }, // Get the playerName from the first entry
//         },
//       },
//     ]);

//     res.json(wallets);
//   } catch (error) {
//     logger.error(`Error getting wallets and points: ${error.message}`);
//     res.status(500).json({ error: error.message });
//   }
// });

// Endpoint to add a new wallet to the database
// Updated Endpoint to add a new wallet to the database
// app.post("/add-wallet", async (req, res) => {
//   const { wallet, playerName } = req.body;

//   if (!wallet || !playerName) {
//     return res.status(400).json({
//       error: "Wallet address, and Player Name are required",
//     });
//   }

//   try {
//     const existingWallet = await QuestProgress.findOne({ wallet });

//     if (existingWallet) {
//       return res.status(400).json({ error: "Wallet already exists" });
//     }

//     // Creating an initial entry for the wallet in QuestProgress
//     const quests = ["craft_ships", "battle_pve", "battle_pvp", "claim_energy"];
//     for (const quest of quests) {
//       await QuestProgress.create({
//         wallet,
//         questName: quest,
//         completedToday: false,
//         totalRewardPoints: 0,
//         playerName: playerName,
//       });
//     }

//     // Creating an initial entry for the wallet in NewPlayerQuest
//     const newbieQuests = [
//       "addedToRoster1ShipQuantity",
//       "cutWoodQuantity",
//       "minedOreQuantity",
//       "plantedCottonQuantity",
//       "rosterSailed",
//       "shipOrderArranged",
//       "walletCreated",
//       "claimedIsland",
//       "first4Craft",
//       "firstPveWin",
//     ];
//     for (const quest of newbieQuests) {
//       await NewPlayerQuest.create({
//         wallet,
//         questName: quest,
//         completed: false,
//         totalRewardPoints: 0,
//         playerName: playerName,
//       });
//     }

//     // Completing the 'walletCreated' quest
//     const walletCreatedQuest = await NewPlayerQuest.findOne({
//       wallet,
//       questName: "walletCreated",
//     });

//     if (walletCreatedQuest) {
//       walletCreatedQuest.completed = true;
//       walletCreatedQuest.totalRewardPoints = 2;
//       await walletCreatedQuest.save();
//     }

//     // Updating the playerName in the NFT collection
//     const updateResult = await NFT.updateOne(
//       { account_address: wallet },
//       { $set: { playerName: playerName } }
//     );

//     if (updateResult.nModified === 0) {
//       return res
//         .status(404)
//         .json({ error: "NFT not found for the given address" });
//     }

//     logger.info(
//       `Wallet ${wallet} and Player Name ${playerName} added successfully`
//     );
//     res.status(201).json({
//       message: "Wallet and Player Name added successfully",
//     });
//   } catch (error) {
//     logger.error(
//       `Error adding wallet ${wallet} and Player Name ${playerName}: ${error.message}`
//     );
//     res.status(500).json({ error: error.message });
//   }
// });

// Endpoint to mark claimedIsland quest as completed
// app.post("/complete-claimedIsland", async (req, res) => {
//   const { wallet } = req.body;

//   if (!wallet) {
//     return res.status(400).json({
//       error: "Wallet address is required",
//     });
//   }

//   try {
//     const claimedIslandQuest = await NewPlayerQuest.findOne({
//       wallet,
//       questName: "claimedIsland",
//     });

//     if (claimedIslandQuest) {
//       if (claimedIslandQuest.completed) {
//         return res.status(400).json({
//           error: "claimedIsland quest is already completed",
//         });
//       }
//       claimedIslandQuest.completed = true;
//       claimedIslandQuest.totalRewardPoints = 5;
//       await claimedIslandQuest.save();
//       res.status(200).json({
//         message: "claimedIsland quest marked as completed",
//         totalRewardPoints: claimedIslandQuest.totalRewardPoints,
//       });
//     } else {
//       res.status(404).json({
//         error: "claimedIsland quest not found for the given wallet",
//       });
//     }
//   } catch (error) {
//     logger.error(
//       `Error completing claimedIsland quest for ${wallet}: ${error.message}`
//     );
//     res.status(500).json({ error: error.message });
//   }
// });

// Endpoint to trigger the cron job
// app.post("/run-cron", async (req, res) => {
//   try {
//     const wallets = await QuestProgress.distinct("wallet");

//     for (const wallet of wallets) {
//       await checkCraftForDailyQuest({ playerAddr: wallet });
//       await checkFaucetForDailyQuest({ playerAddr: wallet });
//       await checkCombatToPVEForDailyQuest({ playerAddr: wallet });
//       await checkCombatToPVPForDailyQuest({ playerAddr: wallet });
//     }

//     logger.info("Cron job completed successfully");
//     res.status(200).send("Cron job completed successfully");
//   } catch (error) {
//     logger.error(`Error running cron job: ${error.message}`);
//     res.status(500).json({ error: error.message });
//   }
// });

// app.post("/reset-task", async (req, res) => {
//   try {
//     await QuestProgress.updateMany({}, { $set: { completedToday: false } });
//     res.status(200).send("Reset completed successfully");
//     logger.info("Reset completedToday for all quests");
//   } catch (error) {
//     logger.error(`Error resetting quest progress: ${error.message}`);
//   }
// });

// app.post("/run-newbie-quests", async (req, res) => {
//   try {
//     const wallets = await QuestProgress.distinct("wallet");

//     for (const wallet of wallets) {
//       await runNewbieQuestsForPlayer(wallet);
//     }
//     logger.info(`Newbie quests check completed`);
//     res.status(200).send(`Newbie quests check completed`);
//   } catch (error) {
//     logger.error(`Error running newbie quests check: ${error.message}`);
//     res.status(500).json({ error: error.message });
//   }
// });
// app.get("/nfts", async (req, res) => {
//   try {
//     const nfts = await NFT.find({}, "image_url account_address"); // Retrieve only image_url and account_address fields
//     res.json(nfts);
//   } catch (error) {
//     logger.error(`Error fetching NFTs: ${error.message}`);
//     res.status(500).json({ error: error.message });
//   }
// });

// Add this endpoint in your existing Express app

// app.get("/nft-by-address", async (req, res) => {
//   const { account_address } = req.query;

//   if (!account_address) {
//     return res
//       .status(400)
//       .json({ error: "Account account_address is required" });
//   }

//   try {
//     const nft = await NFT.findOne(
//       { account_address: account_address },
//       "image_url"
//     );
//     if (nft) {
//       res.json({ image_url: nft.image_url });
//     } else {
//       res
//         .status(404)
//         .json({ error: "NFT not found for the given account_address" });
//     }
//   } catch (error) {
//     logger.error(
//       `Error fetching NFT for account_address ${account_address}: ${error.message}`
//     );
//     res.status(500).json({ error: error.message });
//   }
// });

app.listen(port, () => {
  logger.info(`Server running on port ${port}`);
});
