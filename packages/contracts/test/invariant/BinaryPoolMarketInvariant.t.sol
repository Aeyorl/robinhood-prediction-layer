// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDG} from "../../src/mocks/MockUSDG.sol";
import {MockAggregatorV3} from "../../src/mocks/MockAggregatorV3.sol";
import {MockSequencerFeed} from "../../src/mocks/MockSequencerFeed.sol";
import {OracleRegistry} from "../../src/oracle/OracleRegistry.sol";
import {ChainlinkPriceResolver} from "../../src/oracle/ChainlinkPriceResolver.sol";
import {FeeVault} from "../../src/fee/FeeVault.sol";
import {BinaryPoolMarket} from "../../src/market/BinaryPoolMarket.sol";
import {IMarket} from "../../src/interfaces/IMarket.sol";

uint256 constant HANDLER_LOCK_TIME = 20_000;
uint256 constant HANDLER_RESOLUTION_TIME = 21_000;

/// @notice Drives one market through a random lifecycle: entries while open,
///         lock when due, permissionless resolution with a random oracle
///         price, claims for winners / refunds for cancellations.
contract MarketLifecycleHandler is Test {
    MockUSDG public usdg;
    BinaryPoolMarket public market;
    MockAggregatorV3 public feed;
    address[3] public users;

    uint256 public constant LOCK_TIME = HANDLER_LOCK_TIME;
    uint256 public constant RESOLUTION_TIME = HANDLER_RESOLUTION_TIME;
    uint256 public constant ENTRY_MAX = 10_000e18;

    // Ghost accounting.
    uint256 public enteredTotal;
    uint256 public claimedTotal;
    uint256 public refundedTotal;
    uint256 public feesTotal;

    mapping(address => uint256) public yesStake;
    mapping(address => uint256) public noStake;
    mapping(address => bool) public userSettled;

    constructor(
        MockUSDG usdg_,
        BinaryPoolMarket market_,
        MockAggregatorV3 feed_,
        address[3] memory users_
    ) {
        usdg = usdg_;
        market = market_;
        feed = feed_;
        users = users_;
        for (uint256 i = 0; i < 3; i++) {
            usdg.mint(users[i], 1_000_000e18);
            vm.prank(users[i]);
            usdg.approve(address(market), type(uint256).max);
        }
    }

    /// Random entry on a random side while the market is open.
    function enter(uint256 seed) external {
        if (block.timestamp >= LOCK_TIME) return;
        if (uint8(market.status()) != uint8(IMarket.Status.OPEN)) return;

        address user = users[seed % 3];
        IMarket.Side side = seed % 2 == 0 ? IMarket.Side.YES : IMarket.Side.NO;
        uint256 amount = 1e18 + (seed >> 4) % ENTRY_MAX;

        vm.prank(user);
        market.enter(side, amount);

        if (side == IMarket.Side.YES) {
            yesStake[user] += amount;
            assertEq(market.userStake(user, IMarket.Side.YES), yesStake[user]);
        } else {
            noStake[user] += amount;
            assertEq(market.userStake(user, IMarket.Side.NO), noStake[user]);
        }
        enteredTotal += amount;
        _tick(seed);
    }

    function lockIfDue() external {
        if (block.timestamp < LOCK_TIME) return;
        if (uint8(market.status()) != uint8(IMarket.Status.OPEN)) return;
        market.lock();
        assertEq(uint8(market.status()), uint8(IMarket.Status.LOCKED));
    }

    function resolveIfDue(uint256 seed) external {
        if (block.timestamp < RESOLUTION_TIME) return;
        if (uint8(market.status()) != uint8(IMarket.Status.LOCKED)) return;

        // Random oracle price in [50, 150] around the 100e18 strike.
        feed.setAnswer(int256(50e18 + (seed % 100_000e15)));
        market.resolve();
    }

    function settle() external {
        IMarket.Status s = market.status();
        if (s == IMarket.Status.RESOLVED) {
            bool yesWon = uint8(market.winningOutcome()) == uint8(IMarket.Side.YES);
            uint256 winningPool = yesWon ? market.yesPool() : market.noPool();
            uint256 losingPool = yesWon ? market.noPool() : market.yesPool();
            for (uint256 i = 0; i < 3; i++) {
                address u = users[i];
                if (userSettled[u]) continue;
                uint256 stake = yesWon
                    ? market.userStake(u, IMarket.Side.YES)
                    : market.userStake(u, IMarket.Side.NO);
                if (stake == 0) continue;
                (,, uint256 fee, uint256 net) = market.previewPayout(stake, winningPool, losingPool);
                vm.prank(u);
                market.claim();
                userSettled[u] = true;
                claimedTotal += net;
                feesTotal += fee;
            }
        } else if (s == IMarket.Status.CANCELLED) {
            for (uint256 i = 0; i < 3; i++) {
                address u = users[i];
                if (userSettled[u]) continue;
                uint256 principal = yesStake[u] + noStake[u];
                if (principal == 0) continue;
                vm.prank(u);
                market.refund();
                userSettled[u] = true;
                refundedTotal += principal;
            }
        }
    }

    function fly(uint256 seed) external {
        _tick(seed);
    }

    // ------------------------------------------------------------------
    // Invariants
    // ------------------------------------------------------------------

    /// Every entered wei is either still in the market, paid to winners,
    /// refunded, or collected as fees — nothing is ever stuck or created.
    function invariant_conservationOfCollateral() public view {
        uint256 inMarket = usdg.balanceOf(address(market));
        assertEq(enteredTotal, inMarket + claimedTotal + refundedTotal + feesTotal);
    }

    /// A user can only ever be paid out once.
    function invariant_noDoublePayoutPerUser() public view {
        for (uint256 i = 0; i < 3; i++) {
            if (userSettled[users[i]]) {
                assertTrue(market.hasClaimed(users[i]));
            }
        }
    }

    /// Resolved markets never report a NONE outcome; cancelled never report a winner.
    function invariant_statusIsConsistent() public view {
        IMarket.Status s = market.status();
        if (s == IMarket.Status.RESOLVED) {
            assertTrue(uint8(market.winningOutcome()) != uint8(IMarket.Side.NONE));
        } else if (s == IMarket.Status.CANCELLED) {
            assertEq(uint8(market.winningOutcome()), uint8(IMarket.Side.NONE));
        } else if (s == IMarket.Status.OPEN || s == IMarket.Status.LOCKED) {
            assertEq(market.resolvedPrice(), int256(0));
        }
    }

    /// The onchain pools always equal the sum of per-user stakes.
    function invariant_poolsMatchStakes() public view {
        uint256 sumYes;
        uint256 sumNo;
        for (uint256 i = 0; i < 3; i++) {
            sumYes += yesStake[users[i]];
            sumNo += noStake[users[i]];
        }
        assertEq(market.yesPool(), sumYes);
        assertEq(market.noPool(), sumNo);
    }

    function _tick(uint256 seed) internal {
        vm.warp(block.timestamp + (seed % 900)); // advance up to 15 minutes
    }
}

