import { ethers } from 'hardhat';

async function main() {
  const Market = await ethers.getContractFactory('Market');
  const market = await Market.deploy();
  await market.deployed();
  console.log('Market deployed to:', market.address);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
