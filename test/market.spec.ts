import { expect } from 'chai';
import { ethers } from 'hardhat';
import { time } from '@nomicfoundation/hardhat-network-helpers';
import { Market, MockErc721 } from '../typechain-types';
import { withoutResolve, expectRevertedAsync } from './utils';
import { anyValue } from '@nomicfoundation/hardhat-chai-matchers/withArgs';

const APPROVED_NFT_TOKEN_ID = 0;
const NOT_APPROVED_NFT_TOKEN_ID = 1;

const DEFULAT_MIN_DURATION = 1000;
const DEFULAT_MAX_DURATION = 100000;
const DEFULAT_PRICE_PER_DAY = 10;
const DEFULAT_PAYMENT_TOKEN = '0xD4a09BfeCEd9787aEE55199653Bd2D9700AF5cEd';
const DEFULAT_LEND_VALID_UNTIL_OFFSET = 10000000;
const DEFUALT_RENT_DURATION = 86400;

const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000';
const ZERO_NUMBER = ethers.BigNumber.from('0');
const RENTER = '0xD4a09BfeCEd9787aEE55199653Bd2D9700AF5cEd';
const OTHER_RENTER = '0x4bE816dC8e3D03f52af42157B91e6cA981F28499';

const UNIX_TIME_FOR_A_DAY = 86400;
const UNIT_OF_PRICE = 1e18;

