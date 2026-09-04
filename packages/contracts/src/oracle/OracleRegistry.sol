// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";

/// @notice Central registry of oracle asset configurations.
///
/// An `assetKey` is the canonical identifier of an oracle asset. Offchain it is
/// derived from `keccak256(abi.encode(chainId, tokenAddress))`; onchain it is
/// opaque bytes32. Token identity must always be (chainId, contractAddress),
/// never a symbol.
contract OracleRegistry is Ownable {
    struct AssetConfig {
        AggregatorV3Interface feed;
        /// @dev address(0) means no sequencer uptime feed configured.
        AggregatorV3Interface sequencerFeed;
        /// @dev Maximum allowed age of the latest round, in seconds.
        uint256 heartbeat;
        /// @dev Seconds that must elapse after the sequencer comes back up
        ///      before price feeds are trusted again.
        uint256 sequencerGracePeriod;
        /// @dev Stock-token oracle pause (corporate actions etc.).
        bool paused;
        bool exists;
    }

    mapping(bytes32 assetKey => AssetConfig) public configs;

    event AssetConfigured(
        bytes32 indexed assetKey,
        address feed,
        address sequencerFeed,
        uint256 heartbeat,
        uint256 sequencerGracePeriod,
        bool paused
    );
    event AssetPaused(bytes32 indexed assetKey, bool paused);

    constructor(address initialOwner) Ownable(initialOwner) {}

    function setAssetConfig(
        bytes32 assetKey,
        address feed_,
        address sequencerFeed_,
        uint256 heartbeat_,
        uint256 sequencerGracePeriod_,
        bool paused_
    ) external onlyOwner {
        require(feed_ != address(0), "feed is zero");
        require(heartbeat_ > 0, "heartbeat is zero");
        configs[assetKey] = AssetConfig({
            feed: AggregatorV3Interface(feed_),
            sequencerFeed: AggregatorV3Interface(sequencerFeed_),
            heartbeat: heartbeat_,
            sequencerGracePeriod: sequencerGracePeriod_,
            paused: paused_,
            exists: true
        });
        emit AssetConfigured(
            assetKey, feed_, sequencerFeed_, heartbeat_, sequencerGracePeriod_, paused_
        );
    }

    function setPaused(bytes32 assetKey, bool paused_) external onlyOwner {
        require(configs[assetKey].exists, "asset not configured");
        configs[assetKey].paused = paused_;
        emit AssetPaused(assetKey, paused_);
    }

    function get(bytes32 assetKey) external view returns (AssetConfig memory) {
        AssetConfig memory cfg = configs[assetKey];
        require(cfg.exists, "asset not configured");
        return cfg;
    }
}
