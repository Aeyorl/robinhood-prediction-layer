// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockERC20} from "./MockERC20.sol";

/// @notice Local MockUSDG with 18 decimals. Used on testnet/local because no
///         official testnet USDG address exists — never invent one.
contract MockUSDG is MockERC20 {
    constructor() MockERC20("USDG", "USDG", 18) {}
}
