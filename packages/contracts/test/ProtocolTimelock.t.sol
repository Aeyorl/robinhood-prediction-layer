// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ProtocolTimelock} from "../src/governance/ProtocolTimelock.sol";

contract ProtocolTimelockTest is Test {
    function test_safeIsSoleProposerExecutorAndDelayIsFixed() public {
        address safe = makeAddr("safe");
        ProtocolTimelock timelock = new ProtocolTimelock(safe);
        assertEq(timelock.getMinDelay(), 2 days);
        assertTrue(timelock.hasRole(timelock.PROPOSER_ROLE(), safe));
        assertTrue(timelock.hasRole(timelock.EXECUTOR_ROLE(), safe));
        assertFalse(timelock.hasRole(timelock.DEFAULT_ADMIN_ROLE(), address(this)));
    }
}
