// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @notice Chainlink Data Streams verifier proxy entry point.
interface IVerifierProxy {
    function verify(bytes calldata payload, bytes calldata parameterPayload)
        external
        payable
        returns (bytes memory verifierResponse);
}
