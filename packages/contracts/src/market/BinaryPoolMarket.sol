// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IMarket} from "../interfaces/IMarket.sol";
import {IOracleResolver} from "../interfaces/IOracleResolver.sol";

/// @notice Binary pooled parimutuel market.
///
/// Users stake normalized collateral (USDG) on YES or NO until `lockTime`.
/// Winners share the full pool pro rata. A protocol fee, when enabled, is
/// charged only on profit (not principal). Cancellation refunds principal.
/// If the winning side ends up with zero stake, the market cancels and
/// everyone is refunded.
///
/// Market terms are immutable after creation. There is no early exit in v0.
///
/// Invariants:
///   - no entry after lock (checked against `lockTime` directly, so a missing
///     `lock()` transaction can never extend entry),
///   - no early resolution,
///   - no outcome change after resolution,
///   - no cancellation after resolution,
///   - no double claim / double refund,
///   - admin has no function to withdraw user principal,
///   - pause blocks new entries but never claims/refunds/resolution,
///   - fee is capped and the contract always remains solvent.
contract BinaryPoolMarket is IMarket, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct MarketParams {
        address collateral;
        address resolver;
        bytes32 oracleAssetKey;
        Comparator comparator;
        int256 strike;
        uint8 strikeDecimals;
        uint256 openTime;
        uint256 lockTime;
        uint256 resolutionTime;
        uint256 gracePeriod;
        uint256 feeBps;
        uint256 minEntry;
        uint256 maxEntry; // 0 = unlimited (per user, per side)
        string question;
        string metadataUri;
        address feeVault;
    }

    uint256 public constant FEE_DENOMINATOR = 10_000;
    uint256 public constant FEE_CAP_BPS = 1_000; // 10% hard cap

    // Immutable market terms — frozen at creation.
    IERC20 public immutable collateral;
    IOracleResolver public immutable resolver;
    bytes32 public immutable oracleAssetKey;
    bytes32 public immutable oracleConfigHash;
    Comparator public immutable comparator;
    int256 public immutable strike;
    uint8 public immutable strikeDecimals;
    uint256 public immutable openTime;
    uint256 public immutable lockTime;
    uint256 public immutable resolutionTime;
    uint256 public immutable gracePeriod; // seconds
    uint256 public immutable feeBps;
    uint256 public immutable minEntry;
    uint256 public immutable maxEntry; // 0 = unlimited (per user, per side)
    // Strings are reference types and cannot be `immutable`; they are assigned
    // once in the constructor and have no setter, so they are still frozen.
    string public question;
    string public metadataUri;
    address public immutable feeVault;

    // Mutable state.
    Status public status;
    Side public winningOutcome;
    int256 public resolvedPrice;
    uint256 public resolvedAt;
    uint256 public yesPool;
    uint256 public noPool;
    mapping(address => uint256) public userYesStake;
    mapping(address => uint256) public userNoStake;
    /// @dev True once the user has claimed (winner) or been refunded (cancel).
    mapping(address => bool) public hasClaimed;

    event PositionEntered(
        address indexed user, Side side, uint256 amount, uint256 yesPool, uint256 noPool
    );
    event MarketLocked();
    event MarketResolved(Side winningOutcome, int256 price);
    event MarketCancelled(string reason);
    event Claimed(address indexed user, uint256 stake, uint256 net, uint256 fee);
    event Refunded(address indexed user, uint256 principal);
    event FeeCollected(address indexed feeVault, uint256 amount);

    error AlreadyResolved();
    error NotOpen();
    error TimestampViolation();

    constructor(MarketParams memory params) Ownable(msg.sender) {
        require(params.collateral != address(0), "collateral is zero");
        require(params.resolver != address(0), "resolver is zero");
        require(params.feeVault != address(0), "fee vault is zero");
        require(params.openTime < params.lockTime, "open must be before lock");
        require(params.lockTime <= params.resolutionTime, "lock must precede resolution");
        require(
            params.resolutionTime <= type(uint256).max - params.gracePeriod,
            "resolution deadline overflow"
        );
        require(params.minEntry > 0, "min entry is zero");
        require(params.strike > 0, "strike must be positive");
        require(params.strikeDecimals <= 36, "strike decimals too large");
        require(params.feeBps <= FEE_CAP_BPS, "fee exceeds cap");
        require(bytes(params.question).length > 0, "empty question");

        collateral = IERC20(params.collateral);
        resolver = IOracleResolver(params.resolver);
        oracleAssetKey = params.oracleAssetKey;
        oracleConfigHash = _readConfigHash(params.resolver, params.oracleAssetKey);
        comparator = params.comparator;
        strike = params.strike;
        strikeDecimals = params.strikeDecimals;
        openTime = params.openTime;
        lockTime = params.lockTime;
        resolutionTime = params.resolutionTime;
        gracePeriod = params.gracePeriod;
        feeBps = params.feeBps;
        minEntry = params.minEntry;
        maxEntry = params.maxEntry;
        question = params.question;
        metadataUri = params.metadataUri;
        feeVault = params.feeVault;

        status = Status.OPEN;
    }

    // ------------------------------------------------------------------
    // Entry
    // ------------------------------------------------------------------

    /// @notice Enter the market on YES or NO with `amount` collateral.
    ///
    /// Entry is blocked by `lockTime` itself (even if `lock()` was never
    /// called) and by the pause — pause never blocks claims/refunds.
    function enter(Side side, uint256 amount) external nonReentrant whenNotPaused {
        _enter(msg.sender, msg.sender, side, amount);
    }

    /// @notice Enter for `beneficiary`, taking collateral from the caller.
    function enterFor(address beneficiary, Side side, uint256 amount)
        external
        nonReentrant
        whenNotPaused
    {
        if (beneficiary == address(0)) revert InvalidBeneficiary();
        _enter(msg.sender, beneficiary, side, amount);
    }

    function _enter(address payer, address beneficiary, Side side, uint256 amount) private {
        if (side != Side.YES && side != Side.NO) revert InvalidSide();
        if (block.timestamp < openTime || block.timestamp >= lockTime) revert TimestampViolation();
        if (status != Status.OPEN) revert NotOpen();
        if (amount < minEntry) revert BelowMinEntry();
        if (maxEntry != 0) {
            uint256 existing =
                side == Side.YES ? userYesStake[beneficiary] : userNoStake[beneficiary];
            if (existing + amount > maxEntry) revert AboveMaxEntry();
        }

        uint256 balanceBefore = collateral.balanceOf(address(this));
        collateral.safeTransferFrom(payer, address(this), amount);
        if (collateral.balanceOf(address(this)) - balanceBefore != amount) {
            revert UnsupportedCollateralTransfer();
        }

        if (side == Side.YES) {
            yesPool += amount;
            userYesStake[beneficiary] += amount;
        } else {
            noPool += amount;
            userNoStake[beneficiary] += amount;
        }
        emit PositionEntered(beneficiary, side, amount, yesPool, noPool);
    }

    // ------------------------------------------------------------------
    // Lock / resolve / cancel
    // ------------------------------------------------------------------

    /// @notice Move the market from OPEN to LOCKED at/after `lockTime`.
    function lock() external {
        if (block.timestamp < lockTime) revert TooEarly();
        if (status != Status.OPEN) revert NotOpen();
        status = Status.LOCKED;
        emit MarketLocked();
    }

    /// @notice Resolve from the deterministic oracle. Permissionless: anyone
    ///         may call it at/after `resolutionTime`; the resolver verifies
    ///         the outcome deterministically (no admin-typed winners).
    function resolve() external nonReentrant {
        _resolve(bytes(""));
    }

    /// @notice Resolve using oracle-specific proof data. Data Streams markets
    ///         pass the signed report payload here; push-feed markets use the
    ///         no-argument overload.
    function resolve(bytes calldata oracleProof) external nonReentrant {
        _resolve(oracleProof);
    }

    function _resolve(bytes memory oracleProof) private {
        if (block.timestamp < resolutionTime) revert TooEarly();
        if (status != Status.LOCKED) revert NotLocked();
        if (
            oracleConfigHash != bytes32(0)
                && _readConfigHash(address(resolver), oracleAssetKey) != oracleConfigHash
        ) {
            revert OracleConfigChanged();
        }

        (int256 price, uint8 feedDecimals) =
            resolver.resolve(oracleAssetKey, resolutionTime, oracleProof);
        Side outcome = _evaluate(price, feedDecimals);
        resolvedPrice = price;

        // No winner (strict equality) or empty winning side → cancel/refund.
        if (outcome == Side.NONE || (outcome == Side.YES ? yesPool : noPool) == 0) {
            status = Status.CANCELLED;
            emit MarketCancelled("no winning side stake");
            return;
        }

        winningOutcome = outcome;
        status = Status.RESOLVED;
        resolvedAt = block.timestamp;
        emit MarketResolved(outcome, price);
    }

    /// @notice Admin-only cancellation before resolution (oracle failure etc.).
    function cancel() external onlyOwner {
        if (status == Status.RESOLVED) revert AlreadyResolved();
        if (status == Status.CANCELLED) revert AlreadyCancelled();
        status = Status.CANCELLED;
        emit MarketCancelled("admin cancel");
    }

    /// @notice Cancel a locked market after its oracle timeout when the
    ///         snapshotted oracle is unhealthy. Anyone may call this so user
    ///         refunds do not depend on an admin transaction.
    function cancelAfterOracleTimeout() external {
        if (status != Status.LOCKED) revert NotLocked();
        if (block.timestamp < resolutionTime + gracePeriod) revert TooEarly();

        bool healthy;
        if (
            oracleConfigHash == bytes32(0)
                || _readConfigHash(address(resolver), oracleAssetKey) != oracleConfigHash
        ) {
            healthy = false;
        } else {
            try resolver.health(oracleAssetKey) returns (IOracleResolver.Health memory h) {
                healthy = h.healthy;
            } catch {
                healthy = false;
            }
            if (healthy) {
                (bool ok, bytes memory result) = address(resolver)
                    .staticcall(
                        abi.encodeWithSignature(
                            "resolutionAvailable(bytes32,uint256)", oracleAssetKey, resolutionTime
                        )
                    );
                if (ok && result.length == 32) healthy = abi.decode(result, (bool));
            }
        }
        if (healthy) revert OracleHealthy();

        status = Status.CANCELLED;
        emit MarketCancelled("oracle timeout");
    }

    // ------------------------------------------------------------------
    // Claim / refund
    // ------------------------------------------------------------------

    /// @notice Winners claim their pro-rata share of the full pool, minus a
    ///         fee charged only on profit. Floor rounding preserves solvency.
    function claim() external nonReentrant {
        if (status != Status.RESOLVED) revert NotResolved();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();

        uint256 stake =
            winningOutcome == Side.YES ? userYesStake[msg.sender] : userNoStake[msg.sender];
        if (stake == 0) revert NothingToClaim();

        uint256 winningPool = winningOutcome == Side.YES ? yesPool : noPool;
        uint256 losingPool = winningOutcome == Side.YES ? noPool : yesPool;
        (uint256 net, uint256 fee) = _payout(stake, winningPool, losingPool);

        hasClaimed[msg.sender] = true;
        if (fee > 0) {
            collateral.safeTransfer(feeVault, fee);
            emit FeeCollected(feeVault, fee);
        }
        collateral.safeTransfer(msg.sender, net);
        emit Claimed(msg.sender, stake, net, fee);
    }

    /// @notice Refund principal when the market is cancelled.
    function refund() external nonReentrant {
        if (status != Status.CANCELLED) revert NotCancelled();
        if (hasClaimed[msg.sender]) revert AlreadyClaimed();

        uint256 principal = userYesStake[msg.sender] + userNoStake[msg.sender];
        if (principal == 0) revert NothingToClaim();

        hasClaimed[msg.sender] = true;
        collateral.safeTransfer(msg.sender, principal);
        emit Refunded(msg.sender, principal);
    }

    // ------------------------------------------------------------------
    // Pause (admin)
    // ------------------------------------------------------------------

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    // ------------------------------------------------------------------
    // Views
    // ------------------------------------------------------------------

    /// @notice Gross/profit/fee/net payout for a stake given the pools.
    ///         Mirrors the onchain math for UI previews:
    ///         gross = stake * (winningPool + losingPool) / winningPool,
    ///         fee = (gross - stake) * feeBps / 10000.
    function previewPayout(uint256 stake, uint256 winningPool_, uint256 losingPool_)
        public
        view
        returns (uint256 gross, uint256 profit, uint256 fee, uint256 net)
    {
        uint256 total = winningPool_ + losingPool_;
        gross = Math.mulDiv(stake, total, winningPool_);
        profit = gross - stake;
        fee = (profit * feeBps) / FEE_DENOMINATOR;
        net = gross - fee;
    }

    function userStake(address user, Side side) external view returns (uint256) {
        return side == Side.YES ? userYesStake[user] : userNoStake[user];
    }

    // ------------------------------------------------------------------
    // Internals
    // ------------------------------------------------------------------

    /// @dev Compares the oracle price (feed decimals) against the strike
    ///      (strikeDecimals) on a common scale. Strict comparison; equality
    ///      yields no winner → cancel/refund. Both price and strike are
    ///      positive (enforced by the resolver and constructor).
    function _evaluate(int256 price, uint8 feedDecimals) internal view returns (Side) {
        if (feedDecimals > 36) revert InvalidOracleDecimals();
        int8 comparison =
            _compareDecimalValues(uint256(price), feedDecimals, uint256(strike), strikeDecimals);

        if (comparator == Comparator.PRICE_ABOVE_AT_TIME) {
            if (comparison > 0) return Side.YES;
            if (comparison < 0) return Side.NO;
        } else {
            if (comparison < 0) return Side.YES;
            if (comparison > 0) return Side.NO;
        }
        return Side.NONE; // strict equality → no winner → cancel/refund
    }

    function _compareDecimalValues(
        uint256 left,
        uint8 leftDecimals,
        uint256 right,
        uint8 rightDecimals
    ) private pure returns (int8) {
        if (leftDecimals < rightDecimals) {
            uint256 factor = 10 ** (rightDecimals - leftDecimals);
            if (left > type(uint256).max / factor) return 1;
            left *= factor;
        } else if (rightDecimals < leftDecimals) {
            uint256 factor = 10 ** (leftDecimals - rightDecimals);
            if (right > type(uint256).max / factor) return -1;
            right *= factor;
        }
        if (left > right) return 1;
        if (left < right) return -1;
        return 0;
    }

    function _payout(uint256 stake, uint256 winningPool_, uint256 losingPool_)
        internal
        view
        returns (uint256 net, uint256 fee)
    {
        (,, fee, net) = previewPayout(stake, winningPool_, losingPool_);
    }

    function _readConfigHash(address resolver_, bytes32 assetKey)
        internal
        view
        returns (bytes32 hash)
    {
        (bool ok, bytes memory data) =
            resolver_.staticcall(abi.encodeCall(IOracleResolver.configHash, (assetKey)));
        if (ok && data.length == 32) hash = abi.decode(data, (bytes32));
    }

    // ------------------------------------------------------------------
    // Errors
    // ------------------------------------------------------------------

    error InvalidSide();
    error BelowMinEntry();
    error AboveMaxEntry();
    error TooEarly();
    error NotLocked();
    error NotResolved();
    error NotCancelled();
    error AlreadyCancelled();
    error AlreadyClaimed();
    error NothingToClaim();
    error OracleConfigChanged();
    error OracleHealthy();
    error InvalidBeneficiary();
    error InvalidOracleDecimals();
    error UnsupportedCollateralTransfer();
}
