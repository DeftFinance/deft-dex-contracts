// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.20;

interface IDeftFactory {
    event PairCreated(
        address indexed token0,
        address indexed token1,
        address indexed pair,
        uint256 totalPairs
    );

    function setFeeTo(address) external;

    function setFeeToSetter(address) external;

    function createPair(address tokenA, address tokenB)
        external
        returns (address pair);

    function feeTo() external view returns (address);

    function feeToSetter() external view returns (address);

    function allPairs(uint256) external view returns (address pair);

    function getPair(address tokenA, address tokenB)
        external
        view
        returns (address pair);

    function allPairsLength() external view returns (uint256);

    function PAIR_HASH() external pure returns (bytes32);
}
