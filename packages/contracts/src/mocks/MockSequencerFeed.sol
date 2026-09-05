// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AggregatorV3Interface} from "../interfaces/AggregatorV3Interface.sol";

/// @notice Local/test Chainlink-compatible L2 sequencer uptime feed.
///         answer == 0 means up; answer == 1 means down. Never deploy on mainnet.
contract MockSequencerFeed is AggregatorV3Interface {
    bool private _isUp;
    uint256 private _lastStatusChangeAt;

    constructor() {
        _isUp = true;
        _lastStatusChangeAt = block.timestamp;
    }

    function setUp() external {
        _isUp = true;
        _lastStatusChangeAt = block.timestamp;
    }

    function setDown() external {
        _isUp = false;
        _lastStatusChangeAt = block.timestamp;
    }

    function decimals() external pure returns (uint8) {
        return 0;
    }

    function description() external pure returns (string memory) {
        return "MockSequencerFeed";
    }

    function version() external pure returns (uint256) {
        return 1;
    }

    function latestRoundData()
        external
        view
        returns (
            uint80 roundId,
            int256 answer,
            uint256 startedAt,
            uint256 updatedAt,
            uint80 answeredInRound
        )
    {
        return (
            uint80(1),
            _isUp ? int256(0) : int256(1),
            _lastStatusChangeAt,
            _lastStatusChangeAt,
            uint80(1)
        );
    }
}
