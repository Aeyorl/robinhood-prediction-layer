// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OracleRegistry} from "../src/oracle/OracleRegistry.sol";
import {ChainlinkPriceResolver} from "../src/oracle/ChainlinkPriceResolver.sol";
import {FeeVault} from "../src/fee/FeeVault.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";

/// @notice Production deployment of the protocol core (registry, resolver,
///         fee vault, factory).
///
/// NOT wired into CI or any automated workflow. Requires an explicitly
/// approved, manually triggered run (see .github/workflows/deploy-mainnet.yml
/// and docs/deployment.md).
///
/// Env:
///   CHAIN_ID             — 4663 (mainnet) or 46630 (testnet)
///   FEE_RECIPIENT        — address that receives protocol fees
///   OWNER                — protocol admin (multisig in production)
///   CONFIG_JSON          — optional path to a JSON file of {assetKey: {...}}
///                          feed configs to preload into the registry
contract Deploy is Script {
    function run() external {
        uint256 chainId = vm.envUint("CHAIN_ID");
        address owner = vm.envAddress("OWNER");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        require(chainId == 4663 || chainId == 46630, "unsupported CHAIN_ID");

        vm.startBroadcast();

        OracleRegistry registry = new OracleRegistry(owner);
        ChainlinkPriceResolver resolver = new ChainlinkPriceResolver(owner, registry);
        FeeVault feeVault = new FeeVault(owner, feeRecipient);
        MarketFactory factory = new MarketFactory(owner);

        vm.stopBroadcast();

        console2.log("Deployed on chain", chainId);
        console2.log("  oracleRegistry   ", address(registry));
        console2.log("  chainlinkResolver", address(resolver));
        console2.log("  feeVault         ", address(feeVault));
        console2.log("  factory          ", address(factory));
        console2.log("NOTE: USDG/collateral and Uniswap router addresses must be");
        console2.log("re-verified against official docs before market creation.");
    }
}
