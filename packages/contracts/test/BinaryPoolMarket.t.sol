// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {BinaryPoolMarket} from "../src/market/BinaryPoolMarket.sol";
import {IMarket} from "../src/interfaces/IMarket.sol";

contract BinaryPoolMarketTest is BaseTest {
    // ------------------------------------------------------------------
    // Entry rules
    // ------------------------------------------------------------------

    function test_enter_updatesPoolsAndStakes() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _enter(bob, IMarket.Side.NO, 50e18);

        assertEq(market.yesPool(), 100e18);
        assertEq(market.noPool(), 50e18);
        assertEq(market.userStake(alice, IMarket.Side.YES), 100e18);
        assertEq(market.userStake(bob, IMarket.Side.NO), 50e18);
        assertEq(usdg.balanceOf(address(market)), 150e18);
    }

    function test_enter_beforeOpen_reverts() public {
        BinaryPoolMarket late = _createMarket(
            IMarket.Comparator.PRICE_ABOVE_AT_TIME,
            100e18,
            0,
            MIN_ENTRY,
            0,
            10_000, // opens in the future
            20_000,
            30_000
        );
        vm.prank(alice);
        usdg.approve(address(late), type(uint256).max);
        vm.expectRevert(); // TimestampViolation
        vm.prank(alice);
        late.enter(IMarket.Side.YES, 1e18);
    }

    function test_enter_afterLockTime_reverts_evenWithoutLockTx() public {
        // No lock() call — the timestamp itself must block entry.
        vm.warp(DEFAULT_LOCK_TIME);
        vm.expectRevert();
        _enter(alice, IMarket.Side.YES, 1e18);
    }

    function test_enter_belowMinEntry_reverts() public {
        vm.expectRevert();
        _enter(alice, IMarket.Side.YES, MIN_ENTRY - 1);
    }

    function test_enter_respectsMaxEntryPerSide() public {
        BinaryPoolMarket capped = _createMarket(
            IMarket.Comparator.PRICE_ABOVE_AT_TIME,
            100e18,
            0,
            MIN_ENTRY,
            500e18,
            DEFAULT_OPEN_TIME,
            DEFAULT_LOCK_TIME,
            DEFAULT_RESOLUTION_TIME
        );
        vm.prank(alice);
        usdg.approve(address(capped), type(uint256).max);
        vm.prank(alice);
        capped.enter(IMarket.Side.YES, 300e18);
        vm.prank(alice);
        capped.enter(IMarket.Side.YES, 200e18); // exactly at cap
        vm.expectRevert();
        vm.prank(alice);
        capped.enter(IMarket.Side.YES, 1e18); // exceeds cap

        // A different side has its own cap.
        vm.prank(alice);
        capped.enter(IMarket.Side.NO, 500e18);
    }

    function test_enter_whenPaused_reverts() public {
        _pause();
        vm.expectRevert();
        _enter(alice, IMarket.Side.YES, 1e18);

        _unpause();
        _enter(alice, IMarket.Side.YES, 1e18);
    }

    function test_enter_invalidSide_reverts() public {
        vm.expectRevert();
        _enter(alice, IMarket.Side.NONE, 1e18);
    }

    // ------------------------------------------------------------------
    // Lock
    // ------------------------------------------------------------------

    function test_lock_beforeLockTime_reverts() public {
        vm.expectRevert();
        market.lock();
    }

    function test_lock_atLockTime_succeeds() public {
        vm.warp(DEFAULT_LOCK_TIME);
        market.lock();
        assertEq(uint8(market.status()), uint8(IMarket.Status.LOCKED));
    }

    function test_lock_twice_reverts() public {
        vm.warp(DEFAULT_LOCK_TIME);
        market.lock();
        vm.expectRevert();
        market.lock();
    }

    // ------------------------------------------------------------------
    // Resolution
    // ------------------------------------------------------------------

    function test_resolve_beforeResolutionTime_reverts() public {
        _lock();
        vm.expectRevert();
        market.resolve();
    }

    function test_resolve_whileOpen_reverts() public {
        vm.warp(DEFAULT_RESOLUTION_TIME);
        vm.expectRevert();
        market.resolve();
    }

    function test_resolve_aboveOutcome_yesWins() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _lock();
        _resolveWith(150e18); // above strike 100
        assertEq(uint8(market.status()), uint8(IMarket.Status.RESOLVED));
        assertEq(uint8(market.winningOutcome()), uint8(IMarket.Side.YES));
        assertEq(market.resolvedPrice(), 150e18);
    }

    function test_resolve_belowOutcome_noWins() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _enter(bob, IMarket.Side.NO, 100e18); // NO must have stake or it cancels
        _lock();
        _resolveWith(80e18);
        assertEq(uint8(market.winningOutcome()), uint8(IMarket.Side.NO));
    }

    function test_resolve_belowComparator_yesWins() public {
        BinaryPoolMarket belowMarket = _createMarket(
            IMarket.Comparator.PRICE_BELOW_AT_TIME,
            100e18,
            0,
            MIN_ENTRY,
            0,
            DEFAULT_OPEN_TIME,
            DEFAULT_LOCK_TIME,
            DEFAULT_RESOLUTION_TIME
        );
        vm.prank(alice);
        usdg.approve(address(belowMarket), type(uint256).max);
        vm.prank(alice);
        belowMarket.enter(IMarket.Side.YES, 1e18);
        vm.warp(DEFAULT_LOCK_TIME);
        belowMarket.lock();
        vm.warp(DEFAULT_RESOLUTION_TIME);
        feed.setAnswer(50e18);
        belowMarket.resolve();
        assertEq(uint8(belowMarket.winningOutcome()), uint8(IMarket.Side.YES));
    }

    function test_resolve_equality_cancelsAndRefunds() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _lock();
        _resolveWith(100e18); // exactly equal to strike
        assertEq(uint8(market.status()), uint8(IMarket.Status.CANCELLED));
    }

    function test_resolve_emptyWinningSide_cancels() public {
        // Only NO is staked; price goes above strike → YES would win with zero stake.
        _enter(bob, IMarket.Side.NO, 100e18);
        _lock();
        _resolveWith(150e18);
        assertEq(uint8(market.status()), uint8(IMarket.Status.CANCELLED));
    }

    function test_resolve_permissionless() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _lock();
        vm.warp(DEFAULT_RESOLUTION_TIME);
        feed.setAnswer(150e18);
        vm.prank(stranger); // anyone can resolve — no admin-typed outcome
        market.resolve();
        assertEq(uint8(market.status()), uint8(IMarket.Status.RESOLVED));
        assertEq(uint8(market.winningOutcome()), uint8(IMarket.Side.YES));
    }

    function test_resolve_staleFeed_reverts() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _lock();
        vm.warp(DEFAULT_RESOLUTION_TIME);
        feed.setAnswerAndTime(150e18, block.timestamp - 2 hours); // stale vs 1h heartbeat
        vm.expectRevert(bytes("stale feed"));
        market.resolve();
    }

    // ------------------------------------------------------------------
    // Claims and payouts
    // ------------------------------------------------------------------

    function test_claim_winnerPayout_feeZero() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _enter(bob, IMarket.Side.NO, 300e18);
        _lock();
        _resolveWith(150e18); // YES wins

        uint256 before = usdg.balanceOf(alice);
        vm.prank(alice);
        market.claim();
        // gross = 100 * 400 / 100 = 400; profit = 300; fee = 0 → net 400.
        assertEq(usdg.balanceOf(alice) - before, 400e18);

        // Loser cannot claim.
        vm.expectRevert();
        vm.prank(bob);
        market.claim();

        // Pool fully distributed.
        assertEq(usdg.balanceOf(address(market)), 0);
    }

    function test_claim_feeChargedOnProfitOnly() public {
        // Rebuild a market with a 5% fee.
        BinaryPoolMarket feeMarket = _createMarket(
            IMarket.Comparator.PRICE_ABOVE_AT_TIME,
            100e18,
            500, // 5%
            MIN_ENTRY,
            0,
            DEFAULT_OPEN_TIME,
            DEFAULT_LOCK_TIME,
            DEFAULT_RESOLUTION_TIME
        );
        vm.prank(alice);
        usdg.approve(address(feeMarket), type(uint256).max);
        vm.prank(alice);
        feeMarket.enter(IMarket.Side.YES, 100e18);
        vm.prank(bob);
        usdg.approve(address(feeMarket), type(uint256).max);
        vm.prank(bob);
        feeMarket.enter(IMarket.Side.NO, 300e18);
        vm.warp(DEFAULT_LOCK_TIME);
        feeMarket.lock();
        vm.warp(DEFAULT_RESOLUTION_TIME);
        feed.setAnswer(150e18);
        feeMarket.resolve();

        uint256 before = usdg.balanceOf(alice);
        vm.prank(alice);
        feeMarket.claim();
        // gross 400, profit 300, fee 15 (5% of profit), net 385.
        assertEq(usdg.balanceOf(alice) - before, 385e18);
        assertEq(usdg.balanceOf(address(feeVault)), 15e18);

        // Fee can be withdrawn only to the fixed recipient (owner here).
        vm.prank(owner);
        feeVault.withdraw(address(usdg));
        assertEq(usdg.balanceOf(address(feeVault)), 0);
    }

    function test_claim_multiWinner_proRata_solvent() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _enter(bob, IMarket.Side.YES, 300e18);
        _enter(carol, IMarket.Side.NO, 200e18);
        _lock();
        _resolveWith(150e18); // YES pool = 400, total = 600

        uint256 aBefore = usdg.balanceOf(alice);
        uint256 bBefore = usdg.balanceOf(bob);
        vm.prank(alice);
        market.claim();
        vm.prank(bob);
        market.claim();

        // alice: 100*600/400 = 150; bob: 300*600/400 = 450 → pool exhausted.
        assertEq(usdg.balanceOf(alice) - aBefore, 150e18);
        assertEq(usdg.balanceOf(bob) - bBefore, 450e18);
        assertEq(usdg.balanceOf(address(market)), 0);
    }

    function test_claim_doubleClaim_reverts() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _enter(bob, IMarket.Side.NO, 100e18);
        _lock();
        _resolveWith(150e18);
        vm.prank(alice);
        market.claim();
        vm.expectRevert();
        vm.prank(alice);
        market.claim();
    }

    function test_claim_previewPayout_matchesFormula() public {
        (uint256 gross, uint256 profit, uint256 fee, uint256 net) =
            market.previewPayout(100e18, 100e18, 300e18);
        assertEq(gross, 400e18);
        assertEq(profit, 300e18);
        assertEq(fee, 0);
        assertEq(net, 400e18);
    }

    function test_claim_whenPaused_stillWorks() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _enter(bob, IMarket.Side.NO, 100e18);
        _lock();
        _resolveWith(150e18);
        _pause();
        // Pause must never block claims.
        uint256 before = usdg.balanceOf(alice);
        vm.prank(alice);
        market.claim();
        // gross = 100 * 200 / 100 = 200
        assertEq(usdg.balanceOf(alice) - before, 200e18);
    }

    // ------------------------------------------------------------------
    // Cancellation / refunds
    // ------------------------------------------------------------------

    function test_refund_afterCancel_returnsPrincipal() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _enter(bob, IMarket.Side.NO, 300e18);
        _cancel();
        assertEq(uint8(market.status()), uint8(IMarket.Status.CANCELLED));

        uint256 aBefore = usdg.balanceOf(alice);
        uint256 bBefore = usdg.balanceOf(bob);
        vm.prank(alice);
        market.refund();
        vm.prank(bob);
        market.refund();
        assertEq(usdg.balanceOf(alice) - aBefore, 100e18);
        assertEq(usdg.balanceOf(bob) - bBefore, 300e18);
        assertEq(usdg.balanceOf(address(market)), 0);
    }

    function test_refund_doubleRefund_reverts() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _cancel();
        vm.prank(alice);
        market.refund();
        vm.expectRevert();
        vm.prank(alice);
        market.refund();
    }

    function test_refund_nonStaker_reverts() public {
        _cancel();
        vm.expectRevert();
        vm.prank(stranger);
        market.refund();
    }

    function test_refund_whenPaused_stillWorks() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _pause();
        _cancel();
        uint256 before = usdg.balanceOf(alice);
        vm.prank(alice);
        market.refund();
        assertEq(usdg.balanceOf(alice) - before, 100e18);
    }

    function test_cancelAfterOracleTimeout_requiresDeadline() public {
        BinaryPoolMarket delayed = _createMarketWithGracePeriod(
            IMarket.Comparator.PRICE_ABOVE_AT_TIME,
            100e18,
            0,
            MIN_ENTRY,
            0,
            DEFAULT_OPEN_TIME,
            DEFAULT_LOCK_TIME,
            DEFAULT_RESOLUTION_TIME,
            1 days
        );
        vm.prank(alice);
        usdg.approve(address(delayed), type(uint256).max);
        vm.prank(alice);
        delayed.enter(IMarket.Side.YES, 100e18);
        vm.warp(DEFAULT_LOCK_TIME);
        delayed.lock();
        vm.prank(owner);
        registry.setPaused(assetKey, true);
        vm.warp(DEFAULT_RESOLUTION_TIME + 1 days - 1);

        vm.expectRevert(BinaryPoolMarket.TooEarly.selector);
        delayed.cancelAfterOracleTimeout();

        vm.warp(DEFAULT_RESOLUTION_TIME + 1 days);
        delayed.cancelAfterOracleTimeout();
        assertEq(uint8(delayed.status()), uint8(IMarket.Status.CANCELLED));
    }

    function test_cancelAfterOracleTimeout_rejectsHealthyOracle() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _lock();
        vm.warp(DEFAULT_RESOLUTION_TIME);
        feed.setAnswer(150e18);

        vm.expectRevert(BinaryPoolMarket.OracleHealthy.selector);
        market.cancelAfterOracleTimeout();
    }

    function test_cancelAfterOracleTimeout_isPermissionlessAndRefunds() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _lock();
        vm.prank(owner);
        registry.setPaused(assetKey, true);
        vm.warp(DEFAULT_RESOLUTION_TIME);

        vm.prank(stranger);
        market.cancelAfterOracleTimeout();
        assertEq(uint8(market.status()), uint8(IMarket.Status.CANCELLED));

        uint256 before = usdg.balanceOf(alice);
        vm.prank(alice);
        market.refund();
        assertEq(usdg.balanceOf(alice) - before, 100e18);
    }

    function test_changedOracleConfig_blocksResolutionAndAllowsTimeoutCancel() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _enter(bob, IMarket.Side.NO, 100e18);
        _lock();
        vm.prank(owner);
        registry.setAssetConfig(
            assetKey,
            address(feed),
            address(sequencer),
            DEFAULT_HEARTBEAT + 1,
            DEFAULT_GRACE_PERIOD,
            false
        );
        vm.warp(DEFAULT_RESOLUTION_TIME);
        feed.setAnswer(150e18);

        vm.expectRevert(BinaryPoolMarket.OracleConfigChanged.selector);
        market.resolve();
        market.cancelAfterOracleTimeout();
        assertEq(uint8(market.status()), uint8(IMarket.Status.CANCELLED));
    }

    // ------------------------------------------------------------------
    // Admin restrictions
    // ------------------------------------------------------------------

    function test_cancel_onlyOwner() public {
        vm.expectRevert();
        vm.prank(stranger);
        market.cancel();
    }

    function test_cancel_afterResolved_reverts() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        _lock();
        _resolveWith(150e18);
        vm.expectRevert();
        _cancel();
    }

    function test_pause_onlyOwner() public {
        vm.expectRevert();
        vm.prank(stranger);
        market.pause();
    }

    function test_admin_cannotWithdrawPrincipal() public {
        _enter(alice, IMarket.Side.YES, 100e18);
        // No withdraw function exists on the market; the balance is untouched
        // by any owner action.
        assertEq(usdg.balanceOf(address(market)), 100e18);
        _cancel();
        assertEq(usdg.balanceOf(address(market)), 100e18);
    }
}
