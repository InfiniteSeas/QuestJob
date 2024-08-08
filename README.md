
# Quest Tracker Service

This project is a Node.js application that tracks quests and rewards for users. It uses Express.js for the server, Mongoose for MongoDB interaction, and Winston for logging.

## Features

- Add a new wallet and initialize quest entries.
- Check the status of a specific quest for a wallet.
- Retrieve all quests and their statuses for a wallet.
- Aggregate and retrieve total reward points for all wallets.
- Retrieve all NFTs' image URLs and account addresses.
- Retrieve the image URL for a specific account address.
- Mark the `claimedIsland` quest as completed for a wallet.
- Check and update newbie quests for players.

## Prerequisites

- Node.js and npm installed. Version 20.10.0 or 18+
- MongoDB instance (e.g., MongoDB Atlas).
- Git installed.

## Getting Started

### Install Dependencies

```sh
npm install
