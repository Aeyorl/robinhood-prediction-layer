// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IOracleResolver} from "../interfaces/IOracleResolver.sol";
import {IVerifierProxy} from "../interfaces/IVerifierProxy.sol";

/// @notice Resolves scheduled RWA markets from verified Chainlink Data Streams
/// RWA Advanced (v11) reports.
contract DataStreamsRwaResolver is Ownable, IOracleResolver {
    struct AssetConfig {
        bytes32 feedId;
        uint8 decimals;
        uint32 expectedMarketStatus;
        uint64 maxPriceAgeNs;
        bool paused;
        bool exists;
    }

    struct ReportV11 {
        bytes32 feedId;
        uint32 validFromTimestamp;
        uint32 observationsTimestamp;
        uint192 nativeFee;
        uint192 linkFee;
        uint32 expiresAt;
        int192 mid;
        uint64 lastSeenTimestampNs;
        int192 bid;
        int192 bidVolume;
        int192 ask;
        int192 askVolume;
        int192 lastTradedPrice;
        uint32 marketStatus;
    }

    IVerifierProxy public immutable verifierProxy;
    mapping(bytes32 assetKey => AssetConfig) public configs;

    event AssetConfigured(
        bytes32 indexed assetKey,
        bytes32 indexed feedId,
        uint8 decimals,
        uint32 expectedMarketStatus,
        uint64 maxPriceAgeNs,
        bool paused
    );
    event AssetPaused(bytes32 indexed assetKey, bool paused);

    constructor(address initialOwner, IVerifierProxy verifierProxy_) Ownable(initialOwner) {
        require(address(verifierProxy_) != address(0), "verifier is zero");
        verifierProxy = verifierProxy_;
    }

    function setAssetConfig(
        bytes32 assetKey,
        bytes32 feedId,
        uint8 decimals,
        uint32 expectedMarketStatus,
        uint64 maxPriceAgeNs,
        bool paused
    ) external onlyOwner {
        require(assetKey != bytes32(0), "asset key is zero");
        require(feedId != bytes32(0), "feed id is zero");
        require(decimals <= 36, "decimals too large");
        require(expectedMarketStatus > 0 && expectedMarketStatus <= 5, "invalid market status");
        require(maxPriceAgeNs > 0, "price age is zero");

        configs[assetKey] = AssetConfig({
            feedId: feedId,
            decimals: decimals,
            expectedMarketStatus: expectedMarketStatus,
            maxPriceAgeNs: maxPriceAgeNs,
            paused: paused,
            exists: true
        });
        emit AssetConfigured(
            assetKey, feedId, decimals, expectedMarketStatus, maxPriceAgeNs, paused
        );
    }

    function setPaused(bytes32 assetKey, bool paused) external onlyOwner {
        require(configs[assetKey].exists, "asset not configured");
        configs[assetKey].paused = paused;
        emit AssetPaused(assetKey, paused);
    }

    function resolve(bytes32 assetKey, uint256 referenceTime, bytes calldata proof)
        external
        returns (int256 price, uint8 decimals)
    {
        AssetConfig memory cfg = configs[assetKey];
        require(cfg.exists, "asset not configured");
        require(!cfg.paused, "oracle paused");
        require(proof.length > 0, "proof is empty");
        require(referenceTime <= type(uint64).max / 1e9, "reference time too large");
        _requireV11(proof);

        bytes memory verified = verifierProxy.verify(proof, bytes(""));
        ReportV11 memory report = abi.decode(verified, (ReportV11));

        require(report.feedId == cfg.feedId, "wrong feed");
        require(report.validFromTimestamp <= referenceTime, "report starts after reference");
        require(referenceTime <= report.observationsTimestamp, "report ends before reference");
        require(block.timestamp <= report.expiresAt, "report expired");
        require(report.marketStatus == cfg.expectedMarketStatus, "wrong market status");
        require(report.mid > 0, "invalid price");

        uint256 referenceNs = referenceTime * 1e9;
        uint256 lastSeenNs = report.lastSeenTimestampNs;
        uint256 distance =
            referenceNs >= lastSeenNs ? referenceNs - lastSeenNs : lastSeenNs - referenceNs;
        require(distance <= cfg.maxPriceAgeNs, "price timestamp too far");

        return (report.mid, cfg.decimals);
    }

    function _requireV11(bytes calldata proof) private pure {
        (, bytes memory reportData) = abi.decode(proof, (bytes32[3], bytes));
        require(reportData.length >= 2, "report header too short");
        uint16 reportVersion = (uint16(uint8(reportData[0])) << 8) | uint16(uint8(reportData[1]));
        require(reportVersion == 11, "unsupported report version");
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

    function configHash(bytes32 assetKey) external view returns (bytes32) {
        AssetConfig memory cfg = configs[assetKey];
        if (!cfg.exists) return bytes32(0);
        return keccak256(
            abi.encode(
                address(verifierProxy),
                cfg.feedId,
                cfg.decimals,
                cfg.expectedMarketStatus,
                cfg.maxPriceAgeNs
            )
        );
    }
}
