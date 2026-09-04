// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BinaryPoolMarket} from "./BinaryPoolMarket.sol";
import {IMarket} from "../interfaces/IMarket.sol";

/// @notice Admin-only factory for structured template markets (MVP).
///
/// Markets are created from structured templates — no free-form arbitrary
/// outcome logic. Critical resolution terms (comparator, strike, times, fee)
/// are stored onchain and are immutable after creation.
contract MarketFactory is Ownable {
    uint256 public constant MAX_FEE_BPS = 1_000;

    BinaryPoolMarket[] public markets;
    mapping(address => uint256) public marketIndex; // 1-based; 0 = unknown

    event MarketCreated(
        uint256 indexed index, address indexed market, BinaryPoolMarket.MarketParams params
    );

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Create a new binary market. Admin-only in v0.
    function createMarket(BinaryPoolMarket.MarketParams calldata params)
        external
        onlyOwner
        returns (BinaryPoolMarket market)
    {
        require(params.feeBps <= MAX_FEE_BPS, "fee exceeds cap");
        require(params.openTime < params.lockTime, "open must be before lock");
        require(params.lockTime <= params.resolutionTime, "lock must precede resolution");
        require(params.minEntry > 0, "min entry is zero");
        require(params.strikeDecimals <= 36, "strike decimals too large");
        require(bytes(params.question).length > 0, "empty question");
        require(params.collateral != address(0), "collateral is zero");
        require(params.resolver != address(0), "resolver is zero");
        require(params.feeVault != address(0), "fee vault is zero");

        market = new BinaryPoolMarket(params);

        markets.push(market);
        marketIndex[address(market)] = markets.length;
        emit MarketCreated(markets.length - 1, address(market), params);
    }

    /// @notice Pause a market through the factory (owner only). Pause blocks
    ///         entries but never claims/refunds.
    function pauseMarket(address market) external onlyOwner {
        BinaryPoolMarket(market).pause();
    }

    function unpauseMarket(address market) external onlyOwner {
        BinaryPoolMarket(market).unpause();
    }

    function cancelMarket(address market) external onlyOwner {
        BinaryPoolMarket(market).cancel();
    }

    function marketCount() external view returns (uint256) {
        return markets.length;
    }
}
