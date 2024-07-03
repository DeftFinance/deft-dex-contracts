import { expandTo18Decimals } from "./utilities";

export const DEFT_DEX_VERSION: string = "1";

export const PAIR_HASH: string =
  "0x87440dd8806ea665341b26f03fd9bdb19d7305628689aeca26d25d181e87535f";

export const MINIMUM_LIQUIDITY: bigint = 10n ** 3n;

export const TOTAL_SUPPLY: bigint = expandTo18Decimals(10000);

export const TEST_AMOUNT: bigint = expandTo18Decimals(10);

export const TEST_ADDRESSES: [string, string] = [
  "0x1000000000000000000000000000000000000000",
  "0x2000000000000000000000000000000000000000",
];
