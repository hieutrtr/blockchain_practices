# Ethereum Free RPC & Testnet Access: Practical Spec

## Purpose
A concise, up-to-date spec of free/public Ethereum RPC endpoints and testnet access for PoC and early development. Includes HTTPS/WSS URLs, auth, limits caveats, and best practices.

---

## Networks Covered
- Mainnet (Ethereum)
- Testnets: Sepolia, Holesky

---

## Public/Free RPC Endpoints

### Ankr (Public, no key)
- Mainnet: `https://rpc.ankr.com/eth` · WSS: `wss://rpc.ankr.com/eth`
- Sepolia: `https://rpc.ankr.com/eth_sepolia` · WSS: `wss://rpc.ankr.com/eth_sepolia`
- Holesky: `https://rpc.ankr.com/eth_holesky` · WSS: `wss://rpc.ankr.com/eth_holesky`
- Notes: Rate limits apply; add retries + backoff; good for PoC.

### PublicNode (Public, no key)
- Mainnet: `https://ethereum-rpc.publicnode.com`
- Sepolia: `https://ethereum-sepolia.publicnode.com`
- Holesky: `https://ethereum-holesky.publicnode.com`
- Notes: Privacy-first, often low latency; consider as secondary/backup.

### Cloudflare (Public, no key)
- Mainnet: `https://cloudflare-eth.com`
- Notes: Reliable fallback; HTTPS only.

### Infura (Free tier, API key)
- Mainnet HTTPS: `https://mainnet.infura.io/v3/<PROJECT_ID>` · WSS: `wss://mainnet.infura.io/ws/v3/<PROJECT_ID>`
- Sepolia HTTPS: `https://sepolia.infura.io/v3/<PROJECT_ID>` · WSS: `wss://sepolia.infura.io/ws/v3/<PROJECT_ID>`
- Holesky HTTPS: `https://holesky.infura.io/v3/<PROJECT_ID>` · WSS: `wss://holesky.infura.io/ws/v3/<PROJECT_ID>`
- Notes: Free tier rate caps; stable infra; great for WS subscriptions.

### Alchemy (Free tier, API key)
- Mainnet HTTPS: `https://eth-mainnet.g.alchemy.com/v2/<API_KEY>` · WSS: `wss://eth-mainnet.g.alchemy.com/v2/<API_KEY>`
- Sepolia HTTPS: `https://eth-sepolia.g.alchemy.com/v2/<API_KEY>` · WSS: `wss://eth-sepolia.g.alchemy.com/v2/<API_KEY>`
- Holesky HTTPS: (check dashboard; supported via networks list)
- Notes: Generous free tier; enhanced APIs optional.

---

## Testnet Details

### Sepolia
- Chain ID: `11155111`
- Currency: `SepoliaETH`
- Explorer: `https://sepolia.etherscan.io`
- faucets: search "Sepolia faucet" (Alchemy, Infura, community faucets)
- Recommended RPC (ranked):
  1. Infura (WS for heads/logs)
  2. Alchemy (WS + APIs)
  3. Ankr/PublicNode (no key PoC)

### Holesky
- Chain ID: `17000`
- Explorer: `https://holesky.etherscan.io` (or community explorers)
- Recommended RPC: PublicNode, Ankr; Infura where available

---

## Usage Patterns

### Basic JSON-RPC (ethers v6)
```ts
import { JsonRpcProvider, WebSocketProvider } from "ethers";
const http = new JsonRpcProvider(process.env.ETH_RPC_URL);
const wss = new WebSocketProvider(process.env.ETH_WSS_URL);

// Head subscription (WS)
wss.on("block", (bn) => console.log("new block", bn));

// Batched backfill (HTTP)
const block = await http.getBlock( "latest", true );
```

### Log Subscription (WS)
```ts
wss.on({ address: ROUTER, topics: [SWAP_TOPIC] }, (log) => {
  // enqueue log for processing
});
```

### Rate Limits & Resilience
- Implement exponential backoff + jitter for `HTTP 429/5xx`.
- Auto-shrink `eth_getLogs` ranges on “too large/timeout”.
- Circuit-breaker per provider; fail over across providers.
- Idempotent writes keyed by `(chain, block_number, tx_hash, log_index)`.

---

## Best Practices
- Prefer WS for heads/logs (low latency), HTTP for backfill/retries.
- Use 2+ providers in A/B pool; health-check and rotate on failure.
- Cache static calls (token metadata) and chunk historical ranges.
- Track provider usage; stay within free-tier budgets.
- For production, add paid plans or self-run nodes (Erigon/Nethermind).

---

## Caveats
- Public endpoints can throttle or change policies; validate periodically.
- WS availability varies per provider; keep reconnect logic.
- Some enhanced APIs require keys (Alchemy/Infura features beyond raw RPC).

---

## Environment Template
```bash
# .env.sample
ETH_MAINNET_HTTP=https://rpc.ankr.com/eth
ETH_MAINNET_WSS=wss://rpc.ankr.com/eth
ETH_SEPOLIA_HTTP=https://ethereum-sepolia.publicnode.com
ETH_SEPOLIA_WSS=wss://rpc.ankr.com/eth_sepolia
ETH_HOLESKY_HTTP=https://ethereum-holesky.publicnode.com
```

---

## Change Log
- 2025-09: Initial version — Ankr/PublicNode/Cloudflare + Infura/Alchemy free tiers; Sepolia/Holesky emphasized.
