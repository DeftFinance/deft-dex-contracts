// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console2} from "forge-std/Test.sol";
import {DeftLib} from "../contracts/libraries/DeftLib.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract DeftLibTest is Test{

    ERC20Mock public token0;
    ERC20Mock public token1;

    function setUp() public {

        token0 = new ERC20Mock();
        token0.mint(address(this), 100 ether);
        token1 = new ERC20Mock();
        token1.mint(address(this), 100 ether);

        deal(address(token0), address(this), 100 ether);
        deal(address(token1), address(this), 100 ether);
    }

    function testCalculateDelta() public {

    }

    function testCorrectedFee() public {

    }

}