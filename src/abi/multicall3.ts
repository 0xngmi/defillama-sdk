import { ethers } from "ethers";
import { Chain } from "../general";
import convertResults from "./convertResults";
import { BlockTag } from "@ethersproject/providers"
import { debugLog } from "../util/debugLog"
import makeMultiCallV2 from './multicall'
import * as Tron from './tron'
import { call } from './index'
// https://github.com/mds1/multicall
const MULTICALL_V3_ADDRESS = '0xca11bde05977b3631167028862be2a173976ca11'

const DEPLOYMENT_BLOCK = {
  ethereum: 14353601,
  arbitrum: 7654707,
  arbitrum_nova: 1746963,
  optimism: 4286263,
  polygon: 25770160,
  polygon_zkevm: 57746,
  fantom: 33001987,
  bsc: 15921452,
  moonriver: 609002,
  moonbeam: 609002,
  avax: 11907934,
  harmony: 24185753,
  cronos: 1963112,
  klaytn: 96002415,
  godwoken_v1: 15034,
  celo: 13112599,
  oasis: 1481392,
  rsk: 4249540,
  metis: 2338552,
  heco: 14413501,
  okexchain: 10364792,
  astar: 761794,
  aurora: 62907816,
  boba: 446859,
  songbird: 13382504,
  fuse: 16146628,
  flare: 3002461,
  milkomeda: 4377424,
  velas: 55883577,
  // telos: 246530709,
  step: 5734583,
  canto: 2905789,
  iotex: 22163670,
  bitgert: 2118034,
  kava: 3661165,
  dfk: 14790551,
  pulse: 14353601,
  onus: 805931,
  rollux: 119222,
  xdai: 21022491,
  evmos: 188483,
  thundercore: 100671921,
  kcc: 11760430,
  linea: 42,
  zora: 5882,
  eos_evm: 7943933,
  // dogechain: 14151696, // for some reason this is not working
  tron: 51067989,
  era: 3908235,
  mantle: 3962,
  neon_evm: 205939275,
  base: 5022,
  darwinia: 251739,
} as {
  [key: string | Chain]: number
}

export default async function makeMultiCall(
  functionABI: any,
  calls: {
    contract: string;
    params: any[];
  }[],
  chain: Chain,
  block?: BlockTag,
): Promise<any> {
  if (chain === 'tron') return Tron.multiCall(functionABI, calls)
  if (!functionABI) throw new Error('Missing ABI parameter')
  if (calls.some(i => !i.contract)) throw new Error('Missing target, abi:' + functionABI)
  if (!isMulticallV3Supported(chain, block))
    return makeMultiCallV2(functionABI, calls, chain, block)
  const contractInterface = new ethers.utils.Interface([functionABI])
  let fd = Object.values(contractInterface.functions)[0];

  const contractCalls = calls.map((call) => {
    const data = contractInterface.encodeFunctionData(fd, call.params);
    return {
      to: call.contract,
      data,
    };
  });

  let returnValues: any
  try {
    await _call()
  } catch (e) {
    debugLog('Multicall failed, retrying call...')
    await _call()
  }

  return returnValues.map((values: any, index: number) => {
    let output = null
    let success = true
    try {
      output = convertResults(contractInterface.decodeFunctionResult(fd, values.returnData));
    } catch (e) { success = false }
    return {
      input: {
        params: calls[index].params,
        target: calls[index].contract,
      },
      success, output,
    };
  });

  async function _call() {
    const multicallAddress = getMulticallAddress(chain, block) as string
    const { output: returnData } = await call({ chain, block, target: multicallAddress, abi: 'function tryAggregate(bool requireSuccess, tuple(address target, bytes callData)[] calls) payable returns (tuple(bool success, bytes returnData)[] returnData)', params: [false, contractCalls.map((call) => [call.to, call.data])] })

    returnValues = returnData;
  }
}

export function isMulticallV3Supported(chain: Chain, block?: BlockTag) {
  const startBlock = DEPLOYMENT_BLOCK[chain]
  if (!startBlock) return false
  if (!block) return true
  if (typeof block === 'string') return block === 'latest'
  return block > startBlock
}

export function getMulticallAddress(chain: Chain, block?: BlockTag) {
  if (!isMulticallV3Supported(chain, block)) return null
  let multicallAddress = MULTICALL_V3_ADDRESS
  switch (chain) {
    case 'onus': multicallAddress = '0x748c384f759cc596f0d9fa96dcabe8a11e443b30'; break;
    case 'era': multicallAddress = '0xF9cda624FBC7e059355ce98a31693d299FACd963'; break;
    case 'mantle': multicallAddress = '0x05f3105fc9FC531712b2570f1C6E11dD4bCf7B3c'; break;
    case 'tron': multicallAddress = 'TEazPvZwDjDtFeJupyo7QunvnrnUjPH8ED'; break;
    case 'neon_evm': multicallAddress = '0x2f6eee8ee450a959e640b6fb4dd522b5d5dcd20f'; break;
  }
  return multicallAddress
}
