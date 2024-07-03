// // SPDX-License-Identifier: UNLICENSED
// pragma solidity ^0.8.13;

// import {Test, console2} from "forge-std/Test.sol";
// import {SwapLib} from "../contracts/libraries/SwapLib.sol";
// import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
// import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

// contract SwapLibTest is Test{

//     ERC20Mock public token0;
//     ERC20Mock public token1;

//     function setUp() public {

//         token0 = new ERC20Mock();
//         token0.mint(address(this), 100 ether);
//         token1 = new ERC20Mock();
//         token1.mint(address(this), 100 ether);

//         deal(address(token0), address(this), 100 ether);
//         deal(address(token1), address(this), 100 ether);
//     }

//     function testCalculateDelta() public {

//         SwapLib.DeltaCalcParams memory deltaParams = SwapLib.DeltaCalcParams(
//             address(token0),
//             address(token1),
//             0,
//             10 ether,
//             110 ether,
//             90 ether
//         );

//         int delta = SwapLib._calculateDelta(deltaParams);
//         console2.log("Delta is: ", delta);
//         assertEq(delta, -182);
//     }

//     function testCorrectedFee() public {

//         int delta = 4000;
//         uint modifiedFee = SwapLib._calculateThreshold(delta, 3);
//         console2.log("Corrected fee is: ", modifiedFee);
//         assertEq(modifiedFee, 39);

//         delta = -800;
//         modifiedFee = SwapLib._calculateThreshold(delta, 3);
//         console2.log("Corrected fee is: ", modifiedFee);
//         assertEq(modifiedFee, 34);

//         delta = 0;
//         modifiedFee = SwapLib._calculateThreshold(delta, 3);
//         console2.log("Corrected fee is: ", modifiedFee);
//         assertEq(modifiedFee, 3);

//         delta = -500;
//         modifiedFee = SwapLib._calculateThreshold(delta, 3);
//         console2.log("Corrected fee is: ", modifiedFee);
//         assertEq(modifiedFee, 20);
//     }

// }