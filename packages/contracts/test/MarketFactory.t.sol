// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {BaseTest} from "./Base.t.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPoolMarket} from "../src/market/BinaryPoolMarket.sol";
import {IMarket} from "../src/interfaces/IMarket.sol";

contract MarketFactoryTest is BaseTest {
    function _params() internal view returns (BinaryPoolMarket.MarketParams memory) {
        return BinaryPoolMarket.MarketParams({
            collateral: address(usdg),
            resolver: address(resolver),
            oracleAssetKey: assetKey,
            comparator: IMarket.Comparator.PRICE_ABOVE_AT_TIME,
            strike: 100e18,
            strikeDecimals: 18,
            openTime: DEFAULT_OPEN_TIME,
            lockTime: DEFAULT_LOCK_TIME,
            resolutionTime: DEFAULT_RESOLUTION_TIME,
            gracePeriod: DEFAULT_GRACE_PERIOD,
            feeBps: 0,
            minEntry: MIN_ENTRY,
            maxEntry: 0,
            question: "Will the price be above the strike at resolution?",
            metadataUri: "",
            feeVault: address(feeVault)
        });
    }

    function test_createMarket_onlyOwner() public {
        vm.expectRevert();
        vm.prank(stranger);
        factory.createMarket(_params());
    }

    function test_createMarket_succeedsAndTracks() public {
        uint256 countBefore = factory.marketCount();
        vm.prank(owner);
        BinaryPoolMarket m = factory.createMarket(_params());

        assertEq(factory.marketCount(), countBefore + 1);
        assertEq(factory.marketIndex(address(m)), countBefore + 1);
        assertEq(address(factory.markets(countBefore)), address(m));
        assertEq(address(m.collateral()), address(usdg));
        assertEq(uint8(m.status()), uint8(IMarket.Status.OPEN));
        assertEq(m.feeBps(), 0);
    }

    function test_createMarket_feeAboveCap_reverts() public {
        BinaryPoolMarket.MarketParams memory p = _params();
        p.feeBps = 1_001; // cap is 1_000
        vm.expectRevert();
        vm.prank(owner);
        factory.createMarket(p);
    }

    function test_createMarket_invalidTimes_reverts() public {
        BinaryPoolMarket.MarketParams memory p = _params();
        p.lockTime = p.openTime; // open must be before lock
        vm.expectRevert();
        vm.prank(owner);
        factory.createMarket(p);
    }

    function test_createMarket_zeroMinEntry_reverts() public {
        BinaryPoolMarket.MarketParams memory p = _params();
        p.minEntry = 0;
        vm.expectRevert();
        vm.prank(owner);
        factory.createMarket(p);
    }

    function test_createMarket_emptyQuestion_reverts() public {
        BinaryPoolMarket.MarketParams memory p = _params();
        p.question = "";
        vm.expectRevert();
        vm.prank(owner);
        factory.createMarket(p);
    }

    function test_createMarket_nonPositiveStrike_reverts() public {
        BinaryPoolMarket.MarketParams memory p = _params();
        p.strike = 0;
        vm.expectRevert();
        vm.prank(owner);
        factory.createMarket(p);
    }

    function test_createMarket_unconfiguredOracleAsset_reverts() public {
        BinaryPoolMarket.MarketParams memory p = _params();
        p.oracleAssetKey = keccak256("unknown");
        vm.expectRevert(bytes("oracle asset not configured"));
        vm.prank(owner);
        factory.createMarket(p);
    }

    function test_factoryControlsMarketPause() public {
        vm.prank(owner);
        factory.pauseMarket(address(market));
        vm.expectRevert();
        _enter(alice, IMarket.Side.YES, 1e18);

        vm.prank(owner);
        factory.unpauseMarket(address(market));
        _enter(alice, IMarket.Side.YES, 1e18);
    }

    function test_factoryCancelsMarket() public {
        _enter(alice, IMarket.Side.YES, 1e18);
        vm.prank(owner);
        factory.cancelMarket(address(market));
        assertEq(uint8(market.status()), uint8(IMarket.Status.CANCELLED));
    }
}
