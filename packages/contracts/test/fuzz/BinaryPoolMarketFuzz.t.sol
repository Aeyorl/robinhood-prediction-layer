// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "../Base.t.sol";
import {BinaryPoolMarket} from "../../src/market/BinaryPoolMarket.sol";
import {IMarket} from "../../src/interfaces/IMarket.sol";

/// @notice Fuzzes the parimutuel payout: whatever the stakes, the claimed
///         amounts must match the exact floor formula and the contract must
///         remain solvent (nothing stuck, no overpayment).
contract BinaryPoolMarketFuzzTest is BaseTest {
    function _bounded(uint256 x) internal pure returns (uint256) {
        // [MIN_ENTRY, 100_000e18]
        return MIN_ENTRY + (x % 100_000e18);
    }

    function testFuzz_payoutMath_exactAndSolvent(
        uint256 aYes,
        uint256 aNo,
        uint256 bYes,
        uint256 bNo,
        uint256 cYes,
        uint256 cNo,
        int256 deltaSeed
    ) public {
        uint256[3] memory yesStakes = [_bounded(aYes), _bounded(bYes), _bounded(cYes)];
        uint256[3] memory noStakes = [_bounded(aNo), _bounded(bNo), _bounded(cNo)];
        address[3] memory users = [alice, bob, carol];

        uint256 yesPool;
        uint256 noPool;
        for (uint256 i = 0; i < 3; i++) {
            if (yesStakes[i] > 0) {
                _enter(users[i], IMarket.Side.YES, yesStakes[i]);
                yesPool += yesStakes[i];
            }
            if (noStakes[i] > 0) {
                _enter(users[i], IMarket.Side.NO, noStakes[i]);
                noPool += noStakes[i];
            }
        }
        // At least one side must have stake for the rest of the flow.
        vm.assume(yesPool > 0 && noPool > 0);

        // Price in [50e18, 150e18]; positive and safely above zero.
        // Equality with the 100e18 strike is possible and exercises the
        // cancel/refund path.
        uint256 delta = uint256(deltaSeed) % 100_000e15;
        int256 price = 50e18 + int256(delta);

        _lock();
        _resolveWith(price);

        if (uint8(market.status()) == uint8(IMarket.Status.CANCELLED)) {
            // Equality → everyone gets principal back.
            for (uint256 i = 0; i < 3; i++) {
                uint256 principal = yesStakes[i] + noStakes[i];
                uint256 before = usdg.balanceOf(users[i]);
                vm.prank(users[i]);
                market.refund();
                assertEq(usdg.balanceOf(users[i]) - before, principal);
            }
            assertEq(usdg.balanceOf(address(market)), 0);
            return;
        }

        assertEq(uint8(market.status()), uint8(IMarket.Status.RESOLVED));
        bool yesWon = uint8(market.winningOutcome()) == uint8(IMarket.Side.YES);
        uint256 winningPool = yesWon ? yesPool : noPool;
        uint256 losingPool = yesWon ? noPool : yesPool;
        uint256 totalPool = winningPool + losingPool;

        uint256 totalPaid;
        for (uint256 i = 0; i < 3; i++) {
            uint256 stake = yesWon ? yesStakes[i] : noStakes[i];
            if (stake == 0) continue;

            uint256 expectedGross = (stake * totalPool) / winningPool;
            uint256 expectedProfit = expectedGross - stake;
            uint256 expectedFee = (expectedProfit * 0) / FEE_DENOMINATOR; // fee = 0
            uint256 expectedNet = expectedGross - expectedFee;

            uint256 before = usdg.balanceOf(users[i]);
            vm.prank(users[i]);
            market.claim();
            assertEq(usdg.balanceOf(users[i]) - before, expectedNet);
            totalPaid += expectedNet;
        }

        // Solvency: floor rounding guarantees winners receive <= the full pool;
        // any dust (strictly less than the number of winners) stays in the
        // contract. Nothing is ever overpaid.
        assertLe(totalPaid, totalPool);
        assertEq(usdg.balanceOf(address(market)), totalPool - totalPaid);
        assertLt(totalPool - totalPaid, 3); // < number of potential winners
    }

    function testFuzz_payout_withFee_exactAndSolvent(uint256 aYes, uint256 bNo, uint256 feeBps)
        public
    {
        uint256 stakeA = _bounded(aYes);
        uint256 stakeB = _bounded(bNo);
        feeBps = feeBps % 1_001; // [0, 1000] within the hard cap
        vm.assume(stakeA > 0 && stakeB > 0);

        BinaryPoolMarket feeMarket = _createMarket(
            IMarket.Comparator.PRICE_ABOVE_AT_TIME,
            100e18,
            feeBps,
            MIN_ENTRY,
            0,
            DEFAULT_OPEN_TIME,
            DEFAULT_LOCK_TIME,
            DEFAULT_RESOLUTION_TIME
        );
        vm.prank(alice);
        usdg.approve(address(feeMarket), type(uint256).max);
        vm.prank(alice);
        feeMarket.enter(IMarket.Side.YES, stakeA);
        vm.prank(bob);
        usdg.approve(address(feeMarket), type(uint256).max);
        vm.prank(bob);
        feeMarket.enter(IMarket.Side.NO, stakeB);

        vm.warp(DEFAULT_LOCK_TIME);
        feeMarket.lock();
        vm.warp(DEFAULT_RESOLUTION_TIME);
        feed.setAnswer(150e18); // YES wins
        feeMarket.resolve();

        uint256 totalPool = stakeA + stakeB;
        uint256 expectedGross = (stakeA * totalPool) / stakeA; // = totalPool (single winner)
        uint256 expectedProfit = expectedGross - stakeA;
        uint256 expectedFee = (expectedProfit * feeBps) / FEE_DENOMINATOR;
        uint256 expectedNet = expectedGross - expectedFee;

        uint256 before = usdg.balanceOf(alice);
        vm.prank(alice);
        feeMarket.claim();
        assertEq(usdg.balanceOf(alice) - before, expectedNet);
        assertEq(usdg.balanceOf(address(feeVault)), expectedFee);
        // Loser's stake + winner's stake covered exactly.
        assertEq(usdg.balanceOf(address(feeMarket)), 0);
    }
}
