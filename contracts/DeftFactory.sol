// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.20;

import {IDeftFactory} from "./interfaces/IDeftFactory.sol";
import {IDeftPair} from "./interfaces/IDeftPair.sol";
import {DeftPair} from "./DeftPair.sol";

contract DeftFactory is IDeftFactory {
    address public feeTo;
    address public feeToSetter;
    address[] public allPairs;
    address public router;
    address public owner;
    mapping(address => mapping(address => address)) public getPair;

    bytes32 public constant PAIR_HASH = keccak256(type(DeftPair).creationCode);

    constructor(address _feeToSetter) {
        feeToSetter = _feeToSetter;
        owner = msg.sender;
    }

    function setFeeTo(address _feeTo) external {
        require(msg.sender == feeToSetter, "DeftFactory: FORBIDDEN");
        feeTo = _feeTo;
    }

    function setFeeToSetter(address _feeToSetter) external {
        require(msg.sender == feeToSetter, "DeftFactory: FORBIDDEN");
        feeToSetter = _feeToSetter;
    }

    function setRouter(address _router) external {

        require(msg.sender == owner);
        router = _router;
    }

    function createPair(address tokenA, address tokenB)
        external
        returns (address pair)
    {
        require(tokenA != tokenB, "DeftFactory: IDENTICAL_ADDRESSES");
        (address token0, address token1) = tokenA < tokenB
            ? (tokenA, tokenB)
            : (tokenB, tokenA);
        require(token0 != address(0), "DeftFactory: ZERO_ADDRESS");
        require(
            getPair[token0][token1] == address(0),
            "DeftFactory: PAIR_EXISTS"
        ); // single check is sufficient

        bytes memory bytecode = type(DeftPair).creationCode;
        bytes32 salt = keccak256(abi.encodePacked(token0, token1));
        assembly {
            pair := create2(0, add(bytecode, 32), mload(bytecode), salt)
        }
        IDeftPair(pair).initialize(token0, token1);
        IDeftPair(pair).setRouter(router);
        getPair[token0][token1] = pair;
        getPair[token1][token0] = pair; // populate mapping in the reverse direction
        allPairs.push(pair);
        emit PairCreated(token0, token1, pair, allPairs.length);
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
}
