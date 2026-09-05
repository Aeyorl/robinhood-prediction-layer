// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";
import {IOracleResolver} from "../interfaces/IOracleResolver.sol";
import {IStockTokenOracleState} from "../interfaces/IStockTokenOracleState.sol";
import {OracleRegistry} from "./OracleRegistry.sol";

/// @notice Chainlink AggregatorV3 resolver with fail-closed health checks.
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
        registry.get(assetKey);
        Health memory h = health(assetKey);
        require(h.sequencerUp, "sequencer down");
        require(h.sequencerGraceElapsed, "sequencer grace not elapsed");
        require(h.tokenStateReadable, "oracle pause unreadable");
        require(!h.paused, "oracle paused");
        require(h.price > 0, "invalid answer");
        require(h.updatedAt > 0, "no update");
        require(h.roundComplete, "incomplete round");
        require(!h.isStale, "stale feed");
        return (h.price, h.decimals);
    }

    function health(bytes32 assetKey) public view returns (Health memory h) {
        OracleRegistry.AssetConfig memory cfg = configOrZero(assetKey);
        if (!cfg.exists) return h;

        (h.sequencerUp, h.sequencerGraceElapsed) =
            _sequencerStatus(cfg.sequencerFeed, cfg.sequencerGracePeriod);
        h.operatorPaused = cfg.paused;
        h.tokenStateReadable = cfg.oraclePauseToken == address(0);
        if (cfg.oraclePauseToken != address(0)) {
            try IStockTokenOracleState(cfg.oraclePauseToken).oraclePaused() returns (bool paused_) {
                h.tokenOraclePaused = paused_;
                h.tokenStateReadable = true;
            } catch {}
        }
        h.paused = h.operatorPaused || h.tokenOraclePaused;

        try cfg.feed.latestRoundData() returns (
            uint80 roundId, int256 answer, uint256, uint256 updatedAt, uint80 answeredInRound
        ) {
            h.price = answer;
            h.updatedAt = updatedAt;
            h.roundComplete = answeredInRound >= roundId;
            h.isStale = updatedAt == 0 || updatedAt > block.timestamp
                || block.timestamp - updatedAt > cfg.heartbeat;
        } catch {
            h.isStale = true;
        }

        try cfg.feed.decimals() returns (uint8 decimals_) {
            h.decimals = decimals_;
        } catch {
            h.roundComplete = false;
        }

        h.healthy = h.sequencerUp && h.sequencerGraceElapsed && h.tokenStateReadable && !h.paused
            && h.price > 0 && h.updatedAt > 0 && h.roundComplete && !h.isStale;
    }

    function configHash(bytes32 assetKey) external view returns (bytes32) {
        OracleRegistry.AssetConfig memory cfg = configOrZero(assetKey);
        if (!cfg.exists) return bytes32(0);
        return keccak256(
            abi.encode(
                address(cfg.feed),
                address(cfg.sequencerFeed),
                cfg.oraclePauseToken,
                cfg.heartbeat,
                cfg.sequencerGracePeriod
            )
        );
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
                oraclePauseToken: address(0),
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
        if (address(sequencerFeed) == address(0)) return (true, true);

        try sequencerFeed.latestRoundData() returns (
            uint80, int256 answer, uint256 startedAt, uint256, uint80
        ) {
            // Chainlink sequencer feeds use 0 = up and 1 = down.
            if (answer != 0 || startedAt == 0 || startedAt > block.timestamp) {
                return (false, false);
            }
            return (true, block.timestamp - startedAt >= gracePeriod);
        } catch {
            return (false, false);
        }
    }
}
