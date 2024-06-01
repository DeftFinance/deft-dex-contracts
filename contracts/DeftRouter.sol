// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.20;

import {IDeftFactory} from "./interfaces/IDeftFactory.sol";
import {IDeftRouter} from "./interfaces/IDeftRouter.sol";
import {IDeftPair} from "./interfaces/IDeftPair.sol";
import {INativeCoin} from "./interfaces/INativeCoin.sol";
import {IERC20} from "./interfaces/IERC20.sol";
import {DeftLib} from "./libraries/DeftLib.sol";
import {TransferHelper} from "./libraries/TransferHelper.sol";

contract DeftRouter is IDeftRouter {
    using DeftLib for address;
    using DeftLib for uint256;

    //solhint-disable-next-line immutable-vars-naming
    address public immutable FACTORY;
    address public immutable NATIVE_COIN;

    modifier ensure(uint256 deadline) {
        require(deadline >= block.timestamp, "DeftRouter: EXPIRED");
        _;
    }

    constructor(address factory, address nativeCoin) {
        require(
            factory != address(0) && nativeCoin != address(nativeCoin),
            "DeftRouter: ZERO_ADDRESS"
        );

        FACTORY = factory;
        NATIVE_COIN = nativeCoin;
    }

    receive() external payable {
        assert(msg.sender == NATIVE_COIN); // only accept ETH via fallback from the NATIVE_COIN contract
    }

    function swapExactTokensForTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = FACTORY.getAmountsOut(amountIn, path);
        require(
            amounts[amounts.length - 1] >= amountOutMin,
            "DeftRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        TransferHelper.safeTransferFrom(
            path[0],
            msg.sender,
            FACTORY.pairFor(path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, to);
    }

    function swapTokensForExactTokens(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        amounts = FACTORY.getAmountsIn(amountOut, path);
        require(
            amounts[0] <= amountInMax,
            "DeftRouter: EXCESSIVE_INPUT_AMOUNT"
        );
        TransferHelper.safeTransferFrom(
            path[0],
            msg.sender,
            FACTORY.pairFor(path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, to);
    }

    function swapExactETHForTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        require(path[0] == NATIVE_COIN, "DeftRouter: INVALID_PATH");
        amounts = FACTORY.getAmountsOut(msg.value, path);
        require(
            amounts[amounts.length - 1] >= amountOutMin,
            "DeftRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        INativeCoin(NATIVE_COIN).deposit{value: amounts[0]}();
        assert(
            INativeCoin(NATIVE_COIN).transfer(
                FACTORY.pairFor(path[0], path[1]),
                amounts[0]
            )
        );
        _swap(amounts, path, to);
    }

    function swapTokensForExactETH(
        uint256 amountOut,
        uint256 amountInMax,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(
            path[path.length - 1] == NATIVE_COIN,
            "DeftRouter: INVALID_PATH"
        );
        amounts = FACTORY.getAmountsIn(amountOut, path);
        require(
            amounts[0] <= amountInMax,
            "DeftRouter: EXCESSIVE_INPUT_AMOUNT"
        );
        TransferHelper.safeTransferFrom(
            path[0],
            msg.sender,
            FACTORY.pairFor(path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, address(this));
        INativeCoin(NATIVE_COIN).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }

    function swapExactTokensForETH(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) returns (uint256[] memory amounts) {
        require(
            path[path.length - 1] == NATIVE_COIN,
            "DeftRouter: INVALID_PATH"
        );
        amounts = FACTORY.getAmountsOut(amountIn, path);
        require(
            amounts[amounts.length - 1] >= amountOutMin,
            "DeftRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        TransferHelper.safeTransferFrom(
            path[0],
            msg.sender,
            FACTORY.pairFor(path[0], path[1]),
            amounts[0]
        );
        _swap(amounts, path, address(this));
        INativeCoin(NATIVE_COIN).withdraw(amounts[amounts.length - 1]);
        TransferHelper.safeTransferETH(to, amounts[amounts.length - 1]);
    }

    function swapETHForExactTokens(
        uint256 amountOut,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) returns (uint256[] memory amounts) {
        uint256 value = msg.value;
        require(path[0] == NATIVE_COIN, "DeftRouter: INVALID_PATH");
        amounts = FACTORY.getAmountsIn(amountOut, path);
        require(amounts[0] <= value, "DeftRouter: EXCESSIVE_INPUT_AMOUNT");
        INativeCoin(NATIVE_COIN).deposit{value: amounts[0]}();
        assert(
            INativeCoin(NATIVE_COIN).transfer(
                FACTORY.pairFor(path[0], path[1]),
                amounts[0]
            )
        );
        _swap(amounts, path, to);
        // refund dust eth, if any
        if (value > amounts[0])
            TransferHelper.safeTransferETH(msg.sender, value - amounts[0]);
    }

    function swapExactTokensForTokensSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) {
        TransferHelper.safeTransferFrom(
            path[0],
            msg.sender,
            FACTORY.pairFor(path[0], path[1]),
            amountIn
        );
        uint256 balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to) - balanceBefore >=
                amountOutMin,
            "DeftRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );
    }

    function swapExactETHForTokensSupportingFeeOnTransferTokens(
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external payable ensure(deadline) {
        require(path[0] == NATIVE_COIN, "DeftRouter: INVALID_PATH");
        uint256 amountIn = msg.value;
        INativeCoin(NATIVE_COIN).deposit{value: amountIn}();
        assert(
            INativeCoin(NATIVE_COIN).transfer(
                FACTORY.pairFor(path[0], path[1]),
                amountIn
            )
        );
        uint256 balanceBefore = IERC20(path[path.length - 1]).balanceOf(to);
        _swapSupportingFeeOnTransferTokens(path, to);
        require(
            IERC20(path[path.length - 1]).balanceOf(to) - balanceBefore >=
                amountOutMin,
            "DeftRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );
    }

    function swapExactTokensForETHSupportingFeeOnTransferTokens(
        uint256 amountIn,
        uint256 amountOutMin,
        address[] calldata path,
        address to,
        uint256 deadline
    ) external ensure(deadline) {
        require(
            path[path.length - 1] == NATIVE_COIN,
            "DeftRouter: INVALID_PATH"
        );
        TransferHelper.safeTransferFrom(
            path[0],
            msg.sender,
            FACTORY.pairFor(path[0], path[1]),
            amountIn
        );
        _swapSupportingFeeOnTransferTokens(path, address(this));
        uint256 amountOut = IERC20(NATIVE_COIN).balanceOf(address(this));
        require(
            amountOut >= amountOutMin,
            "DeftRouter: INSUFFICIENT_OUTPUT_AMOUNT"
        );
        INativeCoin(NATIVE_COIN).withdraw(amountOut);
        TransferHelper.safeTransferETH(to, amountOut);
    }

    function addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    )
        external
        ensure(deadline)
        returns (
            uint256 amountA,
            uint256 amountB,
            uint256 liquidity
        )
    {
        address sender = msg.sender;
        (amountA, amountB) = _addLiquidity(
            tokenA,
            tokenB,
            amountADesired,
            amountBDesired,
            amountAMin,
            amountBMin
        );
        address pair = FACTORY.pairFor(tokenA, tokenB);
        TransferHelper.safeTransferFrom(tokenA, sender, pair, amountA);
        TransferHelper.safeTransferFrom(tokenB, sender, pair, amountB);
        liquidity = IDeftPair(pair).mint(to);
    }

    function addLiquidityETH(
        address token,
        uint256 amountTokenDesired,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    )
        external
        payable
        ensure(deadline)
        returns (
            uint256 amountToken,
            uint256 amountETH,
            uint256 liquidity
        )
    {
        uint256 value = msg.value;
        (amountToken, amountETH) = _addLiquidity(
            token,
            NATIVE_COIN,
            amountTokenDesired,
            value,
            amountTokenMin,
            amountETHMin
        );
        address pair = FACTORY.pairFor(token, NATIVE_COIN);
        TransferHelper.safeTransferFrom(token, msg.sender, pair, amountToken);
        INativeCoin(NATIVE_COIN).deposit{value: amountETH}();
        assert(INativeCoin(NATIVE_COIN).transfer(pair, amountETH));
        liquidity = IDeftPair(pair).mint(to);
        // refund dust eth, if any
        if (value > amountETH)
            TransferHelper.safeTransferETH(msg.sender, value - amountETH);
    }

    function removeLiquidityWithPermit(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline,
        bool approveMax,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 amountA, uint256 amountB) {
        address pair = FACTORY.pairFor(tokenA, tokenB);
        uint256 value = approveMax ? type(uint256).max : liquidity;
        IDeftPair(pair).permit(
            msg.sender,
            address(this),
            value,
            deadline,
            v,
            r,
            s
        );
        (amountA, amountB) = removeLiquidity(
            tokenA,
            tokenB,
            liquidity,
            amountAMin,
            amountBMin,
            to,
            deadline
        );
    }

    function removeLiquidityETHWithPermit(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline,
        bool approveMax,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 amountToken, uint256 amountETH) {
        address pair = FACTORY.pairFor(token, NATIVE_COIN);
        uint256 value = approveMax ? type(uint256).max : liquidity;
        IDeftPair(pair).permit(
            msg.sender,
            address(this),
            value,
            deadline,
            v,
            r,
            s
        );
        (amountToken, amountETH) = removeLiquidityETH(
            token,
            liquidity,
            amountTokenMin,
            amountETHMin,
            to,
            deadline
        );
    }

    function removeLiquidityETHWithPermitSupportingFeeOnTransferTokens(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline,
        bool approveMax,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external returns (uint256 amountETH) {
        address pair = FACTORY.pairFor(token, NATIVE_COIN);
        uint256 value = approveMax ? type(uint256).max : liquidity;
        IDeftPair(pair).permit(
            msg.sender,
            address(this),
            value,
            deadline,
            v,
            r,
            s
        );
        amountETH = removeLiquidityETHSupportingFeeOnTransferTokens(
            token,
            liquidity,
            amountTokenMin,
            amountETHMin,
            to,
            deadline
        );
    }

    function removeLiquidity(
        address tokenA,
        address tokenB,
        uint256 liquidity,
        uint256 amountAMin,
        uint256 amountBMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountA, uint256 amountB) {
        address pair = FACTORY.pairFor(tokenA, tokenB);
        IDeftPair(pair).transferFrom(msg.sender, pair, liquidity); // send liquidity to pair
        (uint256 amount0, uint256 amount1) = IDeftPair(pair).burn(to);
        (address token0, ) = tokenA.sortTokens(tokenB);
        (amountA, amountB) = tokenA == token0
            ? (amount0, amount1)
            : (amount1, amount0);
        require(amountA >= amountAMin, "DeftRouter: INSUFFICIENT_A_AMOUNT");
        require(amountB >= amountBMin, "DeftRouter: INSUFFICIENT_B_AMOUNT");
    }

    function removeLiquidityETH(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountToken, uint256 amountETH) {
        (amountToken, amountETH) = removeLiquidity(
            token,
            NATIVE_COIN,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(token, to, amountToken);
        INativeCoin(NATIVE_COIN).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    function removeLiquidityETHSupportingFeeOnTransferTokens(
        address token,
        uint256 liquidity,
        uint256 amountTokenMin,
        uint256 amountETHMin,
        address to,
        uint256 deadline
    ) public ensure(deadline) returns (uint256 amountETH) {
        (, amountETH) = removeLiquidity(
            token,
            NATIVE_COIN,
            liquidity,
            amountTokenMin,
            amountETHMin,
            address(this),
            deadline
        );
        TransferHelper.safeTransfer(
            token,
            to,
            IERC20(token).balanceOf(address(this))
        );
        INativeCoin(NATIVE_COIN).withdraw(amountETH);
        TransferHelper.safeTransferETH(to, amountETH);
    }

    function getAmountsOut(uint256 amountIn, address[] memory path)
        external
        view
        returns (uint256[] memory amounts)
    {
        return FACTORY.getAmountsOut(amountIn, path);
    }

    function getAmountsIn(uint256 amountOut, address[] memory path)
        external
        view
        returns (uint256[] memory amounts)
    {
        return FACTORY.getAmountsIn(amountOut, path);
    }

    function quote(
        uint256 amountA,
        uint256 reserveA,
        uint256 reserveB
    ) external pure returns (uint256 amountB) {
        return amountA.quote(reserveA, reserveB);
    }

    function getAmountOut(
        uint256 amountIn,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256 amountOut) {
        return amountIn.getAmountOut(reserveIn, reserveOut);
    }

    function getAmountIn(
        uint256 amountOut,
        uint256 reserveIn,
        uint256 reserveOut
    ) external pure returns (uint256 amountIn) {
        return amountOut.getAmountIn(reserveIn, reserveOut);
    }

    function _addLiquidity(
        address tokenA,
        address tokenB,
        uint256 amountADesired,
        uint256 amountBDesired,
        uint256 amountAMin,
        uint256 amountBMin
    ) private returns (uint256 amountA, uint256 amountB) {
        // create the pair if it doesn't exist yet
        if (IDeftFactory(FACTORY).getPair(tokenA, tokenB) == address(0)) {
            IDeftFactory(FACTORY).createPair(tokenA, tokenB);
        }
        (uint256 reserveA, uint256 reserveB) = FACTORY.getReserves(
            tokenA,
            tokenB
        );
        if (reserveA == 0 && reserveB == 0) {
            (amountA, amountB) = (amountADesired, amountBDesired);
        } else {
            uint256 amountBOptimal = amountADesired.quote(reserveA, reserveB);
            if (amountBOptimal <= amountBDesired) {
                require(
                    amountBOptimal >= amountBMin,
                    "DeftRouter: INSUFFICIENT_B_AMOUNT"
                );
                (amountA, amountB) = (amountADesired, amountBOptimal);
            } else {
                uint256 amountAOptimal = amountBDesired.quote(
                    reserveB,
                    reserveA
                );
                assert(amountAOptimal <= amountADesired);
                require(
                    amountAOptimal >= amountAMin,
                    "DeftRouter: INSUFFICIENT_A_AMOUNT"
                );
                (amountA, amountB) = (amountAOptimal, amountBDesired);
            }
        }
    }

    // requires the initial amount to have already been sent to the first pair
    function _swap(
        uint256[] memory amounts,
        address[] memory path,
        address _to
    ) private {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = input.sortTokens(output);
            uint256 amountOut = amounts[i + 1];
            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOut)
                : (amountOut, uint256(0));
            address to = i < path.length - 2
                ? FACTORY.pairFor(output, path[i + 2])
                : _to;
            IDeftPair(FACTORY.pairFor(input, output)).swap(
                amount0Out,
                amount1Out,
                to,
                new bytes(0)
            );
        }
    }

    // requires the initial amount to have already been sent to the first pair
    function _swapSupportingFeeOnTransferTokens(
        address[] memory path,
        address _to
    ) private {
        for (uint256 i; i < path.length - 1; i++) {
            (address input, address output) = (path[i], path[i + 1]);
            (address token0, ) = input.sortTokens(output);
            IDeftPair pair = IDeftPair(FACTORY.pairFor(input, output));
            uint256 amountInput;
            uint256 amountOutput;
            {
                // scope to avoid stack too deep errors
                (uint256 reserve0, uint256 reserve1, ) = pair.getReserves();
                (uint256 reserveInput, uint256 reserveOutput) = input == token0
                    ? (reserve0, reserve1)
                    : (reserve1, reserve0);
                amountInput =
                    IERC20(input).balanceOf(address(pair)) -
                    reserveInput;
                amountOutput = amountInput.getAmountOut(
                    reserveInput,
                    reserveOutput
                );
            }
            (uint256 amount0Out, uint256 amount1Out) = input == token0
                ? (uint256(0), amountOutput)
                : (amountOutput, uint256(0));
            address to = i < path.length - 2
                ? FACTORY.pairFor(output, path[i + 2])
                : _to;
            pair.swap(amount0Out, amount1Out, to, new bytes(0));
        }
    }
}
