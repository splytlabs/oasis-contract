// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMarket {
  struct Lending {
    address lender;
    address nftAddress;
    uint256 nftId;
    uint256 createTime;
    uint64 minDuration;
    uint64 maxDuration;
    uint8 shareRatio;
    address paymentToken;
    address lendContract;
  }

  struct Renting {
    address renter;
    address lender;
    address nftAddress;
    uint256 nftId;
    uint256 startTime;
    uint256 endTime;
    uint8 shareRatio;
    address paymentToken;
  }

  event CreateLendOrder(
    address lender,
    address nftAddress,
    uint256 nftId,
    uint64 minDuration,
    uint64 maxDuration,
    uint256 shareRatio,
    address paymentToken
  );

  event CancelLendOrder(address lender, address nftAddress, uint256 nftId);

  event FulfillOrder(
    address renter,
    address lender,
    address nftAddress,
    uint256 nftId,
    uint256 startTime,
    uint256 endTime,
    uint8 shareRatio,
    address paymentToken
  );

  function createLendOrder(
    address nftAddress,
    uint256 nftId,
    uint64 lendValidUntil,
    uint64 maxDuration,
    uint64 minDuration,
    uint8 shareRatio,
    address paymentToken
  ) external;

  function cancelLendOrder(address nftAddress, uint256 nftId) external;

  function getLendOrder(address nftAddress, uint256 nftId) external view returns (Lending memory);

  function fulfillOrder(
    address nftAddress,
    uint256 nftId,
    uint64 duration,
    address user
  ) external;
}
