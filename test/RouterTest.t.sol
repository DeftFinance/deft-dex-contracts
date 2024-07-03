// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.13;

import {Test, console2} from "forge-std/Test.sol";
import {DeftRouter} from "../contracts/DeftRouter.sol";
import {DeftFactory} from "../contracts/DeftFactory.sol";
import {IDeftRouter} from "../contracts/interfaces/IDeftRouter.sol";
import {IDeftLPT} from "../contracts/interfaces/IDeftLPT.sol";
import {WETH9} from "../contracts/test/WETH9.sol";
import {ERC20} from "../contracts/test/ERC20.sol";
import {DeftLib} from "../contracts/libraries/DeftLib.sol";
import {ERC20Mock} from "@openzeppelin/contracts/mocks/token/ERC20Mock.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract RouterTest is Test{

    DeftFactory public factory;
    DeftRouter public router;
    WETH9 public weth;
    ERC20 public token0;
    ERC20 public token1;
    address public admin;

    function setUp() public {

        admin = vm.addr(1);
        vm.label(admin, "Admin");

        vm.startPrank(admin);
        weth = new WETH9();
        vm.label(address(weth), "WETH");

        factory = new DeftFactory(admin);
        vm.label(address(factory), "Factory");

        router = new DeftRouter(address(factory), address(weth));
        vm.label(address(router), "Router");

        factory.setRouter(address(router));
        vm.stopPrank();

        token0 = new ERC20(1000e18);
        vm.label(address(token0), "Token_A");
        token1 = new ERC20(5000e18);
        vm.label(address(token1), "Token_B");

    }

    function setPair() public returns(address pair) {

        pair = factory.createPair(address(token0), address(token1));
        vm.label(pair, "Pair");

    }

    function prepareLiquidity(address pair, uint amount0, uint amount1) public {

        require(amount0 <= token0.balanceOf(address(this)), "No Balance!");
        require(amount1 <= token1.balanceOf(address(this)), "No Balance!");

        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        token0.approve(address(this), type(uint256).max);
        token1.approve(address(this), type(uint256).max);

        IDeftRouter(router).addLiquidity(
            address(token0), 
            address(token1), 
            amount0, 
            amount1, 
            (amount0 * 90) / 100, 
            (amount1 * 90) / 100, 
            address(this), 
            block.timestamp + 100);
        vm.stopPrank();

    }

    function testAddLiquidity() public {

        address user1 = vm.addr(5);
        token0.transfer(user1, 5 ether);
        token1.transfer(user1, 5 ether);
        require(token0.balanceOf(user1) == 5 ether, "Zero Balance!");
        require(token1.balanceOf(user1) == 5 ether, "Zero Balance!");

        vm.startPrank(user1);
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        token0.approve(address(this), type(uint256).max);
        token1.approve(address(this), type(uint256).max);

        IDeftRouter(router).addLiquidity(
            address(token0), 
            address(token1), 
            4.5 ether, 
            4.5 ether, 
            4 ether, 
            4 ether, 
            user1, 
            block.timestamp + 100);
        vm.stopPrank();
    }

    function testRemoveLiquidity() public {

        address user1 = vm.addr(5);
        token0.transfer(user1, 5 ether);
        token1.transfer(user1, 5 ether);
        require(token0.balanceOf(user1) == 5 ether, "Zero Balance!");
        require(token1.balanceOf(user1) == 5 ether, "Zero Balance!");

        vm.startPrank(user1);
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        token0.approve(address(this), type(uint256).max);
        token1.approve(address(this), type(uint256).max);

        IDeftRouter(router).addLiquidity(
            address(token0), 
            address(token1), 
            4.5 ether, 
            4.5 ether, 
            4 ether, 
            4 ether, 
            user1, 
            block.timestamp + 100);
        vm.stopPrank();

        vm.warp(block.timestamp + 50);

        vm.startPrank(user1);
        address pair = DeftLib.pairFor(address(factory), address(token0), address(token1));
        IDeftLPT(pair).approve(address(router), type(uint256).max);
        IDeftRouter(router).removeLiquidity(
            address(token0), 
            address(token1), 
            IDeftLPT(pair).balanceOf(user1), 
            4 ether, 
            4 ether, 
            user1, 
            block.timestamp + 100);
        vm.stopPrank();

    }

    function testSetPair() public {

        address pair = setPair();
        address pairFromFactory = DeftLib.pairFor(address(factory), address(token0), address(token1));
        assertEq(pair, pairFromFactory, "Pairs are not equal!");

    }

    function testSwapLow() public {

        address pair = setPair();
        prepareLiquidity(pair, 10 ether, 10 ether);

        address user2 = vm.addr(6);
        IDeftLPT(token0).transfer(user2, 1 ether);
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        vm.startPrank(user2);
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        IDeftRouter(router).swapExactTokensForTokens(1 ether, 0.1 ether, path, user2, block.timestamp + 100);
        vm.stopPrank();
    }

    function testSwapHigh() public {

        address pair = setPair();
        prepareLiquidity(pair, 10 ether, 10 ether);

        address user2 = vm.addr(6);
        IDeftLPT(token0).transfer(user2, 6.5 ether);
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        vm.startPrank(user2);
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        IDeftRouter(router).swapExactTokensForTokens(2 ether, 0.005 ether, path, user2, block.timestamp + 100);
        vm.stopPrank();
    }

    function testSwapDirection() public {

        address pair = setPair();
        prepareLiquidity(pair, 10 ether, 10 ether);

        address user2 = vm.addr(6);
        IDeftLPT(token0).transfer(user2, 100 ether);
        uint balanceBefore = IDeftLPT(token0).balanceOf(user2);
        console2.log("Balance Before the Swaps is: ", balanceBefore);
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        vm.startPrank(user2);
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        IDeftRouter(router).swapExactTokensForTokens(100 ether, 0.5 ether, path, user2, block.timestamp + 100);
        uint balanceAfterFirstSwap = IDeftLPT(token0).balanceOf(user2);
        console2.log("Balance After The First Swap is: ", balanceAfterFirstSwap);

        path[1] = address(token0);
        path[0] = address(token1);
        IDeftRouter(router).swapExactTokensForTokens(IDeftLPT(token1).balanceOf(user2), 0, path, user2, block.timestamp + 100);
        uint balanceAfterFinalSwap = IDeftLPT(token0).balanceOf(user2);
        console2.log("Balance After The Second Swap is: ", balanceAfterFinalSwap);
        vm.stopPrank();
    }

    function testSwapWithExactOutputs() public {

        address pair = setPair();
        prepareLiquidity(pair, 10 ether, 10 ether);

        address user2 = vm.addr(6);
        IDeftLPT(token0).transfer(user2, 5 ether);
        uint balanceBefore = IDeftLPT(token0).balanceOf(user2);
        console2.log("Balance Before the Swaps is: ", balanceBefore);
        address[] memory path = new address[](2);
        path[0] = address(token0);
        path[1] = address(token1);

        vm.startPrank(user2);
        token0.approve(address(router), type(uint256).max);
        token1.approve(address(router), type(uint256).max);
        IDeftRouter(router).swapTokensForExactTokens(3 ether, 5 ether, path, user2, block.timestamp + 100);
        uint balanceAfterFirstSwap = IDeftLPT(token0).balanceOf(user2);
        console2.log("Balance After The First Swap is: ", balanceAfterFirstSwap);

        vm.stopPrank();
    }

}