contract BinaryPoolMarketInvariant is Test {
    MarketLifecycleHandler internal handler;

    function setUp() public {
        address owner = makeAddr("owner");
        MockUSDG usdg = new MockUSDG();
        MockAggregatorV3 feed = new MockAggregatorV3(18);
        MockSequencerFeed sequencer = new MockSequencerFeed();
        OracleRegistry registry = new OracleRegistry(owner);
        ChainlinkPriceResolver resolver = new ChainlinkPriceResolver(owner, registry);
        FeeVault feeVault = new FeeVault(owner, owner);
        bytes32 assetKey = keccak256(abi.encode(uint256(46630), address(0xdead)));

        vm.prank(owner);
        registry.setAssetConfig(
            assetKey, address(feed), address(sequencer), 1 hours, 1 hours, false
        );

        vm.prank(owner);
        BinaryPoolMarket market = new BinaryPoolMarket(
            BinaryPoolMarket.MarketParams({
                collateral: address(usdg),
                resolver: address(resolver),
                oracleAssetKey: assetKey,
                comparator: IMarket.Comparator.PRICE_ABOVE_AT_TIME,
                strike: 100e18,
                strikeDecimals: 18,
                openTime: 1,
                lockTime: HANDLER_LOCK_TIME,
                resolutionTime: HANDLER_RESOLUTION_TIME,
                gracePeriod: 3_600,
                feeBps: 0,
                minEntry: 1e18,
                maxEntry: 0,
                question: "Invariant market question",
                metadataUri: "",
                feeVault: address(feeVault)
            })
        );

        address[3] memory users = [makeAddr("u1"), makeAddr("u2"), makeAddr("u3")];
        handler = new MarketLifecycleHandler(usdg, market, feed, users);

        targetContract(address(handler));
        // Keep the engine from poking protocol contracts directly.
        excludeContract(address(market));
        excludeContract(address(usdg));
        excludeContract(address(feed));
        excludeContract(address(sequencer));
        excludeContract(address(registry));
        excludeContract(address(resolver));
        excludeContract(address(feeVault));
    }

    /// The contract can never hold more collateral than was entered.
    function invariant_marketNeverCreatesCollateral() public view {
        assertLe(usdgBalance(), handler.enteredTotal());
    }

    function usdgBalance() internal view returns (uint256) {
        return handler.usdg().balanceOf(address(handler.market()));
    }
}
