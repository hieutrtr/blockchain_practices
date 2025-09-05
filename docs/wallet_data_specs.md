# Wallet Data: Acquisition & Sources

This section explains the **types of data a wallet exposes**, and where developers can get them, even without being a blockchain expert.

## 11.1 Identity (Keys & Accounts)

* **Data**: public address, private key/seed phrase, derivation paths.
* **Source**: Generated locally in wallet software; libraries like `ethers.js`, `web3.js`, `bip39`.
* **Note**: Only **public addresses** should be sent to servers. Keys must never leave the user's device.

## 11.2 Balances

* **Data**: native token balance (ETH, SOL, BTC) + token balances (ERC‑20, NFTs).
* **Source**: Node RPC (`eth_getBalance`, `balanceOf` calls) or API providers (Infura, Alchemy, QuickNode, Moralis, Covalent).

## 11.3 Transactions

* **Data**: tx hash, sender, receiver, gas used, status, logs.
* **Source**: Blockchain RPC (`eth_getTransactionByHash`, `eth_getTransactionReceipt`), block explorers (Etherscan API, Blockchair).

## 11.4 Token & NFT Metadata

* **Data**: token name, symbol, decimals, NFT images/traits.
* **Source**: Smart contracts (`symbol()`, `tokenURI()`), NFT marketplaces (OpenSea API, MagicEden API).

## 11.5 Approvals & Allowances

* **Data**: which contracts can spend a wallet's tokens.
* **Source**: ERC‑20 `allowance()` calls, Approval event logs, explorers.

## 11.6 DEX Swaps

* **Data**: what tokens the wallet swapped in/out, amounts, pool, protocol.
* **Source**: DEX smart contract logs (Uniswap, PancakeSwap), or DEX indexers like The Graph.

## 11.7 Liquidity Positions

* **Data**: LP tokens held, amounts deposited, share of pool.
* **Source**: Pool smart contract events (`Mint`, `Burn`, `IncreaseLiquidity`), APIs from protocols or The Graph.

## 11.8 NFT Activity

* **Data**: NFT mints, transfers, sales per wallet.
* **Source**: NFT contract `Transfer` logs, marketplaces APIs (OpenSea, LooksRare, MagicEden).

## 11.9 DeFi Positions

* **Data**: Lending, borrowing, staking, health factors.
* **Source**: Protocol contract calls (Aave, Compound), The Graph subgraphs, protocol APIs.

## 11.10 Bridges

* **Data**: cross-chain transfer details (src chain, dst chain, amounts).
* **Source**: Known bridge contracts (Polygon Bridge, Wormhole) or protocol indexers.

## 11.11 Prices

* **Data**: token USD value, historical pricing.
* **Source**: Chainlink oracles (on-chain), off-chain APIs (Coingecko, CoinMarketCap, Kaiko).

## 11.12 Indexing Services (for ease)

Instead of pulling raw RPC data, developers can use data services:

* **Covalent** – balances, transactions, NFT data.
* **Moralis** – multi-chain wallet API, token balances.
* **Alchemy/Infura/QuickNode** – reliable node RPCs.
* **The Graph** – protocol-specific subgraphs.
* **Etherscan/Blockchair** – explorer APIs.

---

**Takeaway**: Wallet data spans from raw blockchain RPC calls to enriched APIs (prices, NFT metadata, DeFi positions). As a developer, you can start with **indexing services** (Covalent, Moralis) to avoid deep blockchain plumbing, and move to direct RPC + custom parsers for more control later.
