// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOracleResolver} from "../interfaces/IOracleResolver.sol";

/// @notice Resolves scheduled closing-price markets from observations published
/// by protocol governance after checking the market's named public sources.
///
/// The owner is expected to be the protocol timelock controlled by a Safe.
/// Every observation is public, evidence-bound, and delayed before use so an
/// incorrect proposal can be cancelled before a market resolves.
contract SafeClosingPriceResolver is Ownable, IOracleResolver {
    address public immutable guardian;

    struct AssetConfig {
        uint8 decimals;
        uint64 challengePeriod;
        uint64 maxObservationDelay;
        bool paused;
        bool exists;
    }

    struct Observation {
        int256 price;
        uint64 proposedAt;
        bytes32 evidenceHash;
        bool cancelled;
    }

    mapping(bytes32 assetKey => AssetConfig) public configs;
    mapping(bytes32 assetKey => mapping(uint256 referenceTime => Observation)) public observations;

    event AssetConfigured(
        bytes32 indexed assetKey,
        uint8 decimals,
        uint64 challengePeriod,
        uint64 maxObservationDelay,
        bool paused
    );
    event AssetPaused(bytes32 indexed assetKey, bool paused);
    event ObservationProposed(
        bytes32 indexed assetKey,
        uint256 indexed referenceTime,
        int256 price,
        bytes32 indexed evidenceHash,
        string evidenceUri,
        uint256 usableAt
    );
    event ObservationCancelled(bytes32 indexed assetKey, uint256 indexed referenceTime);

    constructor(address initialOwner, address guardian_) Ownable(initialOwner) {
        require(guardian_ != address(0), "guardian is zero");
        guardian = guardian_;
    }

    function setAssetConfig(
        bytes32 assetKey,
        uint8 decimals,
        uint64 challengePeriod,
        uint64 maxObservationDelay,
        bool paused
    ) external onlyOwner {
        require(assetKey != bytes32(0), "asset key is zero");
        require(decimals <= 36, "decimals too large");
        require(challengePeriod >= 1 hours && challengePeriod <= 7 days, "invalid challenge period");
        require(
            maxObservationDelay > 0 && maxObservationDelay <= 7 days, "invalid observation delay"
        );

        configs[assetKey] = AssetConfig({
            decimals: decimals,
            challengePeriod: challengePeriod,
            maxObservationDelay: maxObservationDelay,
            paused: paused,
            exists: true
        });
        emit AssetConfigured(assetKey, decimals, challengePeriod, maxObservationDelay, paused);
    }

    function setPaused(bytes32 assetKey, bool paused) external onlyOwner {
        require(configs[assetKey].exists, "asset not configured");
        configs[assetKey].paused = paused;
        emit AssetPaused(assetKey, paused);
    }

    /// @notice Publish one immutable observation and its public evidence pack.
    /// @dev `evidenceHash` should be the hash of a canonical evidence document
    /// containing all sources, retrieval times, corporate-action checks and the
    /// calculation used to select the submitted closing price.
    function proposeObservation(
        bytes32 assetKey,
        uint256 referenceTime,
        int256 price,
        bytes32 evidenceHash,
        string calldata evidenceUri
    ) external onlyOwner {
        AssetConfig memory cfg = configs[assetKey];
        require(cfg.exists, "asset not configured");
        require(!cfg.paused, "oracle paused");
        require(price > 0, "invalid price");
        require(evidenceHash != bytes32(0), "evidence hash is zero");
        require(bytes(evidenceUri).length > 0, "evidence URI is empty");
        require(referenceTime <= block.timestamp, "reference is in future");
        require(
            block.timestamp - referenceTime <= cfg.maxObservationDelay,
            "observation submitted too late"
        );
        require(observations[assetKey][referenceTime].proposedAt == 0, "observation already exists");

        observations[assetKey][referenceTime] = Observation({
            price: price,
            proposedAt: uint64(block.timestamp),
            evidenceHash: evidenceHash,
            cancelled: false
        });
        emit ObservationProposed(
            assetKey,
            referenceTime,
            price,
            evidenceHash,
            evidenceUri,
            block.timestamp + cfg.challengePeriod
        );
    }

    /// @notice Cancel a disputed observation before it can resolve a market.
    function cancelObservation(bytes32 assetKey, uint256 referenceTime) external {
        require(msg.sender == owner() || msg.sender == guardian, "not cancellation authority");
        Observation storage observation = observations[assetKey][referenceTime];
        require(observation.proposedAt != 0, "observation not found");
        require(!observation.cancelled, "observation already cancelled");
        require(
            block.timestamp < observation.proposedAt + configs[assetKey].challengePeriod,
            "challenge period elapsed"
        );
        observation.cancelled = true;
        emit ObservationCancelled(assetKey, referenceTime);
    }

    function resolve(bytes32 assetKey, uint256 referenceTime, bytes calldata proof)
        external
        view
        returns (int256 price, uint8 decimals)
    {
        AssetConfig memory cfg = configs[assetKey];
        require(cfg.exists, "asset not configured");
        require(!cfg.paused, "oracle paused");
        require(proof.length == 0, "proof must be empty");

        Observation memory observation = observations[assetKey][referenceTime];
        require(observation.proposedAt != 0, "observation not found");
        require(!observation.cancelled, "observation cancelled");
        require(
            block.timestamp >= observation.proposedAt + cfg.challengePeriod,
            "challenge period active"
        );
        return (observation.price, cfg.decimals);
    }

    function health(bytes32 assetKey) external view returns (Health memory h) {
        AssetConfig memory cfg = configs[assetKey];
        if (!cfg.exists) return h;
        h.healthy = !cfg.paused;
        h.decimals = cfg.decimals;
        h.sequencerUp = true;
        h.sequencerGraceElapsed = true;
        h.paused = cfg.paused;
        h.operatorPaused = cfg.paused;
        h.tokenStateReadable = true;
        h.roundComplete = true;
    }

    /// @notice Whether a specific close has been published and remains usable.
    /// @dev Markets use this optional status hook after their oracle timeout so
    /// missing or cancelled observations cannot block permissionless refunds.
    function resolutionAvailable(bytes32 assetKey, uint256 referenceTime)
        external
        view
        returns (bool)
    {
        Observation memory observation = observations[assetKey][referenceTime];
        return observation.proposedAt != 0 && !observation.cancelled;
    }

    function configHash(bytes32 assetKey) external view returns (bytes32) {
        AssetConfig memory cfg = configs[assetKey];
        if (!cfg.exists) return bytes32(0);
        return keccak256(
            abi.encode(
                address(this), guardian, cfg.decimals, cfg.challengePeriod, cfg.maxObservationDelay
            )
        );
    }
}
