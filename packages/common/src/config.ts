
export interface XAPIConfigType {
  graphql: {
    endpoint: (chain: string) => string,
  }
};

const graphqlEndpoint: Record<string, string> = {
  _fallback: "https://thegraph.darwinia.network/common",
  'darwinia-dvm': "https://thegraph.darwinia.network/dip7/subgraphs/name/darwinia",
  'crab-dvm': "https://thegraph.darwinia.network/dip7/subgraphs/name/crab",
};

export const XAPIConfig: XAPIConfigType = {
  graphql: {
    endpoint(chain: string): string {
      return graphqlEndpoint[chain] ?? graphqlEndpoint._fallback;
    }
  }
};

