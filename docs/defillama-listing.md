# DeFiLlama listing — Blink

Blink is a **Hyperliquid builder-code frontend** ([blink.lat](https://blink.lat)). We do not custody TVL in smart contracts; listing is via **volume + fees** adapters, not the classic TVL repo.

## Builder address

| Field | Value |
|-------|--------|
| Builder wallet | `0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6` |
| Chain | Hyperliquid L1 |
| Product | Perpetuals (builder code) |
| Launch (adapter `start`) | `2026-05-23` (first builder integration in repo) |

## Submission (in progress)

PR to [DefiLlama/dimension-adapters](https://github.com/DefiLlama/dimension-adapters):

- **File:** `factory/hyperliquid.ts`
- **Slug:** `blink-perps`
- **Dashboards:** DEX volume (`dexs`) + fees (`fees`) via shared Hyperliquid builder factory

Docs:

- [How to list a DeFi project](https://docs.llama.fi/list-your-project/submit-a-project)
- [Dimensions adapters (fees / volume)](https://docs.llama.fi/list-your-project/other-dashboards)
- [Query docs via MCP](https://docs.llama.fi/list-your-project/submit-a-project.md?ask=how+to+list+hyperliquid+builder)

## After merge

1. DeFiLlama typically needs **~24h** for the UI to show new protocols.
2. If the **name / logo / website** are wrong, open a follow-up in [DefiLlama/defillama-server](https://github.com/DefiLlama/defillama-server) or ask in [Discord](https://discord.defillama.com).
3. **TVL listing** does not apply unless Blink launches on-chain pools/vaults; keep using dimensions only.

## Local test (optional)

```bash
git clone https://github.com/DefiLlama/dimension-adapters.git
cd dimension-adapters
pnpm install
# Requires Hyperliquid indexer env for live tests — ask DefiLlama if CI fails
pnpm test dexs blink-perps
pnpm test fees blink-perps
```

## Contact for reviewers

- **Website:** https://blink.lat  
- **Twitter / X:** (add handle if public)  
- **Category:** Perp DEX frontend / Hyperliquid builder  
