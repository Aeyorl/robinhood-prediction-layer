// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {MockUSDG} from "../src/mocks/MockUSDG.sol";
import {MockERC20} from "../src/mocks/MockERC20.sol";
import {MockSwapAdapter} from "../src/mocks/MockSwapAdapter.sol";
import {MockAggregatorV3} from "../src/mocks/MockAggregatorV3.sol";
import {MockSequencerFeed} from "../src/mocks/MockSequencerFeed.sol";
import {OracleRegistry} from "../src/oracle/OracleRegistry.sol";
import {ChainlinkPriceResolver} from "../src/oracle/ChainlinkPriceResolver.sol";
import {FeeVault} from "../src/fee/FeeVault.sol";
import {MarketFactory} from "../src/market/MarketFactory.sol";
import {BinaryPoolMarket} from "../src/market/BinaryPoolMarket.sol";
import {IMarket} from "../src/interfaces/IMarket.sol";
import {PredictionEntryRouter} from "../src/router/PredictionEntryRouter.sol";

/// @notice Deploys the full local vertical slice and writes
///         `deployments/local.json` consumed by `pnpm seed`.
///
/// Usage (anvil must be running on 8545):
///   forge script script/DeployLocal.s.sol --rpc-url http://127.0.0.1:8545 --broadcast
///
/// All data produced is LOCAL/TEST data — it must never masquerade as live
/// mainnet data.
contract DeployLocal is Script {
    function run() external {
        vm.createDir("deployments", true);

        vm.startBroadcast();

        // ------------------------------------------------------------------
        // Mocks
        // ------------------------------------------------------------------
        MockUSDG usdg = new MockUSDG();
        MockERC20 pons = new MockERC20("Mock PONS", "PONS", 18);
        MockERC20 delta = new MockERC20("Mock DELTA", "DELTA", 18);
        MockERC20 ai = new MockERC20("Mock AI", "AI", 18);

        // ------------------------------------------------------------------
        // Oracle stack
        // ------------------------------------------------------------------
        OracleRegistry registry = new OracleRegistry(msg.sender);
        ChainlinkPriceResolver resolver = new ChainlinkPriceResolver(msg.sender, registry);
        FeeVault feeVault = new FeeVault(msg.sender, msg.sender);
        MarketFactory factory = new MarketFactory(msg.sender);

        // Feeds: 18 decimals to match strike decimals for demo markets.
        MockAggregatorV3 ponsFeed = new MockAggregatorV3(18);
        MockAggregatorV3 deltaFeed = new MockAggregatorV3(18);
        MockAggregatorV3 aiFeed = new MockAggregatorV3(18);
        MockSequencerFeed sequencer = new MockSequencerFeed();

        registry.setAssetConfig(
            _key(address(pons)), address(ponsFeed), address(sequencer), 1 hours, 1 hours, false
        );
        registry.setAssetConfig(
            _key(address(delta)), address(deltaFeed), address(sequencer), 1 hours, 1 hours, false
        );
        registry.setAssetConfig(
            _key(address(ai)), address(aiFeed), address(sequencer), 1 hours, 1 hours, false
        );

        // Live oracle values for the demo markets.
        ponsFeed.setAnswer(120e18);
        deltaFeed.setAnswer(40e18);
        aiFeed.setAnswer(0.02e18);

        // ------------------------------------------------------------------
        // Local swap venue for the funding layer (Phase 4)
        // ------------------------------------------------------------------
        MockSwapAdapter swapAdapter = new MockSwapAdapter(IERC20(address(usdg)));
        // Rates mirror the mock feed prices: 1 PONS = 120 USDG, etc.
        swapAdapter.setRate(address(pons), 120e18);
        swapAdapter.setRate(address(delta), 40e18);
        swapAdapter.setRate(address(ai), 0.02e18);
        usdg.mint(address(swapAdapter), 1_000_000e18);
        PredictionEntryRouter entryRouter = new PredictionEntryRouter(msg.sender, usdg, factory);
        entryRouter.setSwapTarget(address(swapAdapter), true);

        // ------------------------------------------------------------------
        // Example markets (default testnet fee = 0)
        // ------------------------------------------------------------------
        uint256 now_ = block.timestamp;
        uint256 openTime = now_ - 1 hours;
        uint256 lockTime = now_ + 1 days;
        uint256 resolutionTime = now_ + 3 days;
        uint256 gracePeriod = 1 days;

        address m1 = _createMarket(
            factory,
            usdg,
            resolver,
            address(pons),
            IMarket.Comparator.PRICE_ABOVE_AT_TIME,
            100e18,
            openTime,
            lockTime,
            resolutionTime,
            gracePeriod,
            address(feeVault),
            "Will the price of PONS be above 100 USDG at resolution time?"
        );
        address m2 = _createMarket(
            factory,
            usdg,
            resolver,
            address(delta),
            IMarket.Comparator.PRICE_BELOW_AT_TIME,
            50e18,
            openTime,
            lockTime,
            resolutionTime,
            gracePeriod,
            address(feeVault),
            "Will the price of DELTA be below 50 USDG at resolution time?"
        );
        address m3 = _createMarket(
            factory,
            usdg,
            resolver,
            address(ai),
            IMarket.Comparator.PRICE_ABOVE_AT_TIME,
            0.01e18,
            openTime,
            lockTime,
            resolutionTime,
            gracePeriod,
            address(feeVault),
            "Will the price of AI be above 0.01 USDG at resolution time?"
        );

        // ------------------------------------------------------------------
        // Demo funds
        // ------------------------------------------------------------------
        uint256 demoAmount = 10_000e18;
        usdg.mint(msg.sender, demoAmount);
        pons.mint(msg.sender, demoAmount);
        delta.mint(msg.sender, demoAmount);
        ai.mint(msg.sender, demoAmount);

        vm.stopBroadcast();

        // ------------------------------------------------------------------
        // Deployment manifest (consumed by pnpm seed)
        // ------------------------------------------------------------------
        string memory mocksJson = string.concat(
            _token("USDG", address(usdg), "USDG", 18),
            ",",
            _token("PONS", address(pons), "PONS", 18),
            ",",
            _token("DELTA", address(delta), "DELTA", 18),
            ",",
            _token("AI", address(ai), "AI", 18)
        );
        string memory marketsJson = string.concat(
            _market(
                m1,
                "pons-above-100",
                "Will the price of PONS be above 100 USDG at resolution time?",
                "PRICE_ABOVE_AT_TIME",
                100e18,
                address(pons),
                address(ponsFeed),
                openTime,
                lockTime,
                resolutionTime,
                gracePeriod
            ),
            ",",
            _market(
                m2,
                "delta-below-50",
                "Will the price of DELTA be below 50 USDG at resolution time?",
                "PRICE_BELOW_AT_TIME",
                50e18,
                address(delta),
                address(deltaFeed),
                openTime,
                lockTime,
                resolutionTime,
                gracePeriod
            ),
            ",",
            _market(
                m3,
                "ai-above-001",
                "Will the price of AI be above 0.01 USDG at resolution time?",
                "PRICE_ABOVE_AT_TIME",
                0.01e18,
                address(ai),
                address(aiFeed),
                openTime,
                lockTime,
                resolutionTime,
                gracePeriod
            )
        );
        string memory json = string.concat(
            '{"chainId":',
            vm.toString(block.chainid),
            ',"factory":"',
            vm.toString(address(factory)),
            '","oracleRegistry":"',
            vm.toString(address(registry)),
            '","chainlinkPriceResolver":"',
            vm.toString(address(resolver)),
            '","feeVault":"',
            vm.toString(address(feeVault)),
            '","usdg":"',
            vm.toString(address(usdg)),
            '","mockSwapAdapter":"',
            vm.toString(address(swapAdapter)),
            '","predictionEntryRouter":"',
            vm.toString(address(entryRouter)),
            '","mocks":{',
            mocksJson,
            '},"markets":[',
            marketsJson,
            "]}"
        );
        vm.writeJson(json, "deployments/local.json");

        console2.log("Local vertical slice deployed:");
        console2.log("  factory          ", address(factory));
        console2.log("  oracleRegistry   ", address(registry));
        console2.log("  resolver         ", address(resolver));
        console2.log("  feeVault         ", address(feeVault));
        console2.log("  usdg             ", address(usdg));
        console2.log("  swapAdapter      ", address(swapAdapter));
        console2.log("  entryRouter      ", address(entryRouter));
        console2.log("  markets          ", address(m1), address(m2), address(m3));
        console2.log("Manifest written to deployments/local.json");
    }

    function _createMarket(
        MarketFactory factory,
        MockUSDG usdg,
        ChainlinkPriceResolver resolver,
        address asset,
        IMarket.Comparator comparator,
        int256 strike,
        uint256 openTime,
        uint256 lockTime,
        uint256 resolutionTime,
        uint256 gracePeriod,
        address feeVault,
        string memory question
    ) private returns (address market) {
        BinaryPoolMarket.MarketParams memory params = BinaryPoolMarket.MarketParams({
            collateral: address(usdg),
            resolver: address(resolver),
            oracleAssetKey: _key(asset),
            comparator: comparator,
            strike: strike,
            strikeDecimals: 18,
            openTime: openTime,
            lockTime: lockTime,
            resolutionTime: resolutionTime,
            gracePeriod: gracePeriod,
            feeBps: 0, // default testnet fee = 0
            minEntry: 1e18,
            maxEntry: 0,
            question: question,
            metadataUri: "",
            feeVault: feeVault
        });
        return address(factory.createMarket(params));
    }

    function _key(address token) private pure returns (bytes32) {
        return keccak256(abi.encode(uint256(46630), token));
    }

    function _token(string memory name, address addr, string memory symbol, uint256 decimals)
        private
        pure
        returns (string memory)
    {
        return string.concat(
            '"',
            name,
            '":{"address":"',
            vm.toString(addr),
            '","symbol":"',
            symbol,
            '","name":"Mock ',
            symbol,
            '","decimals":',
            vm.toString(decimals),
            "}"
        );
    }

    function _market(
        address market,
        string memory slug,
        string memory question,
        string memory comparator,
        int256 strike,
        address asset,
        address feed,
        uint256 openTime,
        uint256 lockTime,
        uint256 resolutionTime,
        uint256 gracePeriod
    ) private pure returns (string memory) {
        return string.concat(
            '{"address":"',
            vm.toString(market),
            '","slug":"',
            slug,
            '","question":"',
            question,
            '","template":"',
            comparator,
            '","comparator":"',
            comparator,
            '","strike":"',
            vm.toString(uint256(strike)),
            '","strikeDecimals":18,"asset":"',
            vm.toString(asset),
            '","feed":"',
            vm.toString(feed),
            '","sequencerFeed":null,"heartbeatSeconds":3600,"feeBps":0,"openTime":',
            vm.toString(openTime),
            ',"lockTime":',
            vm.toString(lockTime),
            ',"resolutionTime":',
            vm.toString(resolutionTime),
            ',"gracePeriodSeconds":',
            vm.toString(gracePeriod),
            ',"minEntry":"1000000000000000000","maxEntry":null}'
        );
    }
}
