// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.20;

import {IDeftPair} from "../interfaces/IDeftPair.sol";


library SwapLib {

    int32 public constant LOWER_THRESHOLD_LIMIT = -250;
    uint32 public constant UPPER_THRESHOLD_LIMIT = 333;
    uint32 public constant LOWER_STOP_LIMIT = -500;
    uint32 public constant UPPER_STOP_LIMIT = 1000;
    uint32 public constant BASIS_POINT = 1000;

    // Linear Regresion parameters
    uint32 public constant REGRESSION_BASIS_POINT = 1_000_000;
    int32 public constant A_LEFT = -184_478;
    int32 public constant B_LEFT = -39_957;

    int32 public constant A_RIGHT = 71_226;
    int32 public constant B_RIGHT = -15_084;

    struct DeltaCalcParams{
        address token0;
        address token1;
        uint256 amount0Out;
        uint256 amount1Out;
        uint112 reserve0; 
        uint112 reserve1;
    }

    function applyDeltaAlgorithm(DeltaCalcParams calldata _deltaParams) public view returns(uint correctedFee) {

        uint256 delta = _calculateDelta(_deltaParams);
        correctedFee = _calculateThreshold(delta, 3);
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

    function _calculateModifiedFee(uint a, uint b, uint delta) internal pure returns(uint256 correctedFee) {

        return  3 + ((a * delta + b) / REGRESSION_BASIS_POINT);
    }

    function _calculateStopCF() internal pure returns(uint correctedFee) {

        return 60;
    }

    function _calculateThreshold(
        uint256 delta, 
        uint inputFee
    )   
        internal 
        pure 
        returns(uint outputFee) 
    {

        if(delta >= LOWER_THRESHOLD_LIMIT && delta <= UPPER_THRESHOLD_LIMIT) {
            
            return inputFee;
        }

        else if(delta >= LOWER_STOP_LIMIT && delta < LOWER_THRESHOLD_LIMIT) {
            // a(delta) + b
            outputFee = _calculateModifiedFee(A_LEFT, B_LEFT, delta);
        }

        else if(delta > UPPER_THRESHOLD_LIMIT && delta <= UPPER_STOP_LIMIT) {
            // a(delta) + b
            outputFee = _calculateModifiedFee(A_RIGHT, B_RIGHT, delta);
        }

        else {
            // set delta to 0.5 and apply higher gas fee
            outputFee = _calculateStopCF()
        }
    }
}