import { getBalance } from "./eth/index";
import { getProvider, setProvider } from "./general";
import { ethers, } from "ethers"
import { getProviderUrl } from "./generalUtil";
import { ChainApi } from "./ChainApi";

const dummyRPC = 'https://eth.llamarpc.com'

jest.setTimeout(10000);
test("RPC nodes from multiple chains support archive queries", async () => {
  for (const chain of ["ethereum", "fantom", "rsk", "avax"]) {
    try {
      const ethOwned = await getBalance({
        target: "0x0000000000000000000000000000000000000000",
        block: 100,
        chain: chain as any,
      });
      expect(ethOwned.output).toBe("0");
    } catch (e) {
      throw e;
    }
  }
});

test("getProvider default behavior", async () => {
  const ethProvider = getProvider("ethereum")
  const ethProvider2 = getProvider("ethereum")

  expect(ethProvider).toEqual(ethProvider2);
});

test.skip("getProvider - use rpc from env", async () => {
  const ethProvider = getProvider("ethereum")
  process.env.ETHEREUM_RPC = dummyRPC
  const ethProvider2 = getProvider("ethereum")
  const ethProvider3 = getProvider("ethereum")

  expect(ethProvider).not.toBe(ethProvider2)
  expect(ethProvider2).toBe(ethProvider3)
  expect((ethProvider3 as any).providerConfigs[0].provider.connection.url).toBe(dummyRPC)
});

test("getProvider - invalid chain", async () => {
  const llamaP = getProvider("llama-chain")
  expect(llamaP).toBeNull()
});

test("getProvider - chain throws error", async () => {
  process.env.SOLANA_RPC = 'https://api.mainnet-beta.solana.com'
  const solP = getProvider("solana")
});

test("getProvider - custom chain", async () => {
  const clvRPC = "https://api-para.clover.finance"
  const clvObject = new ethers.JsonRpcProvider(clvRPC, { name: "clv-llama-test", chainId: 1024, })
  setProvider("clv-llama-test", clvObject)
  const clvP = getProvider("clv-llama-test")
  const clvPMissing = getProvider("clv-llama-test-not")
  expect(clvP).not.toBeNull()
  expect(clvPMissing).toBeNull()
  expect(getProviderUrl(clvP as any)).toBe(clvRPC)
});

// skipped as this would keep the connection/procss live after tests are done
test.skip("wss provider", async () => {
  process.env.WSSTEST_RPC = 'wss://moonbeam-rpc.dwellir.com'
  const wssapi = new ChainApi({ chain: "wsstest" })
  const usdcDecimals = await wssapi.call({ abi: 'erc20:decimals', target: '0x931715FEE2d06333043d11F658C8CE934aC61D0c' })
  const usdcDecimals1 = await wssapi.call({ abi: 'erc20:decimals', target: '0x931715FEE2d06333043d11F658C8CE934aC61D0c' })
  const usdcDecimals2 = await wssapi.call({ abi: 'erc20:decimals', target: '0x931715FEE2d06333043d11F658C8CE934aC61D0c' })
  const usdcDecimals3 = await wssapi.call({ abi: 'erc20:decimals', target: '0x931715FEE2d06333043d11F658C8CE934aC61D0c' })
  expect(usdcDecimals).toBe('6')
  expect(usdcDecimals1).toBe('6')
  expect(usdcDecimals2).toBe('6')
  expect(usdcDecimals3).toBe('6')
});