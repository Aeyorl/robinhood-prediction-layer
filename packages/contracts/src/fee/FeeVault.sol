// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/// @notice Protocol fee sink.
///
/// Markets transfer fees here directly. The owner may withdraw any ERC-20
/// balance, but only to the immutable `recipient` — there is no arbitrary
/// withdrawal, and user principal never resides in this contract.
contract FeeVault is Ownable {
    using SafeERC20 for IERC20;

    address public immutable recipient;

    event FeeReceived(address indexed token, uint256 amount);
    event Withdrawn(address indexed token, uint256 amount, address recipient);

    constructor(address initialOwner, address recipient_) Ownable(initialOwner) {
        require(recipient_ != address(0), "recipient is zero");
        recipient = recipient_;
    }

    /// @notice Any market (or donor) may deposit fees.
    function notifyFee(address token, uint256 amount) external {
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        emit FeeReceived(token, amount);
    }

    /// @notice Withdraw the entire balance of `token` to the fixed recipient.
    function withdraw(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        require(balance > 0, "nothing to withdraw");
        IERC20(token).safeTransfer(recipient, balance);
        emit Withdrawn(token, balance, recipient);
    }
}
