// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockStockToken {
    bool public oraclePaused;

    function setOraclePaused(bool paused_) external {
        oraclePaused = paused_;
    }
}
