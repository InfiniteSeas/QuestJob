# Quest Tracker Service

This project is a Node.js application that tracks quests and rewards for users. It uses Express.js for the server, Mongoose for MongoDB interaction, and Winston for logging.

## Features

- Check the status of a specific quest for a wallet.
- Retrieve all quests and their statuses for a wallet.
- Retrieve all quests and their statuses for an NFT.
- Retrieve all newbie quests and their statuses for a wallet.
- Retrieve all newbie quests and their statuses for an NFT.
- Aggregate and retrieve total reward points for all wallets and NFTs.

## Prerequisites

- Node.js and npm installed. Version 20.10.0 or 18+
- MongoDB instance (e.g., MongoDB Atlas).
- Git installed.

## Getting Started

### Install Dependencies

```sh
npm install
```

### Configuration

Create a `.env` file in the root directory and add the following environment variables:

```env
MONGODB_URI=your_mongodb_uri
INDEXER_BASE_URL=http://47.96.81.197:8809/api/
MAP_ID=your_map_id
```

Replace `your_mongodb_uri` with your actual MongoDB connection string.

### Running the Application Locally

```sh
npm start
```

### Running the Cron Job Locally

To run the cron job locally, you can use the `node-cron` package. Ensure you have the following setup:

```sh
npm run start:cron:dev
```

## API Endpoints

### Check Quest

- **URL**: `/check-quest`
- **Method**: `GET`
- **Query Parameters**:
  - `wallet`: Wallet address
  - `quest`: Quest name
- **Description**: Checks if a specific quest is completed for a wallet.

### Check Quest for NFT

- **URL**: `/check-quest-nft`
- **Method**: `GET`
- **Query Parameters**:
  - `nft_id`: NFT ID
  - `quest`: Quest name
- **Description**: Checks if a specific quest is completed for an NFT.

### Get All Quests for a Wallet

- **URL**: `/get-all-quests`
- **Method**: `GET`
- **Query Parameters**:
  - `wallet`: Wallet address
- **Description**: Retrieves all quests and their statuses for a wallet.

### Get All Quests for an NFT

- **URL**: `/get-all-quests-nft`
- **Method**: `GET`
- **Query Parameters**:
  - `wallet`: Wallet address
  - `nft_id`: NFT ID
- **Description**: Retrieves all quests and their statuses for an NFT.

### Get All New Player Quests for a Wallet

- **URL**: `/get-all-newplayer-quests`
- **Method**: `GET`
- **Query Parameters**:
  - `wallet`: Wallet address
- **Description**: Retrieves all newbie quests and their statuses for a wallet.

### Get All New Player Quests for an NFT

- **URL**: `/get-all-newplayer-quests-nft`
- **Method**: `GET`
- **Query Parameters**:
  - `wallet`: Wallet address
  - `nft_id`: NFT ID
- **Description**: Retrieves all newbie quests and their statuses for an NFT.

Certainly! Here’s the documentation for the `/get-names-and-points` endpoint in the style you requested:

### Get Names and Points

- **URL**: `/get-leaderboard`
- **Method**: `GET`
- **Description**: Aggregates and retrieves total reward points for all wallets and NFTs, grouped by `wallet` for wallets and `nft_id` for NFTs, along with the associated player names.

#### Response Example:

```json
[
  {
    "wallet": "0x123abc...",
    "totalRewardPoints": 120,
    "playerName": "John Doe"
  },
  {
    "nft_id": "nft_456def...",
    "totalRewardPoints": 150,
    "playerName": "Jane Doe"
  }
]
```

## Running the Cron Job (Optional)

If you need to manually trigger the cron job from another server, you can use the following endpoint:

- **URL**: `/run-cron`
- **Method**: `GET`
- **Description**: Triggered manually or via a scheduler to update quest statuses.

## License

This project is licensed under the MIT License.
