// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {IMarket} from "../src/interfaces/IMarket.sol";

/// @notice The Phase 1 exit criterion as a test: create a market, two wallets
///         enter opposite sides, advance time, resolve from the oracle, and
///         the winning wallet claims.
contract VerticalSliceTest is BaseTest {
    function test_verticalSlice_enter_lock_resolve_claim() public {
        // Market created in setUp (PONS above 100, fee 0, min entry 1 USDG).

        // 1. Wallet A enters YES with 1_000 USDG.
        _enter(alice, IMarket.Side.YES, 1_000e18);
        assertEq(market.yesPool(), 1_000e18);

        // 2. Wallet B enters NO with 500 USDG.
        _enter(bob, IMarket.Side.NO, 500e18);
        assertEq(market.noPool(), 500e18);

        // 3. Advance to lock time and lock.
        _lock();
        assertEq(uint8(market.status()), uint8(IMarket.Status.LOCKED));

        // 4. Advance to resolution time, then the oracle prints a price above
        //    the strike (fresh round — never stale).
        vm.warp(DEFAULT_RESOLUTION_TIME);
        feed.setAnswer(150e18);

        // 5. Anyone resolves.
        vm.prank(stranger);
        market.resolve();
        assertEq(uint8(market.status()), uint8(IMarket.Status.RESOLVED));
        assertEq(uint8(market.winningOutcome()), uint8(IMarket.Side.YES));
        assertEq(market.resolvedPrice(), 150e18);

        // 6. Winner claims the full pool: 1_000 * 1_500 / 1_000 = 1_500 USDG.
        uint256 before = usdg.balanceOf(alice);
        vm.prank(alice);
        market.claim();
        assertEq(usdg.balanceOf(alice) - before, 1_500e18);

        // Loser gets nothing; contract drained.
        vm.expectRevert();
        vm.prank(bob);
        market.claim();
        assertEq(usdg.balanceOf(address(market)), 0);

        // 7. Winner cannot double-claim.
        vm.expectRevert();
        vm.prank(alice);
        market.claim();
    }

    function test_verticalSlice_secondWalletWins() public {
        _enter(alice, IMarket.Side.YES, 1_000e18);
        _enter(bob, IMarket.Side.NO, 500e18);
        _lock();
        vm.warp(DEFAULT_RESOLUTION_TIME);
        feed.setAnswer(90e18); // below strike → NO wins
        market.resolve();
        assertEq(uint8(market.winningOutcome()), uint8(IMarket.Side.NO));

        uint256 before = usdg.balanceOf(bob);
        vm.prank(bob);
        market.claim();
        // 500 * 1_500 / 500 = 1_500.
        assertEq(usdg.balanceOf(bob) - before, 1_500e18);
        assertEq(usdg.balanceOf(address(market)), 0);
    }
}
