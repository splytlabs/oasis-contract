import { BigNumber } from 'ethers';
import { ethers } from 'hardhat';

const NFT_ID = BigNumber.from(0);
const VALID_UNTIL = 1666598400;
const MIN_DURATION = 1000;
const MAX_DURATION = 100000;
const SHARE_RATIO = 5;
const PAYMENT_TOKEN = '0x8b35ecdb87058f88ac2d6bd54311f38b09951923';
const DEFAULT_DURATION = 10000;
const USER = '0x4bE816dC8e3D03f52af42157B91e6cA981F28499';

const TWO_SECONDS = 2000;

async function wait(timeout = 1000) {
  return new Promise((resolve, reject) => {
    setTimeout(() => resolve({}), timeout);
  });
}

async function main() {
  const [singer] = await ethers.getSigners();

  const Market = await ethers.getContractFactory('Market');
  const market = await Market.deploy();

  const ERC721 = await ethers.getContractFactory('MockErc721');
  const erc721 = await ERC721.deploy();

  await erc721.safeMint(singer.address);
  await wait(TWO_SECONDS);

  await erc721.approve(market.address, NFT_ID);
  await wait(TWO_SECONDS);

  const createResult = await market.createLendOrder(
    erc721.address,
    NFT_ID,
    VALID_UNTIL,
    MIN_DURATION,
    MAX_DURATION,
    SHARE_RATIO,
    PAYMENT_TOKEN
  );
  console.log('createResult', createResult);
  await wait(TWO_SECONDS);

  const fulfillResult = await market.fulfillOrder(erc721.address, NFT_ID, DEFAULT_DURATION, USER);
  console.log('fulfillResult', fulfillResult);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
