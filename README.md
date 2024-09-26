# Near indexer for XAPI

## Creating a Subgraph

1. From an example subgraph
<https://github.com/graphprotocol/graph-tooling/tree/main/examples/near-receipts>

```bash
# init
graph init --studio xapi-near --from-example near-receipts
# auth
graph auth --studio
# deploy
graph codegen && graph build
graph deploy --studio xapi-near
```
