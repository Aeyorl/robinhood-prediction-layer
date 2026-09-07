// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {DataStreamsRwaResolver} from "../src/oracle/DataStreamsRwaResolver.sol";
import {IVerifierProxy} from "../src/interfaces/IVerifierProxy.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {FeeVault} from "../src/fee/FeeVault.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPoolMarket} from "../src/market/BinaryPoolMarket.sol";
import {IMarket} from "../src/interfaces/IMarket.sol";

contract MockVerifierProxy is IVerifierProxy {
    bytes internal response;

    function setResponse(bytes memory response_) external {
        response = response_;
    }

    function verify(bytes calldata, bytes calldata)
        external
        payable
        returns (bytes memory verifierResponse)
    {
        return response;
    }
}

contract DataStreamsRwaResolverTest is Test {
    uint256 internal constant REFERENCE_TIME = 10_000;
    uint64 internal constant MAX_PRICE_AGE_NS = 300_000_000_000;
    bytes32 internal constant ASSET_KEY = keccak256("NVDA");
    bytes32 internal constant FEED_ID = keccak256("NVDA/USD-v11");
    uint32 internal constant POST_MARKET = 3;

    address internal owner = makeAddr("owner");
    MockVerifierProxy internal verifier;
    DataStreamsRwaResolver internal resolver;

    function setUp() public {
        verifier = new MockVerifierProxy();
        resolver = new DataStreamsRwaResolver(owner, verifier);
        vm.prank(owner);
        resolver.setAssetConfig(ASSET_KEY, FEED_ID, 18, POST_MARKET, MAX_PRICE_AGE_NS, false);
        vm.warp(REFERENCE_TIME);
        _setReport(
            FEED_ID, uint32(REFERENCE_TIME - 1), uint32(REFERENCE_TIME + 1), 200e18, POST_MARKET
        );
    }

    function test_resolve_verifiedReportContainingReferenceTime() public {
        (int256 price, uint8 decimals) = resolver.resolve(ASSET_KEY, REFERENCE_TIME, _proof());
        assertEq(price, 200e18);
        assertEq(decimals, 18);
    }

    function test_resolve_rejectsWrongFeed() public {
        _setReport(keccak256("AAPL/USD-v11"), 9_999, 10_001, 200e18, POST_MARKET);
        vm.expectRevert(bytes("wrong feed"));
        resolver.resolve(ASSET_KEY, REFERENCE_TIME, _proof());
    }

    function test_resolve_rejectsReportAfterReferenceTime() public {
        _setReport(FEED_ID, 10_001, 10_002, 200e18, POST_MARKET);
        vm.expectRevert(bytes("report starts after reference"));
        resolver.resolve(ASSET_KEY, REFERENCE_TIME, _proof());
    }

    function test_resolve_rejectsReportBeforeReferenceTime() public {
        _setReport(FEED_ID, 9_998, 9_999, 200e18, POST_MARKET);
        vm.expectRevert(bytes("report ends before reference"));
        resolver.resolve(ASSET_KEY, REFERENCE_TIME, _proof());
    }

    function test_resolve_rejectsExpiredReport() public {
        _setReport(FEED_ID, 9_999, 10_001, 200e18, POST_MARKET, 10_000);
        vm.warp(10_001);
        vm.expectRevert(bytes("report expired"));
        resolver.resolve(ASSET_KEY, REFERENCE_TIME, _proof());
    }

    function test_resolve_rejectsWrongMarketStatus() public {
        _setReport(FEED_ID, 9_999, 10_001, 200e18, 2);
        vm.expectRevert(bytes("wrong market status"));
        resolver.resolve(ASSET_KEY, REFERENCE_TIME, _proof());
    }

    function test_resolve_rejectsStaleMidPriceTimestamp() public {
        DataStreamsRwaResolver.ReportV11 memory report =
            _report(FEED_ID, 9_999, 10_001, 200e18, POST_MARKET, 11_000);
        report.lastSeenTimestampNs = uint64((REFERENCE_TIME - 301) * 1e9);
        verifier.setResponse(abi.encode(report));
        vm.expectRevert(bytes("price timestamp too far"));
        resolver.resolve(ASSET_KEY, REFERENCE_TIME, _proof());
    }

    function test_resolve_rejectsPausedAsset() public {
        vm.prank(owner);
        resolver.setPaused(ASSET_KEY, true);
        vm.expectRevert(bytes("oracle paused"));
        resolver.resolve(ASSET_KEY, REFERENCE_TIME, _proof());
    }

    function test_resolve_rejectsNonV11Report() public {
        bytes32[3] memory headers;
        bytes memory reportData = abi.encodePacked(uint16(8));
        vm.expectRevert(bytes("unsupported report version"));
        resolver.resolve(ASSET_KEY, REFERENCE_TIME, abi.encode(headers, reportData));
    }

    function test_resolve_rejectsReferenceTimeThatCannotConvertToNanoseconds() public {
        vm.expectRevert(bytes("reference time too large"));
        resolver.resolve(ASSET_KEY, type(uint64).max / 1e9 + 1, _proof());
    }

    function test_configHashChangesWithResolutionTerms() public {
        bytes32 beforeHash = resolver.configHash(ASSET_KEY);
        vm.prank(owner);
        resolver.setAssetConfig(ASSET_KEY, FEED_ID, 8, POST_MARKET, MAX_PRICE_AGE_NS, false);
        assertNotEq(resolver.configHash(ASSET_KEY), beforeHash);
    }

    function test_marketResolvesWithVerifiedDataStreamsProof() public {
        MockUSDG usdg = new MockUSDG();
        FeeVault feeVault = new FeeVault(owner, owner);
        MarketFactory factory = new MarketFactory(owner);
        BinaryPoolMarket.MarketParams memory params = BinaryPoolMarket.MarketParams({
            collateral: address(usdg),
            resolver: address(resolver),
            oracleAssetKey: ASSET_KEY,
            comparator: IMarket.Comparator.PRICE_ABOVE_AT_TIME,
            strike: 190e18,
            strikeDecimals: 18,
            openTime: 10_000,
            lockTime: 11_000,
            resolutionTime: 12_000,
            gracePeriod: 1 hours,
            feeBps: 0,
            minEntry: 1e18,
            maxEntry: 0,
            question: "Will NVDA close above 190?",
            metadataUri: "",
            feeVault: address(feeVault)
        });
        vm.prank(owner);
        BinaryPoolMarket market = factory.createMarket(params);

        address yesUser = makeAddr("yesUser");
        address noUser = makeAddr("noUser");
        usdg.mint(yesUser, 10e18);
        usdg.mint(noUser, 10e18);
        vm.prank(yesUser);
        usdg.approve(address(market), 10e18);
        vm.prank(noUser);
        usdg.approve(address(market), 10e18);
        vm.prank(yesUser);
        market.enter(IMarket.Side.YES, 10e18);
        vm.prank(noUser);
        market.enter(IMarket.Side.NO, 10e18);

        vm.warp(11_000);
        market.lock();
        DataStreamsRwaResolver.ReportV11 memory report =
            _report(FEED_ID, 11_999, 12_001, 200e18, POST_MARKET, 13_000);
        report.lastSeenTimestampNs = uint64(12_000 * 1e9);
        verifier.setResponse(abi.encode(report));
        vm.warp(12_000);
        market.resolve(_proof());

        assertEq(uint256(market.status()), uint256(IMarket.Status.RESOLVED));
        assertEq(uint256(market.winningOutcome()), uint256(IMarket.Side.YES));
        assertEq(market.resolvedPrice(), 200e18);
    }

    function _setReport(
        bytes32 feedId,
        uint32 validFrom,
        uint32 observations,
        int192 mid,
        uint32 marketStatus
    ) internal {
        _setReport(feedId, validFrom, observations, mid, marketStatus, 11_000);
    }

    function _setReport(
        bytes32 feedId,
        uint32 validFrom,
        uint32 observations,
        int192 mid,
        uint32 marketStatus,
        uint32 expiresAt
    ) internal {
        verifier.setResponse(
            abi.encode(_report(feedId, validFrom, observations, mid, marketStatus, expiresAt))
        );
    }

    function _report(
        bytes32 feedId,
        uint32 validFrom,
        uint32 observations,
        int192 mid,
        uint32 marketStatus,
        uint32 expiresAt
    ) internal pure returns (DataStreamsRwaResolver.ReportV11 memory report) {
        report = DataStreamsRwaResolver.ReportV11({
                feedId: feedId,
                validFromTimestamp: validFrom,
                observationsTimestamp: observations,
                nativeFee: 0,
                linkFee: 0,
                expiresAt: expiresAt,
                mid: mid,
                lastSeenTimestampNs: uint64(REFERENCE_TIME * 1e9),
                bid: mid,
                bidVolume: 0,
                ask: mid,
                askVolume: 0,
                lastTradedPrice: mid,
                marketStatus: marketStatus
            });
    }

    function _proof() internal pure returns (bytes memory) {
        bytes32[3] memory headers;
        return abi.encode(headers, abi.encodePacked(uint16(11)));
    }
}
