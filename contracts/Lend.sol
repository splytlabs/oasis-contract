// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import './interfaces/ILend.sol';
import './utils/Ownable.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol';
import '@openzeppelin/contracts/token/ERC721/IERC721.sol';

contract Lend is ILend, Ownable, IERC721Receiver {
  address private _owner;
  address private _nftOwner;

  uint64 nonce;

  uint64 private _lendValidUntil;
  uint256 private _createdAt;
  uint64 public maxRentDuration;

  uint64 public pricePerDay;
  address public paymentToken;

  UserInfo private _userInfo; 
  NftInfo private _nftInfo;

  constructor(
    uint64 pricePerDay_,
    address paymentToken_,
    uint64 lendValidUntil_, 
    uint64 maxRentDuration_
  ) {
    pricePerDay = pricePerDay_;
    paymentToken = paymentToken_;

    _lendValidUntil = lendValidUntil_;
    maxRentDuration = maxRentDuration_;

    _createdAt = block.timestamp;
  }

  function stake(address nftAddress, uint256 tokenId) external override onlyOwner {
    require(_isStaking() == false, 'already staking');

    _nftOwner = IERC721(nftAddress).ownerOf(tokenId);
    IERC721(nftAddress).safeTransferFrom(_nftOwner, address(this), tokenId);

    _nftInfo.addr = nftAddress;
    _nftInfo.tokenId = tokenId; 

    emit Stake(msg.sender, nftAddress, tokenId);
  }

  function rent(uint64 duration, address user) external onlyOwner {
    require(couldRent() == true, 'cannot rent');
    require(duration <= maxRentDuration, 'over maxRentDuration');

    _userInfo.user = user;
    _userInfo.start = block.timestamp;
    _userInfo.end = duration + block.timestamp;

    emit UserInfoUpdate(_nftInfo.tokenId, _userInfo.start, _userInfo.end, user);
  }

  function couldRent() public view returns (bool) {
    require(_isStaking() == true, 'not yet staking');
    require(isValid() == true, 'expired lend');

    return _rentExpired();
  }

  function _rentExpired() private view returns (bool) {
    return _userInfo.end < block.timestamp;
  }

  function redeem() external override onlyOwner {
    require(couldRedeem() == true, 'cannot redeem');
    IERC721(_nftInfo.addr).safeTransferFrom(address(this), _nftInfo.addr, _nftInfo.tokenId);

    NftInfo memory originalNftInfo = _nftInfo;

    _nftInfo.addr = address(0);
    _nftInfo.tokenId = 0;

    emit Redeem(msg.sender, originalNftInfo.addr, originalNftInfo.tokenId);
  }

  function couldRedeem() public view override returns (bool) {
    require(_isStaking() == true, 'not yet staking');

    return _rentExpired();
  }

  function setMaxRentDuration(uint64 timeStamp) external override onlyOwner {
    require(_rentExpired() == true, 'cannot set maxDuration');

    maxRentDuration = timeStamp;
    emit MaxRentDurationUpdate(timeStamp);
  }

  function setPricePerDay(uint64 pricePerDay_) external override onlyOwner {
    require(_rentExpired() == true, 'cannot set pricePerDay');

    pricePerDay = pricePerDay_;
    emit PricePerDayUpdate(pricePerDay_);
  }

  function _isStaking() private view returns (bool) {
    return _nftInfo.addr != address(0);
  }

  function getNftInfo() external view returns (NftInfo memory) {
    return _nftInfo;
  }

  function getUser() external view returns (address) {
    return _userInfo.user;
  }

  function getUserInfo() external view returns (UserInfo memory) {
    return _userInfo;
  }

  function getRentInfo()
    external
    view
    override
    returns (
      UserInfo memory,
      address,
      uint64
    )
  {
    return (_userInfo, paymentToken, pricePerDay );
  }

  function isValid() public view override returns (bool) {
    return block.timestamp < _lendValidUntil;
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
