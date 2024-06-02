import { expandTo18Decimals } from "./utilities";

export const DEFT_DEX_VERSION: string = "1";

export const PAIR_HASH: string =
  "0xbfa799faa805461955896e775b16ee35d864bd25625dfced1fa97acd0082710b";

export const MINIMUM_LIQUIDITY: bigint = 10n ** 3n;

export const TOTAL_SUPPLY: bigint = expandTo18Decimals(10000);

export const TEST_AMOUNT: bigint = expandTo18Decimals(10);

export const TEST_ADDRESSES: [string, string] = [
  "0x1000000000000000000000000000000000000000",
  "0x2000000000000000000000000000000000000000",
];
