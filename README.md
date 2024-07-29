Here's the updated README with the new API endpoints added:

# Quest Tracker Service

This project is a Node.js application that tracks quests and rewards for users. It uses Express.js for the server, Mongoose for MongoDB interaction, and Winston for logging.

## Features

- Add a new wallet and initialize quest entries - need to call this when the user first claims and island so that DB has this wallet.
- Check the status of a specific quest for a wallet.
- Retrieve all quests and their statuses for a wallet.
- Aggregate and retrieve total reward points for all wallets.
- Scheduled cron jobs to update quest statuses.
- Retrieve all NFTs' image URLs and account addresses.
- Retrieve the image URL for a specific account address.

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
```

Replace `your_mongodb_uri` with your actual MongoDB connection string.

### Running the Application Locally

```sh
npm start
```

### Running the Cron Job Locally

To run the cron job locally, you can use the `node-cron` package. Ensure you have the following setup:
**Run the Cron Job**:
   ```sh
   npm run start:cron:dev
   ```

## API Endpoints

**Run the Cron Job**:
   ```sh
   npm run start:dev
   ```

### Add Wallet

- **URL**: `/add-wallet`
- **Method**: `POST`
- **Body**:
  ```json
  {
    "wallet": "your_wallet_address"
  }
  ```

### Check Quest

- **URL**: `/check-quest`
- **Method**: `GET`
- **Query Parameters**:
  - `wallet`: Wallet address
  - `quest`: Quest name

### Get All Quests for a Wallet

- **URL**: `/get-all-quests`
- **Method**: `GET`
- **Query Parameters**:
  - `wallet`: Wallet address

### Get Wallets and Points

- **URL**: `/get-wallets-and-points`
- **Method**: `GET`

### Run Cron Job (only need this if cron is being called from another server - don't need it if we run start:cron)

- **URL**: `/run-cron`
- **Method**: `GET`
- Triggered manually or via a scheduler to update quest statuses.

### Get All NFTs' Image URLs and Account Addresses

- **URL**: `/nfts`
- **Method**: `GET`
- **Description**: Retrieves all NFTs' image URLs and account addresses.

### Get Image URL by Account Address

- **URL**: `/nft-by-address`
- **Method**: `GET`
- **Query Parameters**:
  - `address`: Account address
- **Description**: Retrieves the image URL for the specified account address.
