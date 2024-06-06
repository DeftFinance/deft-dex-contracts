// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.20;

import {IDeftPair} from "../interfaces/IDeftPair.sol";
import "./DeftLib.sol";


library SwapLib {

    using DeftLib for address;
    using DeftLib for uint256;

    int32 public constant LOWER_THRESHOLD_LIMIT = -250_000;
    uint32 public constant UPPER_THRESHOLD_LIMIT = 333_333;
    uint32 public constant LOWER_STOP_LIMIT = -500_000;
    uint32 public constant UPPER_STOP_LIMIT = 1_000_000;
    uint32 public constant BASIS_POINT = 1_000_000;

    // Linear Regresion parameters
    int32 public constant A_LEFT = -184_478;
    int32 public constant B_LEFT = -39_957;

    int32 public constant A_LEFT = 71_226;
    int32 public constant B_LEFT = -15_084;

    Struct DeltaCalcParams{
        address token0;
        address token1;
        uint256 amount0Out;
        uint256 amount1Out;
        uint112 reserve0; 
        uint112 reserve1;
    }

    function applyDeltaAlgorithm(DeltaCalcParams calldata _deltaParams) internal view returns() {

        uint256 delta = _calculateDelta(_deltaParams);
        (uint256 fee, uint256 amountOut) = _calculateThreshold(delta);
    }

    function _calculateDelta(
        DeltaCalcParams memory _deltaParams
    ) 
        internal 
        pure
        returns(uint256 delta) 
    {

        uint256 balance0 = token0.balanceOf(address(this));
        uint256 balance1 = token1.balanceOf(address(this));
        uint256 reserve0 = _deltaParams.reserve0;
        uint256 reserve1 = _deltaParams.reserve1;

        // For the very first swap if the reserves are zero just return 0
        if(reserve0 == 0 || reserve1 == 0) {
            return 0;
        }

        uint256 price_init = reserve0 / reserve1;
        uint256 price_final = (_deltaParams.amount0Out > 0) ? 
            (_deltaParams.amount0Out + reserve0) / (balance1) : 
            (balance0) / (_deltaParams.amount1Out + reserve1);

        int256 delta = int(BASIS_POINT * price_final / price_init) - BASIS_POINT;

    }

    function _calculateModifiedFee() internal pure returns(uint256 il) {


    }

    function _calculateStopCF() internal pure returns() {


    }

    function _calculateThreshold(uint256 delta) internal pure returns(uint fee, uint amountOut) {

        if(delta >= LOWER_THRESHOLD_LIMIT && delta <= UPPER_THRESHOLD_LIMIT) {
            // do nothing
        }

        else if(delta >= LOWER_STOP_LIMIT && delta <= UPPER_STOP_LIMIT) {
            // a(delta) + b
        }

        else {
            // set delta to 0.5 and apply higher gas fee
            _calculateModifiedFee()
            _calculateStopCF()
        }
    }
}