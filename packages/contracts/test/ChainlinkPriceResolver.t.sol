// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {MockSequencerFeed} from "../src/mocks/MockSequencerFeed.sol";
import {BinaryPoolMarket} from "../src/market/BinaryPoolMarket.sol";
import {IOracleResolver} from "../src/interfaces/IOracleResolver.sol";
import {IMarket} from "../src/interfaces/IMarket.sol";

contract ChainlinkPriceResolverTest is BaseTest {
    function test_resolve_happyPath() public {
        feed.setAnswer(123e18);
        (int256 price, uint8 decimals) = resolver.resolve(assetKey, block.timestamp);
        assertEq(price, 123e18);
        assertEq(decimals, 18);
    }

    function test_resolve_unconfiguredAsset_reverts() public {
        bytes32 unknown = keccak256(abi.encode(uint256(46630), address(0x1234)));
        vm.expectRevert(bytes("asset not configured"));
        resolver.resolve(unknown, block.timestamp);
    }

    function test_resolve_answerZero_reverts() public {
        feed.setAnswer(0);
        vm.expectRevert(bytes("invalid answer"));
        resolver.resolve(assetKey, block.timestamp);
    }

    function test_resolve_negativeAnswer_reverts() public {
        feed.setAnswer(-1e18);
        vm.expectRevert(bytes("invalid answer"));
        resolver.resolve(assetKey, block.timestamp);
    }

    function test_resolve_staleFeed_reverts() public {
        vm.warp(1 hours + 100); // enough history for an old, nonzero round timestamp
        feed.setAnswerAndTime(100e18, block.timestamp - 1 hours - 1); // 1s older than the 1h heartbeat
        vm.expectRevert(bytes("stale feed"));
        resolver.resolve(assetKey, block.timestamp);
    }

    function test_resolve_updatedAtZero_reverts() public {
        feed.setAnswerAndTime(100e18, 0);
        vm.expectRevert(bytes("no update"));
        resolver.resolve(assetKey, block.timestamp);
    }

    function test_resolve_sequencerDown_reverts() public {
        sequencer.setDown();
        vm.expectRevert(bytes("sequencer down"));
        resolver.resolve(assetKey, block.timestamp);
    }

    function test_resolve_sequencerGracePeriod_reverts() public {
        // Configure an asset whose sequencer grace period is 1h.
        MockAggregatorV3 gFeed = new MockAggregatorV3(18);
        MockSequencerFeed gSeq = new MockSequencerFeed();
        bytes32 gKey = keccak256(abi.encode(uint256(46630), address(0xface)));
        vm.prank(owner);
        registry.setAssetConfig(gKey, address(gFeed), address(gSeq), 1 hours, 1 hours, false);

        vm.warp(1 hours + 1);
        gFeed.setAnswer(100e18);
        gSeq.setUp(); // status change at now → grace not elapsed yet
        vm.expectRevert(bytes("sequencer grace not elapsed"));
        resolver.resolve(gKey, block.timestamp);
    }

    function test_resolve_afterGracePeriod_succeeds() public {
        // Default asset has zero grace configured; simulate a 1h-grace asset.
        MockAggregatorV3 gFeed = new MockAggregatorV3(18);
        MockSequencerFeed gSeq = new MockSequencerFeed();
        bytes32 gKey = keccak256(abi.encode(uint256(46630), address(0xface)));
        vm.prank(owner);
        registry.setAssetConfig(gKey, address(gFeed), address(gSeq), 1 hours, 1 hours, false);

        gSeq.setUp(); // grace starts now
        vm.warp(block.timestamp + 1 hours + 1); // grace elapsed
        gFeed.setAnswerAndTime(100e18, block.timestamp); // keep fresh
        (int256 price,) = resolver.resolve(gKey, block.timestamp);
        assertEq(price, 100e18);
    }

    function test_resolve_pausedAsset_reverts() public {
        vm.prank(owner);
        registry.setPaused(assetKey, true);
        vm.expectRevert(bytes("oracle paused"));
        resolver.resolve(assetKey, block.timestamp);
    }

    function test_health_reportsUnhealthyWithoutReverting() public {
        // Unconfigured asset → healthy false.
        IOracleResolver.Health memory h =
            resolver.health(keccak256(abi.encode(uint256(46630), address(0x9999))));
        assertFalse(h.healthy);

        // Stale feed → healthy false.
        vm.warp(1 hours + 100);
        feed.setAnswerAndTime(100e18, block.timestamp - 1 hours - 1);
        h = resolver.health(assetKey);
        assertFalse(h.healthy);
        assertTrue(h.isStale);

        // Healthy feed → healthy true.
        feed.setAnswerAndTime(100e18, block.timestamp);
        h = resolver.health(assetKey);
        assertTrue(h.healthy);
        assertEq(h.price, 100e18);
    }

    function test_resolve_dynamicDecimals_reported() public {
        MockAggregatorV3 sixDecFeed = new MockAggregatorV3(6);
        bytes32 key = keccak256(abi.encode(uint256(46630), address(0xbeef)));
        vm.prank(owner);
        registry.setAssetConfig(key, address(sixDecFeed), address(sequencer), 1 hours, 0, false);
        sixDecFeed.setAnswer(123_456_789); // 123.456789 USD
        (int256 price, uint8 decimals) = resolver.resolve(key, block.timestamp);
        assertEq(price, 123_456_789);
        assertEq(decimals, 6);
    }

    // ------------------------------------------------------------------
    // Scale-normalized comparison (8-decimal feed vs 18-decimal strike)
    // ------------------------------------------------------------------

    function test_market_normalizesFeedDecimalsAgainstStrikeDecimals() public {
        MockAggregatorV3 eightDecFeed = new MockAggregatorV3(8);
        bytes32 key = keccak256(abi.encode(uint256(46630), address(0xbeef)));
        vm.startPrank(owner);
        registry.setAssetConfig(
            key, address(eightDecFeed), address(sequencer), 1 hours, 1 hours, false
        );

        // Strike 100.5 USDG expressed in 18 decimals.
        BinaryPoolMarket.MarketParams memory params = BinaryPoolMarket.MarketParams({
            collateral: address(usdg),
            resolver: address(resolver),
            oracleAssetKey: key,
            comparator: IMarket.Comparator.PRICE_ABOVE_AT_TIME,
            strike: 100_500_000_000_000_000_000,
            strikeDecimals: 18,
            openTime: DEFAULT_OPEN_TIME,
            lockTime: DEFAULT_LOCK_TIME,
            resolutionTime: DEFAULT_RESOLUTION_TIME,
            gracePeriod: DEFAULT_GRACE_PERIOD,
            feeBps: 0,
            minEntry: MIN_ENTRY,
            maxEntry: 0,
            question: "Above 100.5?",
            metadataUri: "",
            feeVault: address(feeVault)
        });
        BinaryPoolMarket above = factory.createMarket(params);
        BinaryPoolMarket below = factory.createMarket(params);
        vm.stopPrank();

        // Both users enter up front (both markets share the default timeline).
        vm.prank(alice);
        usdg.approve(address(above), type(uint256).max);
        vm.prank(alice);
        above.enter(IMarket.Side.YES, 1e18);
        vm.prank(bob);
        usdg.approve(address(below), type(uint256).max);
        vm.prank(bob);
        below.enter(IMarket.Side.NO, 1e18); // NO needs stake to win the below case

        // Above case: 100.50000001 (8 decimals) → YES wins.
        vm.warp(DEFAULT_LOCK_TIME);
        above.lock();
        vm.warp(DEFAULT_RESOLUTION_TIME);
        eightDecFeed.setAnswer(100_500_000_01); // fresh round right before resolving
        above.resolve();
        assertEq(uint8(above.winningOutcome()), uint8(IMarket.Side.YES));

        // Below case: 100.49999999 (8 decimals) → NO wins.
        eightDecFeed.setAnswer(100_499_999_99); // t is already at resolution time
        below.lock();
        below.resolve();
        assertEq(uint8(below.winningOutcome()), uint8(IMarket.Side.NO));
    }
}
