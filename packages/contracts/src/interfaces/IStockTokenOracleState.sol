// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Robinhood Stock Token oracle state used during corporate actions.
interface IStockTokenOracleState {
    function oraclePaused() external view returns (bool);
}
