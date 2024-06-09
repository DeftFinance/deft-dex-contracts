// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.8.20;

import {IDeftPair} from "../interfaces/IDeftPair.sol";

library SwapLib {

    int32 public constant LOWER_THRESHOLD_LIMIT = -250;
    int32 public constant UPPER_THRESHOLD_LIMIT = 334;
    int32 public constant LOWER_STOP_LIMIT = -500;
    int32 public constant UPPER_STOP_LIMIT = 1000;

    // Linear Regresion parameters
    int64 public constant REGRESSION_BASIS_POINT = 1_000_000;
    int64 public constant A_LEFT = -184_478;
    int64 public constant B_LEFT = -42_957;

    int64 public constant A_RIGHT = 71_226;
    int64 public constant B_RIGHT = -20_084;

    struct DeltaCalcParams{
        address token0;
        address token1;
        uint256 amount0Out;
        uint256 amount1Out;
        uint112 reserve0; 
        uint112 reserve1;
    }

    function applyDeltaAlgorithm(DeltaCalcParams calldata _deltaParams) public view returns(uint correctedFee) {

        int256 delta = _calculateDelta(_deltaParams);
        correctedFee = _calculateThreshold(delta, 3);
    }

    function _calculateDelta(
        DeltaCalcParams memory _deltaParams
    ) 
        public 
        view
        returns(int256 delta) 
    {

        uint256 balance0 = IERC20(_deltaParams.token0).balanceOf(address(this));
        uint256 balance1 = IERC20(_deltaParams.token1).balanceOf(address(this));
        
        uint112 reserve0 = _deltaParams.reserve0;
        uint112 reserve1 = _deltaParams.reserve1;

        // For the very first swap if the reserves are zero just return 0
        if(reserve0 == 0 || reserve1 == 0) {
            return (0);
        }

        uint256 price_init = 1000000 * _deltaParams.reserve0 / _deltaParams.reserve1;
        uint256 price_final = (_deltaParams.amount0Out != 0) ? 
            (1000000 * (_deltaParams.amount0Out + reserve0)) / (balance1) : 
            (1000000 * balance0) / (_deltaParams.amount1Out + reserve1);

        delta = (int256(1000 * price_final / price_init) - 1000);

    }

    function _calculateModifiedFee(int64 a, int64 b, int delta) public pure returns(int256 correctedFee) {

        return (((a * delta) + (1000 * b)) / REGRESSION_BASIS_POINT);
    }

    function _calculateStopCF() internal pure returns(uint correctedFee) {

        return 60;
    }

    function _calculateThreshold(
        int256 delta, 
        uint inputFee 
    )   
        public 
        pure 
        returns(uint outputFee) 
    {

        if(delta >= LOWER_THRESHOLD_LIMIT && delta <= UPPER_THRESHOLD_LIMIT) {
            
            return inputFee;
        }

        else if(delta >= LOWER_STOP_LIMIT && delta < LOWER_THRESHOLD_LIMIT) {
            // a(delta) + b
            outputFee = inputFee + uint256(_calculateModifiedFee(A_LEFT, B_LEFT, delta));
        }

        else if(delta > UPPER_THRESHOLD_LIMIT && delta <= UPPER_STOP_LIMIT) {
            // a(delta) + b
            outputFee = inputFee + uint256(_calculateModifiedFee(A_RIGHT, B_RIGHT, delta));
        }

        else {
            // apply higher gas fee
            outputFee = _calculateStopCF();
        }
    }
}