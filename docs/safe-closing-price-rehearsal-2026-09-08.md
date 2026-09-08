# Safe closing-price resolver rehearsal

Date: 2026-09-08

Network: Robinhood Chain mainnet fork, chain ID 4663

Broadcast: none

`pnpm oracle:rehearse` created a local fork from `https://rpc.mainnet.chain.robinhood.com`, deployed the resolver only into fork state, configured NVDA, proposed an evidence-bound observation, waited through the 24-hour challenge period and resolved the exact reference timestamp.

Result: 1 passed, 0 failed. The rehearsal sent no mainnet transaction and used no user funds.

The full Foundry suite also passed with 106 tests, including fuzz and invariant suites. Repository type checking passed across all 17 tasks. Existing Foundry timestamp and safe-cast lint warnings remain visible; no new compile error or test failure was accepted.

This evidence verifies code execution on a current mainnet fork. It does not verify production signer control, deployed addresses, live monitoring destinations, legal approval or an independent audit.
