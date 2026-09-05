// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IOracleResolver} from "./IOracleResolver.sol";

/// @notice Interface and shared enums for binary pooled markets.
interface IMarket {
    enum Side {
        NONE,
        YES,
        NO
    }

    enum Status {
        OPEN,
        LOCKED,
        RESOLVED,
        CANCELLED
    }

    enum Comparator {
        PRICE_ABOVE_AT_TIME,
        PRICE_BELOW_AT_TIME
    }

    function status() external view returns (Status);

    function winningOutcome() external view returns (Side);

    function resolvedPrice() external view returns (int256);

    function yesPool() external view returns (uint256);

    function noPool() external view returns (uint256);

    function userStake(address user, Side side) external view returns (uint256);

    function enterFor(address beneficiary, Side side, uint256 amount) external;

    function collateral() external view returns (IERC20);

    function resolver() external view returns (IOracleResolver);

    function oracleAssetKey() external view returns (bytes32);

    function comparator() external view returns (Comparator);

    function strike() external view returns (int256);

    function question() external view returns (string memory);
}
