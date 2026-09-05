// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Deterministic oracle resolver for binary markets.
///
/// The market calls `resolve` to obtain the price of the oracle asset at
/// `referenceTime`; the market itself evaluates the comparator against the
/// strike. The resolver is responsible for proving/validating the price
/// (Chainlink AggregatorV3 today, Chainlink Data Streams via a verifier in a
/// later version — do not fake Data Streams verification).
interface IOracleResolver {
    struct Health {
        bool healthy;
        int256 price;
        uint8 decimals;
        uint256 updatedAt;
        bool isStale;
        bool sequencerUp;
        bool sequencerGraceElapsed;
        bool paused;
        bool operatorPaused;
        bool tokenOraclePaused;
        bool tokenStateReadable;
        bool roundComplete;
    }

    /// @return price The resolved price of `assetKey` as of `referenceTime`.
    /// @return decimals The decimal scale of `price` (feed decimals).
    /// @dev Reverts when the oracle is unhealthy (stale, sequencer down,
    ///      paused, unconfigured, or invalid answer).
    function resolve(bytes32 assetKey, uint256 referenceTime)
        external
        view
        returns (int256 price, uint8 decimals);

    /// @notice Non-reverting health snapshot for admin/UI surfaces.
    function health(bytes32 assetKey) external view returns (Health memory);

    /// @notice Hash of the feed and health parameters used for an asset.
    /// @dev Markets snapshot this at creation so registry edits cannot silently
    ///      change an existing market's resolution terms.
    function configHash(bytes32 assetKey) external view returns (bytes32);
}
