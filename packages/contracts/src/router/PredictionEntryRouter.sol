// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IMarket} from "../interfaces/IMarket.sol";
import {MarketFactory} from "../market/MarketFactory.sol";

/// @notice Atomically swaps an exact source-token amount into canonical USDG
/// and enters a factory-created market for the caller.
contract PredictionEntryRouter is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public immutable usdg;
    MarketFactory public immutable factory;
    mapping(address => bool) public allowedSwapTargets;

    event SwapTargetSet(address indexed target, bool allowed);
    event FundingRouted(
        address indexed user,
        address indexed market,
        address indexed fundingToken,
        uint256 fundingAmount,
        uint256 usdgAmount,
        IMarket.Side side
    );

    error InvalidAddress();
    error InvalidAmount();
    error Expired();
    error UnknownMarket();
    error WrongCollateral();
    error SwapTargetNotAllowed();
    error SwapFailed(bytes reason);
    error InsufficientOutput(uint256 received, uint256 minimum);

    constructor(address initialOwner, IERC20 usdg_, MarketFactory factory_) Ownable(initialOwner) {
        if (address(usdg_) == address(0) || address(factory_) == address(0)) {
            revert InvalidAddress();
        }
        usdg = usdg_;
        factory = factory_;
    }

    function setSwapTarget(address target, bool allowed) external onlyOwner {
        if (target == address(0)) revert InvalidAddress();
        allowedSwapTargets[target] = allowed;
        emit SwapTargetSet(target, allowed);
    }

    function enterWithToken(
        address market,
        IMarket.Side side,
        IERC20 fundingToken,
        uint256 fundingAmount,
        uint256 minimumUsdg,
        address swapTarget,
        bytes calldata swapData,
        uint256 deadline
    ) external nonReentrant returns (uint256 usdgAmount) {
        if (block.timestamp > deadline) revert Expired();
        if (fundingAmount == 0 || minimumUsdg == 0) revert InvalidAmount();
        if (address(fundingToken) == address(0) || address(fundingToken) == address(usdg)) {
            revert InvalidAddress();
        }
        if (factory.marketIndex(market) == 0) revert UnknownMarket();
        if (address(IMarket(market).collateral()) != address(usdg)) revert WrongCollateral();
        if (!allowedSwapTargets[swapTarget]) revert SwapTargetNotAllowed();

        uint256 sourceBefore = fundingToken.balanceOf(address(this));
        uint256 usdgBefore = usdg.balanceOf(address(this));
        fundingToken.safeTransferFrom(msg.sender, address(this), fundingAmount);
        uint256 receivedSource = fundingToken.balanceOf(address(this)) - sourceBefore;
        fundingToken.forceApprove(swapTarget, receivedSource);
        (bool success, bytes memory reason) = swapTarget.call(swapData);
        fundingToken.forceApprove(swapTarget, 0);
        if (!success) revert SwapFailed(reason);

        usdgAmount = usdg.balanceOf(address(this)) - usdgBefore;
        if (usdgAmount < minimumUsdg) revert InsufficientOutput(usdgAmount, minimumUsdg);
        uint256 sourceRemainder = fundingToken.balanceOf(address(this)) - sourceBefore;
        if (sourceRemainder > 0) fundingToken.safeTransfer(msg.sender, sourceRemainder);

        usdg.forceApprove(market, usdgAmount);
        IMarket(market).enterFor(msg.sender, side, usdgAmount);
        usdg.forceApprove(market, 0);
        emit FundingRouted(
            msg.sender, market, address(fundingToken), receivedSource, usdgAmount, side
        );
    }
}
