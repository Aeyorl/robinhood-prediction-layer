// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {SafeClosingPriceResolver} from "../src/oracle/SafeClosingPriceResolver.sol";

contract SafeClosingPriceResolverForkTest is Test {
    uint256 private constant REFERENCE_TIME = 1_788_000_000;

    function test_robinhoodMainnetForkObservationLifecycle() public {
        string memory rpcUrl = vm.envOr("RPC_HTTP_URL", string(""));
        if (bytes(rpcUrl).length == 0) return;

        vm.createSelectFork(rpcUrl);
        assertEq(block.chainid, 4663, "RPC_HTTP_URL is not Robinhood Chain mainnet");

        address timelock = makeAddr("rehearsalTimelock");
        address guardian = makeAddr("rehearsalSafe");
        bytes32 assetKey = keccak256("NVDA");
        vm.warp(REFERENCE_TIME);
        SafeClosingPriceResolver resolver = new SafeClosingPriceResolver(timelock, guardian);

        vm.prank(timelock);
        resolver.setAssetConfig(assetKey, 18, 24 hours, 2 days, false);
        vm.prank(timelock);
        resolver.proposeObservation(
            assetKey,
            REFERENCE_TIME,
            200e18,
            keccak256("fork-rehearsal-evidence"),
            "ipfs://fork-rehearsal-evidence"
        );

        assertTrue(resolver.resolutionAvailable(assetKey, REFERENCE_TIME));
        vm.warp(REFERENCE_TIME + 24 hours);
        (int256 price, uint8 decimals) = resolver.resolve(assetKey, REFERENCE_TIME, "");
        assertEq(price, 200e18);
        assertEq(decimals, 18);
    }
}
