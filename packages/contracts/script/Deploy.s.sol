// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {OracleRegistry} from "../src/oracle/OracleRegistry.sol";
import {ChainlinkPriceResolver} from "../src/oracle/ChainlinkPriceResolver.sol";
import {DataStreamsRwaResolver} from "../src/oracle/DataStreamsRwaResolver.sol";
import {SafeClosingPriceResolver} from "../src/oracle/SafeClosingPriceResolver.sol";
import {IVerifierProxy} from "../src/interfaces/IVerifierProxy.sol";
import {FeeVault} from "../src/fee/FeeVault.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {PredictionEntryRouter} from "../src/router/PredictionEntryRouter.sol";
import {ProtocolTimelock} from "../src/governance/ProtocolTimelock.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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
///   SAFE_ADDRESS         — production multisig; sole proposer/executor
///   USDG_ADDRESS         — canonical collateral, re-verified before execution
///   SWAP_TARGET          — audited production swap router to allowlist
///   DATA_STREAMS_VERIFIER — optional Chainlink Data Streams verifier proxy
///   CONFIG_JSON          — optional path to a JSON file of {assetKey: {...}}
///                          feed configs to preload into the registry
contract Deploy is Script {
    function run() external {
        uint256 chainId = vm.envUint("CHAIN_ID");
        address safe = vm.envAddress("SAFE_ADDRESS");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");
        address usdg = vm.envAddress("USDG_ADDRESS");
        address swapTarget = vm.envAddress("SWAP_TARGET");
        address dataStreamsVerifier = vm.envOr("DATA_STREAMS_VERIFIER", address(0));
        require(chainId == 4663 || chainId == 46630, "unsupported CHAIN_ID");
        require(safe != address(0) && usdg != address(0) && swapTarget != address(0), "zero address");

        vm.startBroadcast();

        ProtocolTimelock timelock = new ProtocolTimelock(safe);
        OracleRegistry registry = new OracleRegistry(address(timelock));
        ChainlinkPriceResolver resolver = new ChainlinkPriceResolver(address(timelock), registry);
        address dataStreamsResolver;
        if (dataStreamsVerifier != address(0)) {
            dataStreamsResolver =
                address(new DataStreamsRwaResolver(address(timelock), IVerifierProxy(dataStreamsVerifier)));
        }
        SafeClosingPriceResolver safeClosingPriceResolver = new SafeClosingPriceResolver(address(timelock), safe);
        FeeVault feeVault = new FeeVault(address(timelock), feeRecipient);
        MarketFactory factory = new MarketFactory(address(timelock));
        PredictionEntryRouter router = new PredictionEntryRouter(address(timelock), IERC20(usdg), factory);

        vm.stopBroadcast();

        console2.log("Deployed on chain", chainId);
        console2.log("  timelock         ", address(timelock));
        console2.log("  oracleRegistry   ", address(registry));
        console2.log("  chainlinkResolver", address(resolver));
        console2.log("  streamsResolver  ", dataStreamsResolver);
        console2.log("  safeCloseResolver", address(safeClosingPriceResolver));
        console2.log("  feeVault         ", address(feeVault));
        console2.log("  factory          ", address(factory));
        console2.log("  entryRouter      ", address(router));
        console2.log("Schedule router.setSwapTarget through the Safe/timelock after verification:");
        console2.log("  swapTarget       ", swapTarget);
        console2.log("NOTE: USDG/collateral and Uniswap router addresses must be");
        console2.log("re-verified against official docs before market creation.");
    }
}
