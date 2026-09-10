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

    function test_twoDayScheduleAndExecutionRehearsal() public {
        address safe = makeAddr("mag7Safe");
        ProtocolTimelock timelock = new ProtocolTimelock(safe);
        TimelockRehearsalTarget target = new TimelockRehearsalTarget();
        bytes memory data = abi.encodeCall(target.markRehearsed, ());
        bytes32 predecessor = bytes32(0);
        bytes32 salt = keccak256("POKU_TIMELOCK_REHEARSAL_V1");

        vm.prank(safe);
        timelock.schedule(address(target), 0, data, predecessor, salt, 2 days);

        vm.prank(safe);
        vm.expectRevert();
        timelock.execute(address(target), 0, data, predecessor, salt);

        vm.warp(block.timestamp + 2 days);
        vm.prank(safe);
        timelock.execute(address(target), 0, data, predecessor, salt);

        assertTrue(target.rehearsed());
        assertTrue(
            timelock.isOperationDone(
                timelock.hashOperation(address(target), 0, data, predecessor, salt)
            )
        );
    }
}

contract TimelockRehearsalTarget {
    bool public rehearsed;

    function markRehearsed() external {
        rehearsed = true;
    }
}
