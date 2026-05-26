import { getAddress } from "viem";

export const BLINK_TOKEN_ROUTE = "/token";

export const BLINK_TOKEN_HEADLINE = "BLINK Token";

export const BLINK_TOKEN_SUBHEAD =
  "Support Blink's bootstrap budget and help fund faster shipping.";

export const BLINK_TOKEN_GOAL_ETH = 100;

export const BLINK_TOKEN_ADDRESS = getAddress(
  "0x13a34e71bb46Eb20eBedd5cBA68210d663127b07",
);

export const BLINK_TOKEN_CREATOR_ADDRESS = getAddress(
  "0xc7BcB2EeE9BbFbf875499960746Bc52B2E1A75C6",
);

export const CLANKER_FEE_LOCKER_ADDRESS = getAddress(
  "0xF3622742b1E446D92e45E22923Ef11C2fcD55D68",
);

export const BASE_WETH_ADDRESS = getAddress(
  "0x4200000000000000000000000000000000000006",
);

export const BLINK_TOKEN_CLANKER_URL =
  "https://www.clanker.world/clanker/0x13a34e71bb46Eb20eBedd5cBA68210d663127b07";

export const BLINK_TOKEN_FOMO_URL = "https://fomo.family/r/rokitg";
