// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface IMarket {
  struct Lending {
    uint256 id;
    address lender;
    address nftAddress;
    uint256 nftId;
    uint256 createTime;
    uint64 minDuration;
    uint64 maxDuration;
    uint64 pricePerDay;
    address paymentToken;
    address lendContract;
  }

  struct Renting {
    uint256 id;
    address renter;
    address lender;
    address nftAddress;
    uint256 nftId;
    uint256 startTime;
    uint256 endTime;
    uint64 pricePerDay;
    address paymentToken;
  }

  event CreateLendOrder(
    uint256 lendId,
    address lender,
    address nftAddress,
    uint256 nftId,
    uint64 minDuration,
    uint64 maxDuration,
    uint64 pricePerDay,
    address paymentToken
  );

  event CancelLendOrder(uint256 lendId, address lender, address nftAddress, uint256 nftId);

  event FulfillOrder(
    uint256 rentId,
    uint256 lendId,
    address renter,
    address lender,
    address nftAddress,
    uint256 nftId,
    uint256 startTime,
    uint256 endTime,
    uint64 pricePerDay,
    address paymentToken
  );

  function createLendOrder(
    address nftAddress,
    uint256 nftId,
    uint64 lendValidUntil,
    uint64 maxDuration,
    uint64 minDuration,
    uint64 pricePerDay,
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