describe.only('Market', () => {
  let MarketFactory: any;
  let erc721Factory: any;
  let erc721OwnerAddress: string;

  let MarketContract: Market;
  let erc721Contract: MockErc721;
  let latestBlockTime: number;

  before(async () => {
    MarketFactory = await ethers.getContractFactory('Market');

    const [owner] = await ethers.getSigners();
    erc721OwnerAddress = owner.address;
    erc721Factory = await ethers.getContractFactory('MockErc721', owner);
  });

  beforeEach(async () => {
    MarketContract = await MarketFactory.deploy();
    erc721Contract = await erc721Factory.deploy();

    await erc721Contract.safeMint(erc721OwnerAddress);
    await erc721Contract.safeMint(erc721OwnerAddress);
    await erc721Contract.approve(MarketContract.address, APPROVED_NFT_TOKEN_ID);

    latestBlockTime = await time.latest();
  });
  describe('Create Lend', () => {
    it('Lend를 생성한다.', async () => {
      // given

      // when
      const result = withoutResolve(
        MarketContract.createLendOrder(
          erc721Contract.address,
          APPROVED_NFT_TOKEN_ID,
          latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
          DEFULAT_MIN_DURATION,
          DEFULAT_MAX_DURATION,
          DEFULAT_PRICE_PER_DAY,
          DEFULAT_PAYMENT_TOKEN
        )
      );

      // then
      await expect(result).not.to.be.reverted;
    });

    it('이미 Lend된 nft에 대해서는 Lend할 수 없다.', async () => {
      // given
      await MarketContract.createLendOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
        DEFULAT_MIN_DURATION,
        DEFULAT_MAX_DURATION,
        DEFULAT_PRICE_PER_DAY,
        DEFULAT_PAYMENT_TOKEN
      );

      // when
      const result = withoutResolve(
        MarketContract.createLendOrder(
          erc721Contract.address,
          APPROVED_NFT_TOKEN_ID,
          latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
          DEFULAT_MIN_DURATION,
          DEFULAT_MAX_DURATION,
          DEFULAT_PRICE_PER_DAY,
          DEFULAT_PAYMENT_TOKEN
        )
      );

      // then
      await expectRevertedAsync(result, 'already lend');
    });

    it('Nft에 대한 권한이 없는 경우에는 Lend할 수 없다.', async () => {
      // given
      // when
      const result = withoutResolve(
        MarketContract.createLendOrder(
          erc721Contract.address,
          NOT_APPROVED_NFT_TOKEN_ID,
          latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
          DEFULAT_MIN_DURATION,
          DEFULAT_MAX_DURATION,
          DEFULAT_PRICE_PER_DAY,
          DEFULAT_PAYMENT_TOKEN
        )
      );

      // then
      await expectRevertedAsync(result, 'only approved or owner');
    });

    it('성공적으로 Lend되면 CreateLendOrder 이벤트가 발생한다.', async () => {
      // given
      const [owner] = await ethers.getSigners();

      // when
      const result = withoutResolve(
        MarketContract.createLendOrder(
          erc721Contract.address,
          APPROVED_NFT_TOKEN_ID,
          latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
          DEFULAT_MIN_DURATION,
          DEFULAT_MAX_DURATION,
          DEFULAT_PRICE_PER_DAY,
          DEFULAT_PAYMENT_TOKEN
        )
      );

      // then
      await expect(result)
        .to.emit(MarketContract, 'CreateLendOrder')
        .withArgs(
          anyValue,
          owner.address,
          erc721Contract.address,
          APPROVED_NFT_TOKEN_ID,
          DEFULAT_MIN_DURATION,
          DEFULAT_MAX_DURATION,
          DEFULAT_PRICE_PER_DAY,
          DEFULAT_PAYMENT_TOKEN
        );
    });

    it('minDuration이 MaxDuration 보다 크면 Lend할 수 없다.', async () => {
      // given
      // when
      const result = withoutResolve(
        MarketContract.createLendOrder(
          erc721Contract.address,
          APPROVED_NFT_TOKEN_ID,
          latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
          DEFULAT_MIN_DURATION + DEFULAT_MAX_DURATION,
          DEFULAT_MAX_DURATION,
          DEFULAT_PRICE_PER_DAY,
          DEFULAT_PAYMENT_TOKEN
        )
      );

      // then
      await expectRevertedAsync(result, 'maxDuration must be longer than minDuration');
    });

    it('MaxDuration + block.timestamp가 lendValidUntil 보다 크면 Lend할 수 없다.', async () => {
      // given
      // when
      const result = withoutResolve(
        MarketContract.createLendOrder(
          erc721Contract.address,
          APPROVED_NFT_TOKEN_ID,
          latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
          DEFULAT_MIN_DURATION,
          DEFULAT_MAX_DURATION + latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
          DEFULAT_PRICE_PER_DAY,
          DEFULAT_PAYMENT_TOKEN
        )
      );

      // then
      await expectRevertedAsync(result, 'lendValidUntil must be longer than block.timestamp + maxDuration');
    });
  });

  describe('Cancel Lend', async () => {
    beforeEach(async () => {
      await MarketContract.createLendOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
        DEFULAT_MIN_DURATION,
        DEFULAT_MAX_DURATION,
        DEFULAT_PRICE_PER_DAY,
        DEFULAT_PAYMENT_TOKEN
      );
    });
    it('Nft가 렌트 중이 아닐 때는 Lend를 취소할 수 있다.', async () => {
      // given

      // when
      const result = await MarketContract.cancelLendOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID);

      // then
      await expect(result).not.to.be.reverted;
    });

    it('Nft가 렌트 중일 때는 Lend를 취소할 수 없다.', async () => {
      // given
      const value = DEFULAT_PRICE_PER_DAY * (DEFUALT_RENT_DURATION / UNIX_TIME_FOR_A_DAY) * UNIT_OF_PRICE;
      await MarketContract.fulfillOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID, DEFUALT_RENT_DURATION, RENTER, {
        value: ethers.BigNumber.from(`${value}`),
      });

      // when
      const result = withoutResolve(MarketContract.cancelLendOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID));

      // then
      await expectRevertedAsync(result, 'cannot redeem');
    });

    it('자신이 lend한 nft가 아니라면 Lend를 취소할 수 없다.', async () => {
      // give
      await MarketContract.cancelLendOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID);

      // when
      const result = withoutResolve(MarketContract.cancelLendOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID));

      // then
      await expectRevertedAsync(result, 'not lender');
    });
    it('성공적으로 취소되면 CancelLendOrder 이벤트가 발생한다.', async () => {
      // given
      const [owner] = await ethers.getSigners();

      // when
      const result = await MarketContract.cancelLendOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID);

      // then
      await expect(result)
        .to.emit(MarketContract, 'CancelLendOrder')
        .withArgs(anyValue, owner.address, erc721Contract.address, APPROVED_NFT_TOKEN_ID);
    });

    it('성공적으로 취소되면 Lending 상태를 초기화한다.', async () => {
      // given
      await MarketContract.cancelLendOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID);

      // when
      const [
        lendId,
        lender,
        nftAddress,
        nftId,
        createTime,
        minDuration,
        maxDuration,
        shareRatio,
        paymentToken,
        lendContract,
      ] = await MarketContract.getLendOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID);

      // then
      expect(lender).to.be.equal(ZERO_ADDRESS);
      expect(nftAddress).to.be.equal(ZERO_ADDRESS);
      expect(nftId).to.be.equal(ZERO_NUMBER);
      expect(createTime).to.be.equal(ZERO_NUMBER);
      expect(minDuration).to.be.equal(ZERO_NUMBER);
      expect(maxDuration).to.be.equal(ZERO_NUMBER);
      expect(shareRatio).to.be.equal(ZERO_NUMBER);
      expect(paymentToken).to.be.equal(ZERO_ADDRESS);
      expect(lendContract).to.be.equal(ZERO_ADDRESS);
    });
  });

  describe('Fullfill Lend', () => {
    const value = DEFULAT_PRICE_PER_DAY * (DEFUALT_RENT_DURATION / UNIX_TIME_FOR_A_DAY) * UNIT_OF_PRICE;

    it('Nft가 렌트 중이 아니라면 Rent할 수 있다.', async () => {
      // given
      await MarketContract.createLendOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
        DEFULAT_MIN_DURATION,
        DEFULAT_MAX_DURATION,
        DEFULAT_PRICE_PER_DAY,
        DEFULAT_PAYMENT_TOKEN
      );

      // when
      const result = await MarketContract.fulfillOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        DEFUALT_RENT_DURATION,
        RENTER,
        {
          value: ethers.BigNumber.from(`${value}`),
        }
      );

      // then
      await expect(result).not.to.be.reverted;
    });
    it('Nft가 렌트 중이라면 Rent할 수 없다.', async () => {
      // given
      await MarketContract.createLendOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
        DEFULAT_MIN_DURATION,
        DEFULAT_MAX_DURATION,
        DEFULAT_PRICE_PER_DAY,
        DEFULAT_PAYMENT_TOKEN
      );
      await MarketContract.fulfillOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        DEFUALT_RENT_DURATION,
        OTHER_RENTER,
        {
          value: ethers.BigNumber.from(`${value}`),
        }
      );

      // when
      const result = withoutResolve(
        MarketContract.fulfillOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID, DEFUALT_RENT_DURATION, RENTER, {
          value: ethers.BigNumber.from(`${value}`),
        })
      );

      // then
      await expectRevertedAsync(result, 'cannot rent');
    });
    it('Lend 되어 있지 않다면 Rent할 수 없다.', async () => {
      // when
      const result = withoutResolve(
        MarketContract.fulfillOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID, DEFUALT_RENT_DURATION, RENTER, {
          value: ethers.BigNumber.from(`${value}`),
        })
      );

      // then
      await expectRevertedAsync(result, 'not yet lend');
    });
    it('유효기간이 만료되었다면 Rent할 수 없다.', async () => {
      // given
      await MarketContract.createLendOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
        DEFULAT_MIN_DURATION,
        DEFULAT_MAX_DURATION,
        DEFULAT_PRICE_PER_DAY,
        DEFULAT_PAYMENT_TOKEN
      );
      await time.increase(DEFULAT_LEND_VALID_UNTIL_OFFSET + 1000);

      // when
      const result = withoutResolve(
        MarketContract.fulfillOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID, DEFUALT_RENT_DURATION, RENTER, {
          value: ethers.BigNumber.from(`${value}`),
        })
      );

      // then
      await expectRevertedAsync(result, 'expired lend');
    });
    it('성공적으로 Rent 됐다면 FulfillOrder 이벤트가 발생한다.', async () => {
      // given
      const [owner] = await ethers.getSigners();
      await MarketContract.createLendOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
        DEFULAT_MIN_DURATION,
        DEFULAT_MAX_DURATION,
        DEFULAT_PRICE_PER_DAY,
        DEFULAT_PAYMENT_TOKEN
      );

      // when
      const result = await MarketContract.fulfillOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        DEFUALT_RENT_DURATION,
        RENTER,
        {
          value: ethers.BigNumber.from(`${value}`),
        }
      );
      const blockTime = await time.latest();

      // then
      await expect(result)
        .to.emit(MarketContract, 'FulfillOrder')
        .withArgs(
          anyValue,
          anyValue,
          owner.address,
          owner.address,
          erc721Contract.address,
          APPROVED_NFT_TOKEN_ID,
          blockTime,
          blockTime + DEFUALT_RENT_DURATION,
          DEFULAT_PRICE_PER_DAY,
          DEFULAT_PAYMENT_TOKEN
        );
    });
    it('선불 렌트 비용과 renter가 보낸 금액이 일치하지 않으면 에러를 출력한다. ', async () => {
      // given
      await MarketContract.createLendOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
        DEFULAT_MIN_DURATION,
        DEFULAT_MAX_DURATION,
        DEFULAT_PRICE_PER_DAY,
        DEFULAT_PAYMENT_TOKEN
      );

      // when
      const result = withoutResolve(
        MarketContract.fulfillOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID, DEFUALT_RENT_DURATION, RENTER, {
          value: ZERO_NUMBER,
        })
      );

      // then
      await expectRevertedAsync(result, 'not match the value');
    });

    it('선불 렌트 비용과 renter가 보낸 금액이 일치해야 한다.', async () => {
      // given
      await MarketContract.createLendOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
        DEFULAT_MIN_DURATION,
        DEFULAT_MAX_DURATION,
        DEFULAT_PRICE_PER_DAY,
        DEFULAT_PAYMENT_TOKEN
      );

      // when
      const result = await MarketContract.fulfillOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        DEFUALT_RENT_DURATION,
        RENTER,
        {
          value: ethers.BigNumber.from(`${value}`),
        }
      );

      // then
      await expect(result).not.to.be.reverted;
    });
  });

  describe('get Lend', () => {
    it('Lend된 nft의 Lending 정보를 불러온다.', async () => {
      // given
      const [owner] = await ethers.getSigners();
      await MarketContract.createLendOrder(
        erc721Contract.address,
        APPROVED_NFT_TOKEN_ID,
        latestBlockTime + DEFULAT_LEND_VALID_UNTIL_OFFSET,
        DEFULAT_MIN_DURATION,
        DEFULAT_MAX_DURATION,
        DEFULAT_PRICE_PER_DAY,
        DEFULAT_PAYMENT_TOKEN
      );

      // when
      const [lendId, lender, nftAddress, nftId, createTime, minDuration, maxDuration, pricePerDay, paymentToken] =
        await MarketContract.getLendOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID);

      // then
      expect(lender).to.be.equal(owner.address);
      expect(nftAddress).to.be.equal(erc721Contract.address);
      expect(nftId).to.be.equal(APPROVED_NFT_TOKEN_ID);
      expect(createTime).to.be.equal(await time.latest());
      expect(minDuration).to.be.equal(DEFULAT_MIN_DURATION);
      expect(maxDuration).to.be.equal(DEFULAT_MAX_DURATION);
      expect(pricePerDay).to.be.equal(DEFULAT_PRICE_PER_DAY);
      expect(paymentToken).to.be.equal(DEFULAT_PAYMENT_TOKEN);
    });

    it('Lend된 nft가 없다면 default Lending 정보를 불러온다.', async () => {
      // given
      // when
      const [
        lendId,
        lender,
        nftAddress,
        nftId,
        createTime,
        minDuration,
        maxDuration,
        shareRatio,
        paymentToken,
        lendContract,
      ] = await MarketContract.getLendOrder(erc721Contract.address, APPROVED_NFT_TOKEN_ID);

      // then
      expect(lender).to.be.equal(ZERO_ADDRESS);
      expect(nftAddress).to.be.equal(ZERO_ADDRESS);
      expect(nftId).to.be.equal(ZERO_NUMBER);
      expect(createTime).to.be.equal(ZERO_NUMBER);
      expect(minDuration).to.be.equal(ZERO_NUMBER);
      expect(maxDuration).to.be.equal(ZERO_NUMBER);
      expect(shareRatio).to.be.equal(ZERO_NUMBER);
      expect(paymentToken).to.be.equal(ZERO_ADDRESS);
      expect(lendContract).to.be.equal(ZERO_ADDRESS);
    });
  });
});
