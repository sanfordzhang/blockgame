## ADDED Requirements

### Requirement: Deploy PokerGame0G to 0G Mainnet
The system SHALL deploy the PokerGame0G smart contract to 0G Mainnet (Chain ID: 16661) using the verified source code from `contracts/0g/PokerGame0G.sol`. The deployer address (`ZEROG_PRIVATE_KEY` 对应的地址) SHALL be set as the initial ADMIN role holder.

#### Scenario: Successful deployment of PokerGame0G
- **WHEN** operator runs `ENV_FILE=.env.0g npx hardhat run deploy/deploy-0g.js --network zerogMainnet`
- **THEN** system compiles contracts and deploys PokerGame0G to 0G Mainnet
- **AND** outputs the deployed contract address and transaction hash
- **AND** saves deployment info to `deployments/zerog-zerogMainnet.json`

#### Scenario: Deployment fails due to insufficient balance
- **WHEN** deployer wallet balance is less than estimated gas cost (~0.01 0G)
- **THEN** deployment script SHALL fail with a clear error message indicating insufficient funds
- **AND** no contract shall be deployed

---

### Requirement: Deploy PokerHandINFT to 0G Mainnet
The system SHALL deploy the PokerHandINFT (ERC-7857 Interactive NFT) smart contract to 0G Mainnet using the verified source code from `contracts/0g/PokerHandINFT.sol`. This deployment MUST occur after PokerGame0G is deployed.

#### Scenario: Successful deployment of PokerHandINFT
- **WHEN** PokerGame0G deployment completes successfully
- **THEN** system deploys PokerHandINFT to 0G Mainnet
- **AND** outputs the deployed contract address and transaction hash
- **AND** includes the address in `deployments/zerog-zerogMainnet.json`

#### Scenario: PokerHandINFT deployment fails after PokerGame0G success
- **WHEN** PokerGame0G is deployed but PokerHandINFT deployment fails (e.g., network error)
- **THEN** script SHALL exit with error code 1
- **AND** PokerGame0G deployment remains valid on-chain (no rollback needed)
- **AND** operator can re-run script (idempotent role grants handle re-deployment)

---

### Requirement: Configure Role Authorization on Mainnet Contracts
The system SHALL grant blockchain roles after both contracts are deployed:
1. **OPERATOR_ROLE on PokerGame0G** → granted to `ZEROG_SERVER_WALLET` address (`0x99085cC35625b9992bCB60Ae4c269740B6a1D4dc`)
2. **MINTER_ROLE on PokerHandINFT** → granted to the PokerGame0G contract address

#### Scenario: OPERATOR_ROLE granted to server wallet
- **WHEN** both contracts are deployed successfully AND `ZEROG_SERVER_WALLET` differs from deployer address
- **THEN** system calls `pokerGame.grantRole(OPERATOR_ROLE, ZEROG_SERVER_WALLET)`
- **AND** logs "✅ OPERATOR_ROLE granted"

#### Scenario: MINTER_ROLE granted to PokerGame0G contract
- **WHEN** both contracts are deployed successfully
- **THEN** system calls `inft.grantRole(MINTER_ROLE, pokerGameAddress)`
- **AND** logs "✅ MINTER_ROLE granted"
- **AND** PokerGame0G contract can now mint INFT tokens on behalf of players

#### Scenario: Server wallet equals deployer (skip redundant grant)
- **WHEN** `ZEROG_SERVER_WALLET` address matches the deployer address
- **THEN** system skips the OPERATOR_ROLE grant (deployer already has all roles by default)
- **AND** continues with MINTER_ROLE grant

---

### Requirement: Update Environment Configuration for Mainnet
The system SHALL update `.env.0g` configuration file with the newly deployed mainnet contract addresses:
- `ZEROG_POKERGAME_ADDRESS=<mainnet_pokergame_address>`
- `ZEROG_INFT_ADDRESS=<mainnet_inft_address>`

#### Scenario: Update .env.0g with mainnet addresses after deployment
- **WHEN** deployment completes and addresses are obtained
- **THEN** operator updates `.env.0g` with the new mainnet contract addresses
- **AND** server-side ZeroGContractService and ZeroEventListener use these addresses when `BLOCKCHAIN_MODE=zerog` or `BLOCKCHAIN_MODE=both`

#### Scenario: RPC URL points to mainnet endpoint
- **WHEN** server starts with `ENV_FILE=.env.0g`
- **THEN** `ZEROG_RPC_URL` resolves to `https://rpc.0g.ai` (mainnet)
- **AND** all blockchain interactions target Chain ID 16661

---

### Requirement: Generate Mainnet Deployment Record
The system SHALL generate a deployment record JSON file at `deployments/zerog-zerogMainnet.json` containing: network name, chain ID, deployer address, deployment timestamp, both contract addresses with txHashes, and complete role mapping.

#### Scenario: Deployment record contains complete information
- **WHEN** deployment script finishes successfully
- **THEN** `deployments/zerog-zerogMainnet.json` exists with valid JSON structure
- **AND** contains `contracts.PokerGame0G.address` and `contracts.PokerHandINFT.address`
- **AND** contains `roles.ADMIN`, `roles.OPERATOR`, `roles.MINTER` entries
- **AND** `chainId` equals 16661

---

### Requirement: Update Frontend Build Configuration
The system SHALL update `deploy/dual.sh` (or `deploy-dual.sh`) build script with the mainnet contract addresses so that the React frontend can interact with the correct mainnet contracts when users select 0G/EVM network mode.

#### Scenario: deploy-dual.sh reflects mainnet addresses
- **WHEN** mainnet deployment addresses are confirmed
- **THEN** `REACT_APP_ZEROG_POKERGAME_ADDRESS_MAINNET` in deploy-dual.sh matches deployed PokerGame0G address
- **AND** `REACT_APP_ZEROG_INFT_ADDRESS_MAINNET` in deploy-dual.sh matches deployed PokerHandINFT address
- **AND** frontend build process picks up these values for production builds
