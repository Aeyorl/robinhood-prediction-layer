// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockSwapAdapter} from "../src/mocks/MockSwapAdapter.sol";

contract MockSwapAdapterTest is Test {
    MockUSDG internal usdg;
    MockERC20 internal pons;
    MockSwapAdapter internal adapter;

    address internal owner = makeAddr("owner");
    address internal alice = makeAddr("alice");
    address internal recipient = makeAddr("recipient");

    function setUp() public {
        usdg = new MockUSDG();
        pons = new MockERC20("Mock PONS", "PONS", 18);
        // The test contract deploys the adapter, so it is also the owner.
        adapter = new MockSwapAdapter(usdg);

        adapter.setRate(address(pons), 120e18); // 1 PONS = 120 USDG
        usdg.mint(address(adapter), 1_000_000e18);

        pons.mint(alice, 1_000e18);
        vm.prank(alice);
        pons.approve(address(adapter), type(uint256).max);
    }

    function test_QuoteMatchesRate() public view {
        assertEq(adapter.quote(address(pons), 2e18), 240e18);
        assertEq(adapter.quote(address(pons), 1e17), 12e18);
    }

    function test_QuoteRevertsForUnknownToken() public {
        MockERC20 unknown = new MockERC20("Unknown", "UNK", 18);
        vm.expectRevert(
            abi.encodeWithSelector(MockSwapAdapter.UnknownToken.selector, address(unknown))
        );
        adapter.quote(address(unknown), 1e18);
    }

    function test_SwapTransfersTokensAtRate() public {
        vm.prank(alice);
        uint256 out = adapter.swap(address(pons), 2e18, 240e18, recipient);

        assertEq(out, 240e18);
        assertEq(pons.balanceOf(alice), 998e18);
        assertEq(pons.balanceOf(address(adapter)), 2e18);
        assertEq(usdg.balanceOf(recipient), 240e18);
    }

    function test_SwapEmitsEvent() public {
        vm.prank(alice);
        vm.expectEmit(true, true, true, true);
        emit MockSwapAdapter.Swap(alice, address(pons), address(usdg), 2e18, 240e18, recipient);
        adapter.swap(address(pons), 2e18, 0, recipient);
    }

    function test_SwapHonorsMinAmountOut() public {
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MockSwapAdapter.InsufficientOutput.selector, 240e18, 241e18)
        );
        adapter.swap(address(pons), 2e18, 241e18, recipient);
    }

    function test_SwapRevertsWhenUsdgLiquidityExhausted() public {
        // Sweep all USDG liquidity away, leaving the adapter unable to pay out.
        adapter.sweep(address(usdg), owner, usdg.balanceOf(address(adapter)));

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(MockSwapAdapter.InsufficientUsdgLiquidity.selector, 240e18, 0)
        );
        adapter.swap(address(pons), 2e18, 0, recipient);
    }

    function test_SwapRevertsOnZeroAmount() public {
        vm.prank(alice);
        vm.expectRevert(MockSwapAdapter.ZeroAmount.selector);
        adapter.swap(address(pons), 0, 0, recipient);
    }

    function test_OnlyOwnerCanSetRateAndSweep() public {
        vm.prank(alice);
        vm.expectRevert();
        adapter.setRate(address(pons), 1e18);

        vm.prank(alice);
        vm.expectRevert();
        adapter.sweep(address(pons), alice, 1e18);
    }

    function test_RateUpdateChangesQuotes() public {
        adapter.setRate(address(pons), 60e18);
        assertEq(adapter.quote(address(pons), 2e18), 120e18);
    }
}
