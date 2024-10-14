import * as nearAPI from "near-api-js";
import {
  JsonRpcProvider,
  FailoverRpcProvider,
} from "near-api-js/lib/providers";
import {NearContractOptions} from "@ringdao/xapi-common";

export class NearW {
  public async init(): Promise<NearI> {
    const { keyStores, KeyPair } = nearAPI;
    const myKeyStore = new keyStores.InMemoryKeyStore();
    const PRIVATE_KEY =
      "secp256k1:by8kdJoJHu7uUkKfoaLd2J2Dp1q1TigeWMG123pHdu9UREqPcshCM223kWadm";
    const keyPair = KeyPair.fromString(PRIVATE_KEY);
    await myKeyStore.setKey("default", "example-account.mainnet", keyPair);

    const jsonProviders = [
      new JsonRpcProvider({
        url: "https://rpc.mainnet.near.org",
      }),
      new JsonRpcProvider({
        url: "https://rpc.mainnet.pagoda.co",
      }),
      new JsonRpcProvider({
        url: "https://near.lava.build",
      }),
    ];
    const provider = new FailoverRpcProvider(jsonProviders);

    const connectionConfig = {
      networkId: "mainnet",
      provider: provider,
      keyStore: myKeyStore,
      nodeUrl: "https://rpc.mainnet.near.org",
      walletUrl: "https://wallet.mainnet.near.org",
      helperUrl: "https://helper.mainnet.near.org",
      explorerUrl: "https://nearblocks.io",
    };

    const nearConnection = await nearAPI.connect(connectionConfig);
    return new NearI(nearConnection);
  }
}

export class NearI {
  private walletConnection: nearAPI.WalletConnection | undefined;
  private contractMap: Record<string, nearAPI.Contract> = {};

  constructor(private readonly _near: nearAPI.Near) {}

  get near(): nearAPI.Near {
    return this._near;
  }

  get wallet(): nearAPI.WalletConnection {
    if (this.walletConnection) return this.walletConnection;
    this.walletConnection = new nearAPI.WalletConnection(this._near, "xapi");
    return this.walletConnection;
  }

  public contract(options: NearContractOptions): nearAPI.Contract {
    const cachedContract = this.contractMap[options.contractId];
    if (cachedContract) {
      return cachedContract;
    }
    const c = new nearAPI.Contract(
      this.wallet.account(),
      options.contractId,
      options.options,
    );
    this.contractMap[options.contractId] = c;
    return c;
  }
}
