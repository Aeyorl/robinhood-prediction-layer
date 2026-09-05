// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {TimelockController} from "@openzeppelin/contracts/governance/TimelockController.sol";

/// @notice Production ownership boundary. The Safe proposes and executes;
/// every privileged action remains visible for at least two days.
contract ProtocolTimelock is TimelockController {
    uint256 public constant MIN_DELAY = 2 days;

    constructor(address safe)
        TimelockController(MIN_DELAY, _singleton(safe), _singleton(safe), address(0))
    {
        require(safe != address(0), "safe is zero");
    }

    function _singleton(address account) private pure returns (address[] memory accounts) {
        accounts = new address[](1);
        accounts[0] = account;
    }
}
