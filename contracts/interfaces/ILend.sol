// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

interface ILend {
  struct NftInfo {
    address addr;
    uint256 tokenId;
  }

  struct UserInfo {
    uint256 start;
    uint256 end;
    address user;
  }

  event UserInfoUpdate(uint256 rentId, uint256 start, uint256 end, address user);
  event ShareRatioUpdate(uint8 ratio);
  event MaxRentDurationUpdate(uint64 duration);

  event Stake(address msgSender, address nftAddress, uint256 tokenId);
  event Redeem(address msgSender, address nftAddress, uint256 tokenId);

  function rent(uint64 duration, address user) external;

  function couldRent() external view returns (bool);

  function stake(address nftAddress, uint256 tokenId) external;

  function redeem() external;

  function couldRedeem() external view returns (bool);

  function getUser() external view returns (address);

  function getNftInfo() external view returns (NftInfo memory info);

  function setShareRatio(uint8 shareRatio) external;

  function setMaxRentDuration(uint64 timeStamp) external;

  function getUserInfo() external view returns (UserInfo memory user);

  function getRentInfo()
    external
    view
    returns (
      UserInfo memory user,
      address paymentToken,
      uint8 shareRatio
    );

  function isValid() external view returns (bool);
}
