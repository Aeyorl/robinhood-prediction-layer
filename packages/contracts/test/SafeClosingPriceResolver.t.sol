// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SafeClosingPriceResolver} from "../src/oracle/SafeClosingPriceResolver.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {FeeVault} from "../src/fee/FeeVault.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPoolMarket} from "../src/market/BinaryPoolMarket.sol";
import {IMarket} from "../src/interfaces/IMarket.sol";

contract SafeClosingPriceResolverTest is Test {
    bytes32 internal constant ASSET_KEY = keccak256("NVDA");
    uint256 internal constant REFERENCE_TIME = 10_000;
    uint64 internal constant CHALLENGE_PERIOD = 24 hours;
    uint64 internal constant MAX_OBSERVATION_DELAY = 2 days;
    bytes32 internal constant EVIDENCE_HASH = keccak256("evidence");

    address internal owner = makeAddr("timelock");
    address internal guardian = makeAddr("safe");
    SafeClosingPriceResolver internal resolver;

    function setUp() public {
        resolver = new SafeClosingPriceResolver(owner, guardian);
        vm.prank(owner);
        resolver.setAssetConfig(ASSET_KEY, 18, CHALLENGE_PERIOD, MAX_OBSERVATION_DELAY, false);
        vm.warp(REFERENCE_TIME);
    }

    function test_observationResolvesAfterChallengePeriod() public {
        _propose(200e18);
        vm.warp(REFERENCE_TIME + CHALLENGE_PERIOD);
        (int256 price, uint8 decimals) = resolver.resolve(ASSET_KEY, REFERENCE_TIME, "");
        assertEq(price, 200e18);
        assertEq(decimals, 18);
    }

    function test_resolveRejectsDuringChallengePeriod() public {
        _propose(200e18);
        vm.expectRevert(bytes("challenge period active"));
        resolver.resolve(ASSET_KEY, REFERENCE_TIME, "");
    }

    function test_ownerCanCancelDisputedObservation() public {
        _propose(200e18);
        vm.prank(owner);
        resolver.cancelObservation(ASSET_KEY, REFERENCE_TIME);
        vm.warp(REFERENCE_TIME + CHALLENGE_PERIOD);
        vm.expectRevert(bytes("observation cancelled"));
        resolver.resolve(ASSET_KEY, REFERENCE_TIME, "");
    }

    function test_resolutionAvailabilityTracksObservationLifecycle() public {
        assertFalse(resolver.resolutionAvailable(ASSET_KEY, REFERENCE_TIME));
        _propose(200e18);
        assertTrue(resolver.resolutionAvailable(ASSET_KEY, REFERENCE_TIME));
        vm.prank(guardian);
        resolver.cancelObservation(ASSET_KEY, REFERENCE_TIME);
        assertFalse(resolver.resolutionAvailable(ASSET_KEY, REFERENCE_TIME));
    }

    function test_safeGuardianCanCancelWithoutTimelockDelay() public {
        _propose(200e18);
        vm.prank(guardian);
        resolver.cancelObservation(ASSET_KEY, REFERENCE_TIME);
        vm.warp(REFERENCE_TIME + CHALLENGE_PERIOD);
        vm.expectRevert(bytes("observation cancelled"));
        resolver.resolve(ASSET_KEY, REFERENCE_TIME, "");
    }

    function test_strangerCannotCancelObservation() public {
        _propose(200e18);
        vm.expectRevert(bytes("not cancellation authority"));
        resolver.cancelObservation(ASSET_KEY, REFERENCE_TIME);
    }

    function test_cannotReplaceObservation() public {
        _propose(200e18);
        vm.expectRevert(bytes("observation already exists"));
        vm.prank(owner);
        resolver.proposeObservation(ASSET_KEY, REFERENCE_TIME, 201e18, EVIDENCE_HASH, "ipfs://replacement");
    }

    function test_rejectsLateObservation() public {
        vm.warp(REFERENCE_TIME + MAX_OBSERVATION_DELAY + 1);
        vm.expectRevert(bytes("observation submitted too late"));
        vm.prank(owner);
        resolver.proposeObservation(ASSET_KEY, REFERENCE_TIME, 200e18, EVIDENCE_HASH, "ipfs://evidence");
    }

    function test_configHashDoesNotChangeWhenObservationIsPublished() public {
        bytes32 beforeHash = resolver.configHash(ASSET_KEY);
        _propose(200e18);
        assertEq(resolver.configHash(ASSET_KEY), beforeHash);
    }

    function test_marketResolvesFromMatureObservation() public {
        vm.warp(100);
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
            openTime: 1,
            lockTime: 9_000,
            resolutionTime: REFERENCE_TIME,
            gracePeriod: 2 days,
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

        vm.warp(9_000);
        market.lock();
        vm.warp(REFERENCE_TIME);
        _propose(200e18);
        vm.warp(REFERENCE_TIME + CHALLENGE_PERIOD);
        market.resolve();

        assertEq(uint256(market.status()), uint256(IMarket.Status.RESOLVED));
        assertEq(uint256(market.winningOutcome()), uint256(IMarket.Side.YES));
        assertEq(market.resolvedPrice(), 200e18);
    }

    function _propose(int256 price) private {
        vm.prank(owner);
        resolver.proposeObservation(ASSET_KEY, REFERENCE_TIME, price, EVIDENCE_HASH, "ipfs://evidence");
    }
}
