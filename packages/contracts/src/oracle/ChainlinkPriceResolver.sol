// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";
import {IOracleResolver} from "../interfaces/IOracleResolver.sol";
import {OracleRegistry} from "./OracleRegistry.sol";

/// @notice Deterministic Chainlink AggregatorV3 price resolver.
///
/// Validation performed before a price is accepted:
///   - asset is configured in the OracleRegistry,
///   - sequencer uptime feed is up and the grace period has elapsed,
///   - latest round answer > 0 and updatedAt > 0,
///   - the round is not stale (updatedAt within the configured heartbeat),
///   - the asset is not paused (Stock Token corporate-action pause).
///
/// Feed decimals are read dynamically via `decimals()` — never assumed to be 8.
///
/// `referenceTime` is informational for this resolver (AggregatorV3 has no
/// historical reads); the freshness check is against the live feed at
/// resolution time. A future Data Streams resolver will verify a signed report
/// covering `referenceTime`.
contract ChainlinkPriceResolver is Ownable, IOracleResolver {
    OracleRegistry public immutable registry;

    constructor(address initialOwner, OracleRegistry registry_) Ownable(initialOwner) {
        registry = registry_;
    }

    function resolve(
        bytes32 assetKey,
        uint256 /* referenceTime */
    )
        external
        view
        returns (int256 price, uint8 decimals)
    {
        OracleRegistry.AssetConfig memory cfg = registry.get(assetKey);
        (bool sequencerUp, bool sequencerGraceElapsed) =
            _sequencerStatus(cfg.sequencerFeed, cfg.sequencerGracePeriod);
        require(sequencerUp, "sequencer down");
        require(sequencerGraceElapsed, "sequencer grace not elapsed");
        require(!cfg.paused, "oracle paused");

        (, int256 answer,, uint256 updatedAt,) = cfg.feed.latestRoundData();
        require(answer > 0, "invalid answer");
        require(updatedAt > 0, "no update");
        require(block.timestamp - updatedAt <= cfg.heartbeat, "stale feed");
        return (answer, cfg.feed.decimals());
    }

    function health(bytes32 assetKey) external view returns (IOracleResolver.Health memory h) {
        OracleRegistry.AssetConfig memory cfg = configOrZero(assetKey);
        if (!cfg.exists) {
            return h; // healthy = false, everything default
        }
        (bool sequencerUp, bool sequencerGraceElapsed) =
            _sequencerStatus(cfg.sequencerFeed, cfg.sequencerGracePeriod);
        (, int256 answer,, uint256 updatedAt,) = cfg.feed.latestRoundData();
        bool stale = updatedAt == 0 || block.timestamp - updatedAt > cfg.heartbeat;
        h = IOracleResolver.Health({
            healthy: sequencerUp && sequencerGraceElapsed && !cfg.paused && answer > 0 && !stale,
            price: answer,
            decimals: cfg.feed.decimals(),
            updatedAt: updatedAt,
            isStale: stale,
            sequencerUp: sequencerUp,
            sequencerGraceElapsed: sequencerGraceElapsed,
            paused: cfg.paused
        });
    }

    function configOrZero(bytes32 assetKey)
        public
        view
        returns (OracleRegistry.AssetConfig memory)
    {
        (bool ok, bytes memory data) = address(registry)
            .staticcall(abi.encodeCall(OracleRegistry.get, (assetKey)));
        if (!ok || data.length == 0) {
            return OracleRegistry.AssetConfig({
                feed: AggregatorV3Interface(address(0)),
                sequencerFeed: AggregatorV3Interface(address(0)),
                heartbeat: 0,
                sequencerGracePeriod: 0,
                paused: false,
                exists: false
            });
        }
        return abi.decode(data, (OracleRegistry.AssetConfig));
    }

    function _sequencerStatus(AggregatorV3Interface sequencerFeed, uint256 gracePeriod)
        internal
        view
        returns (bool up, bool graceElapsed)
    {
        if (address(sequencerFeed) == address(0)) {
            return (true, true);
        }
        (, int256 answer, uint256 startedAt,,) = sequencerFeed.latestRoundData();
        if (answer != 1 || startedAt == 0) {
            return (false, false);
        }
        uint256 elapsed = block.timestamp - startedAt;
        return (true, elapsed >= gracePeriod);
    }
}
