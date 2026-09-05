// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockSwapAdapter} from "../src/mocks/MockSwapAdapter.sol";
import {PredictionEntryRouter} from "../src/router/PredictionEntryRouter.sol";
import {BinaryPoolMarket} from "../src/market/BinaryPoolMarket.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {OracleRegistry} from "../src/oracle/OracleRegistry.sol";
import {ChainlinkPriceResolver} from "../src/oracle/ChainlinkPriceResolver.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {IMarket} from "../src/interfaces/IMarket.sol";

contract PredictionEntryRouterTest is Test {
    MockUSDG internal usdg;
    MockERC20 internal token;
    MockSwapAdapter internal adapter;
    MarketFactory internal factory;
    BinaryPoolMarket internal market;
    PredictionEntryRouter internal router;
    address internal alice = makeAddr("alice");

    function setUp() public {
        usdg = new MockUSDG();
        token = new MockERC20("Token", "TOK", 18);
        adapter = new MockSwapAdapter(usdg);
        adapter.setRate(address(token), 2e18);
        usdg.mint(address(adapter), 1_000_000e18);
        factory = new MarketFactory(address(this));
        OracleRegistry registry = new OracleRegistry(address(this));
        MockAggregatorV3 feed = new MockAggregatorV3(18);
        bytes32 key = keccak256(abi.encode(block.chainid, address(token)));
        registry.setAssetConfig(key, address(feed), address(0), 1 hours, 0, false);
        ChainlinkPriceResolver resolver = new ChainlinkPriceResolver(address(this), registry);
        market = factory.createMarket(
            BinaryPoolMarket.MarketParams({
                collateral: address(usdg),
                resolver: address(resolver),
                oracleAssetKey: key,
                comparator: IMarket.Comparator.PRICE_ABOVE_AT_TIME,
                strike: 1e18,
                strikeDecimals: 18,
                openTime: block.timestamp,
                lockTime: block.timestamp + 1 days,
                resolutionTime: block.timestamp + 2 days,
                gracePeriod: 1 days,
                feeBps: 0,
                minEntry: 1,
                maxEntry: 0,
                question: "Test?",
                metadataUri: "",
                feeVault: address(this)
            })
        );
        router = new PredictionEntryRouter(address(this), usdg, factory);
        router.setSwapTarget(address(adapter), true);
        token.mint(alice, 100e18);
        vm.prank(alice);
        token.approve(address(router), 10e18);
    }

    function test_atomicSwapAndEntryCreditsUserAndClearsAllowances() public {
        bytes memory data =
            abi.encodeCall(adapter.swap, (address(token), 10e18, 20e18, address(router)));
        vm.expectEmit(true, true, true, true);
        emit PredictionEntryRouter.FundingRouted(
            alice, address(market), address(token), 10e18, 20e18, IMarket.Side.YES
        );
        vm.prank(alice);
        uint256 out = router.enterWithToken(
            address(market),
            IMarket.Side.YES,
            token,
            10e18,
            20e18,
            address(adapter),
            data,
            block.timestamp
        );
        assertEq(out, 20e18);
        assertEq(market.userStake(alice, IMarket.Side.YES), 20e18);
        assertEq(token.balanceOf(address(router)), 0);
        assertEq(usdg.balanceOf(address(router)), 0);
        assertEq(token.allowance(address(router), address(adapter)), 0);
        assertEq(usdg.allowance(address(router), address(market)), 0);
    }

    function test_rejectsUnknownMarketAndExpiredQuote() public {
        bytes memory data =
            abi.encodeCall(adapter.swap, (address(token), 10e18, 20e18, address(router)));
        vm.startPrank(alice);
        vm.expectRevert(PredictionEntryRouter.UnknownMarket.selector);
        router.enterWithToken(
            address(0x1234),
            IMarket.Side.YES,
            token,
            10e18,
            20e18,
            address(adapter),
            data,
            block.timestamp
        );
        vm.warp(block.timestamp + 1);
        vm.expectRevert(PredictionEntryRouter.Expired.selector);
        router.enterWithToken(
            address(market),
            IMarket.Side.YES,
            token,
            10e18,
            20e18,
            address(adapter),
            data,
            block.timestamp - 1
        );
        vm.stopPrank();
    }

    function test_onlyOwnerCanChangeSwapTargets() public {
        vm.prank(alice);
        vm.expectRevert();
        router.setSwapTarget(address(0x1234), true);
    }
}
