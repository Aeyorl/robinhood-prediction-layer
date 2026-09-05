// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {MockSequencerFeed} from "../src/mocks/MockSequencerFeed.sol";
import {OracleRegistry} from "../src/oracle/OracleRegistry.sol";
import {ChainlinkPriceResolver} from "../src/oracle/ChainlinkPriceResolver.sol";
import {FeeVault} from "../src/fee/FeeVault.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPoolMarket} from "../src/market/BinaryPoolMarket.sol";
import {IMarket} from "../src/interfaces/IMarket.sol";

contract BaseTest is Test {
    MockUSDG internal usdg;
    MockERC20 internal oracleToken; // the underlying oracle asset (e.g. PONS)
    MockAggregatorV3 internal feed;
    MockSequencerFeed internal sequencer;
    OracleRegistry internal registry;
    ChainlinkPriceResolver internal resolver;
    FeeVault internal feeVault;
    MarketFactory internal factory;
    BinaryPoolMarket internal market;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");
    address internal carol = makeAddr("carol");
    address internal stranger = makeAddr("stranger");

    bytes32 internal assetKey;

    uint256 internal constant FEE_DENOMINATOR = 10_000;
    uint256 internal constant MIN_ENTRY = 1e18;
    // Default market timeline (block.timestamp starts at 1 in Foundry).
    // Resolution happens well past the configured heartbeat/grace windows so
    // oracle-health errors only occur when a test deliberately simulates them.
    uint256 internal constant DEFAULT_OPEN_TIME = 1;
    uint256 internal constant DEFAULT_LOCK_TIME = 5_000;
    uint256 internal constant DEFAULT_RESOLUTION_TIME = 10_000;
    uint256 internal constant DEFAULT_GRACE_PERIOD = 0; // registry sequencer grace
    uint256 internal constant DEFAULT_HEARTBEAT = 1 hours;

    function setUp() public virtual {
        vm.startPrank(owner);
        usdg = new MockUSDG();
        oracleToken = new MockERC20("Mock PONS", "PONS", 18);
        feed = new MockAggregatorV3(18);
        sequencer = new MockSequencerFeed();
        registry = new OracleRegistry(owner);
        resolver = new ChainlinkPriceResolver(owner, registry);
        feeVault = new FeeVault(owner, owner);
        factory = new MarketFactory(owner);
        assetKey = keccak256(abi.encode(uint256(46630), address(oracleToken)));
        registry.setAssetConfig(
            assetKey,
            address(feed),
            address(sequencer),
            DEFAULT_HEARTBEAT,
            DEFAULT_GRACE_PERIOD,
            false
        );
        vm.stopPrank();

        market = _createMarket(
            IMarket.Comparator.PRICE_ABOVE_AT_TIME,
            100e18,
            0, // feeBps
            MIN_ENTRY,
            0, // maxEntry
            DEFAULT_OPEN_TIME,
            DEFAULT_LOCK_TIME,
            DEFAULT_RESOLUTION_TIME
        );

        _fund(alice, 1_000_000e18);
        _fund(bob, 1_000_000e18);
        _fund(carol, 1_000_000e18);
        _fund(stranger, 1_000_000e18);

        // Markets are owned by the factory, so admin actions below go through
        // the factory (pauseMarket/cancelMarket). Pre-approve the default
        // market for every funded user so expectRevert tests can call enter
        // directly.
        _approve(alice, address(market));
        _approve(bob, address(market));
        _approve(carol, address(market));
        _approve(stranger, address(market));
    }

    // ------------------------------------------------------------------
    // Helpers
    // ------------------------------------------------------------------

    function _createMarket(
        IMarket.Comparator comparator,
        int256 strike,
        uint256 feeBps,
        uint256 minEntry,
        uint256 maxEntry,
        uint256 openTime,
        uint256 lockTime,
        uint256 resolutionTime
    ) internal returns (BinaryPoolMarket) {
        return _createMarketWithGracePeriod(
            comparator,
            strike,
            feeBps,
            minEntry,
            maxEntry,
            openTime,
            lockTime,
            resolutionTime,
            DEFAULT_GRACE_PERIOD
        );
    }

    function _createMarketWithGracePeriod(
        IMarket.Comparator comparator,
        int256 strike,
        uint256 feeBps,
        uint256 minEntry,
        uint256 maxEntry,
        uint256 openTime,
        uint256 lockTime,
        uint256 resolutionTime,
        uint256 marketGracePeriod
    ) internal returns (BinaryPoolMarket) {
        BinaryPoolMarket.MarketParams memory params =
            BinaryPoolMarket.MarketParams({
                collateral: address(usdg),
                resolver: address(resolver),
                oracleAssetKey: assetKey,
                comparator: comparator,
                strike: strike,
                strikeDecimals: 18,
                openTime: openTime,
                lockTime: lockTime,
                resolutionTime: resolutionTime,
                gracePeriod: marketGracePeriod,
                feeBps: feeBps,
                minEntry: minEntry,
                maxEntry: maxEntry,
                question: "Will the price be above the strike at resolution?",
                metadataUri: "",
                feeVault: address(feeVault)
            });
        vm.prank(owner);
        return factory.createMarket(params);
    }

    function _fund(address who, uint256 amount) internal {
        usdg.mint(who, amount);
    }

    function _approve(address who, address market_) internal {
        vm.prank(who);
        usdg.approve(market_, type(uint256).max);
    }

    function _enter(address who, IMarket.Side side, uint256 amount) internal {
        vm.prank(who);
        market.enter(side, amount);
    }

    /// Admin actions: markets are owned by the factory, so the owner goes
    /// through factory.pauseMarket / factory.cancelMarket.
    function _pause() internal {
        vm.prank(owner);
        factory.pauseMarket(address(market));
    }

    function _unpause() internal {
        vm.prank(owner);
        factory.unpauseMarket(address(market));
    }

    function _cancel() internal {
        vm.prank(owner);
        factory.cancelMarket(address(market));
    }

    /// Warps to lock time and locks.
    function _lock() internal {
        vm.warp(DEFAULT_LOCK_TIME);
        market.lock();
    }

    /// Warps to resolution time, sets a fresh feed answer, and resolves.
    /// The answer is stamped *after* the warp so the round is never stale.
    function _resolveWith(int256 price) internal {
        vm.warp(DEFAULT_RESOLUTION_TIME);
        feed.setAnswer(price);
        market.resolve();
    }
}
