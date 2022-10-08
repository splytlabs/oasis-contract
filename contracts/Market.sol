// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './interfaces/IMarket.sol';
import './Lend.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import '@openzeppelin/contracts/utils/Counters.sol';

contract Market is IMarket, IERC721Receiver {
  using Counters for Counters.Counter;

  Counters.Counter private _lendIdCounter;
  Counters.Counter private _rentIdCounter;

  mapping(address => mapping(uint256 => address)) private lenderMapping;
  mapping(address => mapping(uint256 => Lending)) private lendingMapping;
  mapping(address => mapping(uint256 => Renting)) private RentingMapping;

  uint256 private _unitOfPrice = 1e18;
  uint32 private _unixTimeForADay = 86400;

  function createLendOrder(
    address nftAddress,
    uint256 nftId,
    uint64 lendValidUntil,
    uint64 minDuration,
    uint64 maxDuration,
    uint64 pricePerDay,
    address paymentToken
  ) external {
    require(lenderMapping[nftAddress][nftId] == address(0), 'already lend');
    require(onlyApprovedOrOwner(address(this), nftAddress, nftId), 'only approved or owner');
    require(minDuration < maxDuration, 'maxDuration must be longer than minDuration');
    require(
      block.timestamp + maxDuration < lendValidUntil,
      'lendValidUntil must be longer than block.timestamp + maxDuration'
    );

    address lastOwner = IERC721(nftAddress).ownerOf(nftId);
    IERC721(nftAddress).safeTransferFrom(lastOwner, address(this), nftId);

    Lend lend = new Lend(pricePerDay, paymentToken, lendValidUntil, maxDuration);
    IERC721(nftAddress).approve(address(lend), nftId);
    lend.stake(nftAddress, nftId);

    Lending storage lending_ = lendingMapping[nftAddress][nftId];

    lending_.id = _lendIdCounter.current();
    lending_.lender = msg.sender;
    lending_.nftAddress = nftAddress;
    lending_.nftId = nftId;
    lending_.createTime = block.timestamp;
    lending_.minDuration = minDuration;
    lending_.maxDuration = maxDuration;
    lending_.pricePerDay = pricePerDay;
    lending_.paymentToken = paymentToken;
    lending_.lendContract = address(lend);

    _lendIdCounter.increment();

    lenderMapping[nftAddress][nftId] = address(lend);
    emit CreateLendOrder(
      lending_.id,
      msg.sender,
      nftAddress,
      nftId,
      minDuration,
      maxDuration,
      pricePerDay,
      paymentToken
    );
  }

  function cancelLendOrder(address nftAddress, uint256 nftId) external {
    Lending storage lending_ = lendingMapping[nftAddress][nftId];
    require(lending_.lender == msg.sender, 'not lender');

    Lend(lending_.lendContract).redeem();

    emit CancelLendOrder(lending_.id, lending_.lender, nftAddress, nftId);

    lending_.lender = address(0);
    lending_.nftAddress = address(0);
    lending_.nftId = 0;
    lending_.createTime = 0;
    lending_.minDuration = 0;
    lending_.maxDuration = 0;
    lending_.pricePerDay = 0;
    lending_.paymentToken = address(0);
    lending_.lendContract = address(0);
  }

  function getLendOrder(address nftAddress, uint256 nftId) external view returns (Lending memory) {
    return lendingMapping[nftAddress][nftId];
  }

  function fulfillOrder(
    address nftAddress,
    uint256 nftId,
    uint64 duration,
    address user
  ) external payable {
    Lending storage lending_ = lendingMapping[nftAddress][nftId];
    require(lending_.lender != address(0), 'not yet lend');

    // msg.value가 pricePerDay * (duration / 86400)와 같지 않으면 에러 출력
    require(msg.value == lending_.pricePerDay * (duration / _unixTimeForADay) * _unitOfPrice, 'not match the value');

    Lend(lending_.lendContract).rent(duration, user);

    // lender에게 msg.value 전달
    payable(lending_.lender).transfer(msg.value);

    Renting storage renting_ = RentingMapping[nftAddress][nftId];

    renting_.id = _rentIdCounter.current();
    renting_.renter = msg.sender;
    renting_.lender = lending_.lender;
    renting_.nftAddress = nftAddress;
    renting_.nftId = nftId;
    renting_.startTime = block.timestamp;
    renting_.endTime = block.timestamp + duration;
    renting_.pricePerDay = lending_.pricePerDay;
    renting_.paymentToken = lending_.paymentToken;

    _rentIdCounter.increment();

    emit FulfillOrder(
      renting_.id,
      lending_.id,
      msg.sender,
      lending_.lender,
      nftAddress,
      nftId,
      block.timestamp,
      duration + block.timestamp,
      lending_.pricePerDay,
      lending_.paymentToken
    );
  }

  function onlyApprovedOrOwner(
    address spender,
    address nftAddress,
    uint256 tokenId
  ) internal view returns (bool) {
    address _owner = IERC721(nftAddress).ownerOf(tokenId);
    return (spender == _owner ||
      IERC721(nftAddress).getApproved(tokenId) == spender ||
      IERC721(nftAddress).isApprovedForAll(_owner, spender));
  }

  function onERC721Received(
    address operator,
    address from,
    uint256 tokenId,
    bytes calldata data
  ) external pure override returns (bytes4) {
    return bytes4(keccak256('onERC721Received(address,address,uint256,bytes)'));
  }
}
