import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';
import { Lend, MockErc721 } from '../typechain-types';
import { withoutResolve, expectRevertedAsync } from './utils';

const RENTER = '0xD4a09BfeCEd9787aEE55199653Bd2D9700AF5cEd';
const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';

const DEFULAT_LEND_VALID_UNTIL_OFFSET = 10000000;

const DEFAULT_MAX_RENT_DURATION = 100000;
const DEFUALT_RENT_DURATION = 1000;
const RENT_DURATION_OVER_MAX = DEFAULT_MAX_RENT_DURATION + DEFUALT_RENT_DURATION;

const DEFUALT_SHARE_RATION = 50;
const DEFUALT_SHARE_TOKEN = '0x0000000000000000000000000000000000000000';

const APPROVED_NFT_TOKEN_ID = 0;
const NOT_APPROVED_NFT_TOKEN_ID = 1;

describe('Lend', () => {
  let lendFactory: any;
  let erc721Factory: any;
  let erc721OwnerAddress: string;

  let lendContract: Lend;
  let erc721Contract: MockErc721;

  before(async () => {
    lendFactory = await ethers.getContractFactory('Lend');

    const [owner] = await ethers.getSigners();
    erc721OwnerAddress = owner.address;
    erc721Factory = await ethers.getContractFactory('MockErc721', owner);
  });

  beforeEach(async () => {
    const latestBlockTime = await time.latest();

    lendContract = await lendFactory.deploy(
      DEFUALT_SHARE_RATION,
      DEFUALT_SHARE_TOKEN,
      latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
      DEFAULT_MAX_RENT_DURATION
    );

    erc721Contract = await erc721Factory.deploy();
    await erc721Contract.safeMint(erc721OwnerAddress);
    await erc721Contract.safeMint(erc721OwnerAddress);
    await erc721Contract.approve(lendContract.address, APPROVED_NFT_TOKEN_ID);
  });

  describe('stake', () => {
    it('Lend할 NFT를 스테이킹한다', async () => {
      // when
      const result = withoutResolve(lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID));

      // then
      await expect(result).not.to.be.reverted;
    });

    it('권한이 없는 NFT라면 스테이킹할 수 없다.', async () => {
      // when
      const result = withoutResolve(lendContract.stake(erc721Contract.address, NOT_APPROVED_NFT_TOKEN_ID));

      // then
      await expectRevertedAsync(result, 'ERC721: caller is not token owner nor approved');
    });

    it('스테이킹되면 NftInfo(address, tokenId) 값을 업데이트한다.', async () => {
      // when
      await lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID);

      const [address, tokenId] = await lendContract.getNftInfo();

      expect(address).to.be.equal(erc721Contract.address);
      expect(tokenId).to.be.equal(APPROVED_NFT_TOKEN_ID);
    });

    it('성공적으로 스테이킹 됐다면 Stake 이벤트가 발생한다.', async () => {
      // when
      const result = withoutResolve(lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID));

      // then
      await expect(result)
        .to.emit(lendContract, 'Stake')
        .withArgs(anyValue, erc721Contract.address, APPROVED_NFT_TOKEN_ID);
    });
    it('이미 스테이킹된 상태라면 스테이킹할 수 없다.', async () => {
      // given
      await lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID);

      // when
      const result = withoutResolve(lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID));

      // then
      await expectRevertedAsync(result, 'already staking');
    });
    it('Market Contract가 아니라면 스테이킹할 수 없다.', async () => {
      // given
      const [_, other] = await ethers.getSigners();
      await lendContract.transferOwnership(other.address);

      // when
      const result = withoutResolve(lendContract.stake(erc721Contract.address, NOT_APPROVED_NFT_TOKEN_ID));

      // then
      await expectRevertedAsync(result, 'Ownable: caller is not the owner');
    });
  });

  describe('redeem', () => {
    beforeEach(async () => {
      await lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID);
    });

    it('Rent가 되지 않았다면 NFT를 회수할 수 있다.', async () => {
      // when
      const result = await lendContract.redeem();

      // then
      await expect(result).not.to.be.reverted;
    });

    it('Renting 상태라면 NFT를 회수할 수 없다.', async () => {
      // given
      await lendContract.rent(DEFUALT_RENT_DURATION, RENTER);

      // when
      const result = withoutResolve(lendContract.redeem());

      // then
      await expectRevertedAsync(result, 'cannot redeem');
    });

    it('Rent가 만료 되었다면 NFT를 회수할 수 있다.', async () => {
      // given
      await lendContract.rent(DEFUALT_RENT_DURATION, RENTER);
      await time.increase(DEFUALT_RENT_DURATION + 1000);

      // when
      const result = withoutResolve(lendContract.redeem());

      // then
      await expect(result).not.to.be.reverted;
    });

    it('Market Contract가 아니라면 회수할 수 없다.', async () => {
      // given
      const [_, other] = await ethers.getSigners();
      await lendContract.transferOwnership(other.address);

      // when
      const result = withoutResolve(lendContract.redeem());

      // then
      await expectRevertedAsync(result, 'Ownable: caller is not the owner');
    });

    it('성공적으로 회수되면 NftInfo(address, tokenId) 값을 초기화한다.', async () => {
      // when
      await lendContract.redeem();
      const [address, tokenId] = await lendContract.getNftInfo();

      // then
      expect(address).to.be.equal(ZERO_ADDRESS);
      expect(tokenId).to.be.equal(ethers.BigNumber.from('0'));
    });

    it('성공적으로 회수되면 Redeem 이벤트가 발생한다.', async () => {
      // when
      const result = withoutResolve(lendContract.redeem());

      // then
      await expect(result)
        .to.emit(lendContract, 'Redeem')
        .withArgs(erc721OwnerAddress, erc721Contract.address, APPROVED_NFT_TOKEN_ID);
    });
  });

  describe('rent', () => {
    beforeEach(async () => {
      await lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID);
    });

    it('Renting 상태가 아니라면 NFT를 빌릴 수 있다.', async () => {
      // when
      const result = withoutResolve(lendContract.rent(DEFUALT_RENT_DURATION, RENTER));

      // then
      await expect(result).not.to.be.reverted;
    });

    it('Renting 상태라면 NFT를 빌릴 수 없다.', async () => {
      // given
      await lendContract.rent(DEFUALT_RENT_DURATION, RENTER);

      // when
      const result = withoutResolve(lendContract.rent(DEFUALT_RENT_DURATION, RENTER));

      // then
      await expectRevertedAsync(result, 'cannot rent');
    });

    it('빌리고자 하는 기간이 Lender가 설정한 MaxDuration보다 길다면 NFT를 빌릴 수 없다.', async () => {
      // when
      const result = withoutResolve(lendContract.rent(RENT_DURATION_OVER_MAX, RENTER));

      // then
      await expectRevertedAsync(result, 'over maxRentDuration');
    });

    it('성공적으로 NFT를 빌렸다면 RentInfo를 업데이트한다.', async () => {
      // given
      await lendContract.rent(DEFUALT_RENT_DURATION, RENTER);
      const latestBlockTimeStamp = await time.latest();

      // when
      const [start, end, user] = await lendContract.getUserInfo();

      // then
      expect(user).to.be.equal(RENTER);
      expect(start).to.be.equal(latestBlockTimeStamp);
      expect(end).to.be.equal(DEFUALT_RENT_DURATION + latestBlockTimeStamp);
    });

    it('성공적으로 NFT를 빌렸다면 UserInfoUpdate 이벤트가 발생한다.', async () => {
      // when
      const result = await lendContract.rent(DEFUALT_RENT_DURATION, RENTER);
      const latestBlockTimeStamp = await time.latest();

      // then
      await expect(result)
        .to.emit(lendContract, 'UserInfoUpdate')
        .withArgs(anyValue, latestBlockTimeStamp, latestBlockTimeStamp + DEFUALT_RENT_DURATION, RENTER);
    });
  });

  describe('couldRent', () => {
    beforeEach(async () => {
      await lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID);
    });
    it('NFT를 빌릴 수 있는 상태라면 true를 출력한다.', async () => {
      const result = await lendContract.couldRent();

      expect(result).to.be.equal(true);
    });

    it('NFT를 빌릴 수 없는 상태라면 false를 출력한다.', async () => {
      // given
      await lendContract.rent(DEFUALT_RENT_DURATION, RENTER);

      // when
      const result = await lendContract.couldRent();

      // then
      expect(result).to.be.equal(false);
    });

    it('스테이킹된 NFT가 없는 경우 빌릴 수 없다.', async () => {
      // given
      await lendContract.redeem();

      // when
      const result = withoutResolve(lendContract.couldRent());

      // then
      await expectRevertedAsync(result, 'not yet staking');
    });

    it('lend의 유효기간이 끝난 경우 빌릴 수 없다.', async () => {
      // given
      const latestBlockTimeStamp = await time.latest();
      await time.increase(latestBlockTimeStamp + DEFULAT_LEND_VALID_UNTIL_OFFSET + 1000);

      // when
      const result = withoutResolve(lendContract.rent(DEFUALT_RENT_DURATION, RENTER));

      // then
      await expectRevertedAsync(result, 'expired lend');
    });
  });

  describe('couldRedeem', () => {
    beforeEach(async () => {
      await lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID);
    });

    it('NFT를 회수할 수 있는 상태라면 true를 출력한다.', async () => {
      // when
      const result = await lendContract.couldRedeem();

      // then
      expect(result).to.equal(true);
    });

    it('NFT를 회수할 수 없는 상태라면 false를 출력한다.', async () => {
      // given
      await lendContract.rent(DEFUALT_RENT_DURATION, RENTER);

      // when
      const result = await lendContract.couldRedeem();

      // then
      expect(result).to.equal(false);
    });

    it('스테이킹된 NFT가 없는 경우 빌릴 수 없다.', async () => {
      // given
      await lendContract.redeem();

      // when
      const result = withoutResolve(lendContract.couldRedeem());

      // then
      await expectRevertedAsync(result, 'not yet staking');
    });
  });

  describe('getUser', () => {
    it('NFT를 빌린 유저의 지갑 주소를 조회한다.', async () => {
      // given
      await lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID);

      // when
      await lendContract.rent(DEFUALT_RENT_DURATION, RENTER);
      const result = await lendContract.getUser();

      // then
      expect(result).to.equal(RENTER);
    });

    it('NFT를 빌린 유저가 없다면 address(0) 출력한다.', async () => {
      // when
      const result = await lendContract.getUser();

      // then
      expect(result).to.equal(ZERO_ADDRESS);
    });
  });

  describe('getNftInfo', () => {
    it('스테이킹된 NFT 정보(address, tokenId)를 조회한다.', async () => {
      // given
      await lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID);

      // when
      const [address, tokenId] = await lendContract.getNftInfo();

      // then
      expect(address).to.be.equal(erc721Contract.address);
      expect(tokenId).to.be.equal(APPROVED_NFT_TOKEN_ID);
    });

    it('스테이킹된 NFT 정보가 없다면 default 값을 출력한다.', async () => {
      const [address, tokenId] = await lendContract.getNftInfo();

      expect(address).to.be.equal(ZERO_ADDRESS);
      expect(tokenId).to.be.equal(ethers.BigNumber.from('0'));
    });
  });

  describe('setShareRatio', () => {
    const NEW_SHARE_RATIO = 10;

    beforeEach(async () => {
      await lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID);
    });

    it('Market Contract라면 수익 공유 비율을 설정할 수 있다.', async () => {
      const result = withoutResolve(lendContract.setShareRatio(NEW_SHARE_RATIO));

      await expect(result).not.to.be.reverted;
    });

    it('Market Contract가 아니라면 수익 공유 비율을 설정할 수 없다.', async () => {
      // given
      const [_, other] = await ethers.getSigners();
      await lendContract.transferOwnership(other.address);

      // when
      const result = withoutResolve(lendContract.setShareRatio(NEW_SHARE_RATIO));

      // then
      await expectRevertedAsync(result, 'Ownable: caller is not the owner');
    });

    it('NFT가 Renting 상태라면 수익 공유 비율을 설정할 수 없다.', async () => {
      // given
      await lendContract.rent(DEFUALT_RENT_DURATION, RENTER);

      // when
      const result = withoutResolve(lendContract.setShareRatio(NEW_SHARE_RATIO));

      // then
      await expectRevertedAsync(result, 'cannot set shareRatio');
    });

    it('성공적으로 수익 공유 비율이 설정되었다면 ShareRatioUpdate 이벤트가 발생한다.', async () => {
      // when
      const result = await lendContract.setShareRatio(NEW_SHARE_RATIO);

      // then
      await expect(result).to.be.emit(lendContract, 'ShareRatioUpdate').withArgs(NEW_SHARE_RATIO);
    });
  });

  describe('setMaxRentDuration', () => {
    const NEW_MAX_RENT_DURATION = 1234;

    beforeEach(async () => {
      await lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID);
    });

    it('Market Contract라면 최대 대여 기간 설정할 수 있다.', async () => {
      // when
      const result = await lendContract.setMaxRentDuration(NEW_MAX_RENT_DURATION);

      // then
      await expect(result).not.to.be.reverted;
    });

    it('Market Contract가 아니라면 최대 대여 기간 설정할 수 없다.', async () => {
      // given
      const [_, other] = await ethers.getSigners();
      await lendContract.transferOwnership(other.address);

      // when
      const result = withoutResolve(lendContract.setMaxRentDuration(NEW_MAX_RENT_DURATION));

      // then
      await expectRevertedAsync(result, 'Ownable: caller is not the owner');
    });

    it('NFT가 Renting 상태라면 최대 대여 기간을 설정할 수 없다.', async () => {
      // given
      await lendContract.rent(DEFUALT_RENT_DURATION, RENTER);

      // when
      const result = withoutResolve(lendContract.setMaxRentDuration(DEFUALT_RENT_DURATION));

      // then
      await expectRevertedAsync(result, 'cannot set maxDuration');
    });

    it('성공적으로 최대 대여 기간이 설정되었다면 setMaxRentDuration 이벤트가 발생한다.', async () => {
      // when
      const newDuration = DEFAULT_MAX_RENT_DURATION + 1000;
      const result = await lendContract.setMaxRentDuration(newDuration);

      // then
      await expect(result).to.be.emit(lendContract, 'MaxRentDurationUpdate').withArgs(newDuration);
    });
  });

  describe('getUserInfo', () => {
    beforeEach(async () => {
      await lendContract.stake(erc721Contract.address, APPROVED_NFT_TOKEN_ID);
    });
    it('Renting 상태인 NFT의 UserInfo(start, end, user)를 조회한다.', async () => {
      // given
      await lendContract.rent(DEFUALT_RENT_DURATION, RENTER);

      // when
      const [start, end, user] = await lendContract.getUserInfo();

      // then
      const latestBlockTimeStamp = await time.latest();
      expect(start).to.be.equal(latestBlockTimeStamp);
      expect(end).to.be.equal(latestBlockTimeStamp + DEFUALT_RENT_DURATION);
      expect(user).to.be.equal(RENTER);
    });

    it('Renting 상태가 아니라면 default 값을 출력한다.', async () => {
      // when
      const [start, end, user] = await lendContract.getUserInfo();

      // then
      expect(start).to.be.equal(ethers.BigNumber.from('0'));
      expect(end).to.be.equal(ethers.BigNumber.from('0'));
      expect(user).to.be.equal(ZERO_ADDRESS);
    });
  });

  // TODO: 구현필요
  describe('getRentInfo', () => {});

  // TODO: 구현필요
  describe('isValid', () => {
    it('컨트랙트의 상태가 유효하다면 true를 출력한다.', () => {
      // given
      // when
      // then
    });

    it('컨트랙트의 상태가 유효하지 않다면 false를 출력한다.', () => {
      // given
      // when
      // then
    });
  });
});
