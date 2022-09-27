// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './interfaces/IMarket.sol';
import './Lend.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';

contract Market is IMarket, IERC721Receiver {
  mapping(address => mapping(uint256 => address)) private lenderMapping;
  mapping(address => mapping(uint256 => Lending)) private lendingMapping;
  mapping(address => mapping(uint256 => Renting)) private RentingMapping;

  // TODO: minDuration, MaxDuration, shareRation, LendValidUntil 범위 예외 처리
  function createLendOrder(
    address nftAddress,
    uint256 nftId,
    uint64 lendValidUntil,
    uint64 minDuration,
    uint64 maxDuration,
    uint8 shareRatio,
    address paymentToken
  ) external {
    require(lenderMapping[nftAddress][nftId] == address(0), 'already lend');
    require(onlyApprovedOrOwner(address(this), nftAddress, nftId), 'only approved or owner');

    address lastOwner = IERC721(nftAddress).ownerOf(nftId);
    IERC721(nftAddress).safeTransferFrom(lastOwner, address(this), nftId);

    Lend lend = new Lend(shareRatio, paymentToken, lendValidUntil, maxDuration);
    IERC721(nftAddress).approve(address(lend), nftId);
    lend.stake(nftAddress, nftId);

    Lending storage lending_ = lendingMapping[nftAddress][nftId];

    lending_.lender = msg.sender;
    lending_.nftAddress = nftAddress;
    lending_.nftId = nftId;
    lending_.createTime = block.timestamp;
    lending_.minDuration = minDuration;
    lending_.maxDuration = maxDuration;
    lending_.shareRatio = shareRatio;
    lending_.paymentToken = paymentToken;
    lending_.lendContract = address(lend);

    lenderMapping[nftAddress][nftId] = address(lend);
    emit CreateLendOrder(msg.sender, nftAddress, nftId, minDuration, maxDuration, shareRatio, paymentToken);
  }

  function cancelLendOrder(address nftAddress, uint256 nftId) external {
    // 랜딩 여부, 본인 여부 확인
    Lending storage lending_ = lendingMapping[nftAddress][nftId];
    require(lending_.lender == msg.sender, 'not lender');

    // redeem 호출로 돌려주기
    Lend(lending_.lendContract).redeem();

    // event 발생
    emit CancelLendOrder(lending_.lender, nftAddress, nftId);

    // 상태 초기화
    lending_.lender = address(0);
    lending_.nftAddress = address(0);
    lending_.nftId = 0;
    lending_.createTime = 0;
    lending_.minDuration = 0;
    lending_.maxDuration = 0;
    lending_.shareRatio = 0;
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
  ) external {
    Lending storage lending_ = lendingMapping[nftAddress][nftId];
    require(lending_.lender != address(0), 'not yet lend');

    Lend(lending_.lendContract).rent(duration, user);
    Renting storage renting_ = RentingMapping[nftAddress][nftId];

    renting_.renter = msg.sender;
    renting_.lender = lending_.lender;
    renting_.nftAddress = nftAddress;
    renting_.nftId = nftId;
    renting_.startTime = block.timestamp;
    renting_.endTime = block.timestamp + duration;
    renting_.shareRatio = lending_.shareRatio;
    renting_.paymentToken = lending_.paymentToken;

    emit FulfillOrder(
      msg.sender,
      lending_.lender,
      nftAddress,
      nftId,
      block.timestamp,
      duration + block.timestamp,
      lending_.shareRatio,
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
