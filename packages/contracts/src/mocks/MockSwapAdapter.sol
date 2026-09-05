// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice LOCAL/TESTNET ONLY — deterministic swap venue for the funding layer.
///
/// Swaps any allowlisted ERC-20 into the configured USDG collateral at a fixed
/// owner-set rate: `amountOut = amountIn * rate[tokenIn] / 1e18`, where rate is
/// expressed in USDG wei per 1 wei of tokenIn (both 18 decimals locally). The
/// adapter is pre-funded with USDG at deploy; it holds incoming tokens and the
/// owner may sweep them. This exists so the swap -> enter flow can be tested
/// end to end without pretending testnet has mainnet liquidity — it must never
/// be deployed to mainnet, where the Uniswap Universal Router is the only
/// allowlisted swap target.
contract MockSwapAdapter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    error UnknownToken(address token);
    error InsufficientOutput(uint256 amountOut, uint256 minAmountOut);
    error InsufficientUsdgLiquidity(uint256 amountOut, uint256 available);
    error ZeroAmount();

    event RateSet(address indexed token, uint256 rate);
    event Swap(
        address indexed trader,
        address indexed tokenIn,
        address indexed usdg,
        uint256 amountIn,
        uint256 amountOut,
        address recipient
    );
    event Swept(address indexed token, address indexed to, uint256 amount);

    IERC20 public immutable usdg;

    /// @notice USDG wei out per 1 wei of tokenIn (18-decimal fixed point).
    mapping(address token => uint256 rate) public rates;

    constructor(IERC20 usdg_) Ownable(msg.sender) {
        usdg = usdg_;
    }

    function setRate(address token, uint256 rate) external onlyOwner {
        rates[token] = rate;
        emit RateSet(token, rate);
    }

    /// @notice Deterministic off-chain mirror of `swap` for quoting.
    function quote(address tokenIn, uint256 amountIn) public view returns (uint256 amountOut) {
        uint256 rate = rates[tokenIn];
        if (rate == 0) revert UnknownToken(tokenIn);
        return amountIn * rate / 1e18;
    }

    function swap(address tokenIn, uint256 amountIn, uint256 minAmountOut, address recipient)
        external
        nonReentrant
        returns (uint256 amountOut)
    {
        if (amountIn == 0) revert ZeroAmount();
        amountOut = quote(tokenIn, amountIn);
        if (amountOut < minAmountOut) revert InsufficientOutput(amountOut, minAmountOut);
        uint256 available = usdg.balanceOf(address(this));
        if (amountOut > available) revert InsufficientUsdgLiquidity(amountOut, available);

        IERC20(tokenIn).safeTransferFrom(msg.sender, address(this), amountIn);
        usdg.safeTransfer(recipient, amountOut);

        emit Swap(msg.sender, tokenIn, address(usdg), amountIn, amountOut, recipient);
    }

    /// @notice Test owner can sweep any mock liquidity. Quotes reserve no funds;
    /// a sweep may invalidate them. Never use this venue for real funds.
    function sweep(address token, address to, uint256 amount) external onlyOwner {
        IERC20(token).safeTransfer(to, amount);
        emit Swept(token, to, amount);
    }
}
