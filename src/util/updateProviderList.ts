
import _providerList from '../providers.json'
import fs from 'fs'
import * as laxios from "./laxios";
import axios from "axios";
import { debugLog } from './debugLog';
import PromisePool from '@supercharge/promise-pool';

const providerList = _providerList as {
  [key: string]: {
    rpc: string[]
    chainId: number
  }
}

async function main() {
  let { data: chainData } = await axios('https://chainlist.org/rpcs.json')
  const providerIDMap = {} as {
    [key: string]: string[]
  }
  Object.values(providerList).forEach((i: any) => providerIDMap[i.chainId] = i.rpc)
  chainData = chainData
    .filter((i: any) => i.rpc.length)
    // .filter((i: any) => !i.status || (i.status === 'active' || i.status === 'incubating'))
    .filter((i: any) => i.shortName)

  // shuffle the array
  chainData.sort(() => Math.random() - 0.5)


  await PromisePool
    .withConcurrency(7)
    .for(chainData)
    .process(async (i: any) => {
      i.rpc = await filterForWorkingRPCs(i.rpc.map((j: any) => j.url), i.name, i.chainId)
      if (!i.rpc.length) return;
      if (providerIDMap[i.chainId]) {
        providerIDMap[i.chainId].push(...i.rpc)
      } else if (providerList[i.shortName.toLowerCase()]) {
        debugLog(`Duplicate short name ${i.chainId} for ${i.shortName}, doing nothing`)
      } else {
        providerList[i.shortName.toLowerCase()] = {
          rpc: i.rpc,
          chainId: i.chainId
        }
      }
    })

  Object.entries(providerList).forEach(([key, i]: any) => {
    if (key.includes('testnet')) {
      delete providerList[key]
      return;
    }
    i.rpc = Array.from(new Set(filterRPCs(i.rpc)));
  });
  Object.keys(providerList).forEach((i: any) => {
    if (!providerList[i].rpc.length) delete providerList[i]
  })
  fs.writeFileSync(__dirname + '/../providers.json', JSON.stringify(providerList));
}

function filterRPCs(rpc: string[]): string[] {
  return rpc.filter((i: string) => {
    if (i.endsWith('/demo')) return false // remove demo rpc
    if (i.includes('$')) return false // remove anything where api key is injected
    // reject websocket, http, testnet, devnet, and anything with '='
    if (/(wss\:|ws\:|http\:|test|devnet|\=)/.test(i)) return false // remove anything with blacklisted words
    return true
  }).map((i: string) => {
    if (i.endsWith('/')) return i.slice(0, -1)
    return i
  })
}

async function filterForWorkingRPCs(rpc: string[], chain: string, chainId: number): Promise<string[]> {
  if (rpc.length < 10) return rpc
  rpc = filterRPCs(rpc)

  const promises = await Promise.all(rpc.map(async (i: string) => {
    try {
      const { data } = await laxios.post(i, {
        jsonrpc: '2.0',
        method: 'eth_blockNumber',
        params: [],
        id: 1
      }, {
        timeout: 30000
      })
      if (data.result) return i
    } catch (e) {
      console.log((e as any)?.message, i, chain)
    }
  }))

  return rpc.filter((_i: string, index: number) => promises[index])
}

main()
