import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';
import '@nomicfoundation/hardhat-chai-matchers';
import '@nomiclabs/hardhat-ethers';

const KLAYTN_URL = 'https://api.baobab.klaytn.net:8651';

const config: HardhatUserConfig = {
  solidity: '0.8.9',
  networks: {
    klaytn: {
      url: KLAYTN_URL,
      accounts: ['0x' + process.env.KLAYTN_PRIVATE_KEY],
    },
    mumbai: {
      url: process.env.MUMBAI_RPC_URL,
      accounts: ['0x' + process.env.METAMAK_PRIVATE_KEY],
    },
  },
};

export default config;
