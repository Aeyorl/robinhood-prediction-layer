# Incident response

Severity 1 covers suspected key compromise, fund loss, invalid settlement, malicious router target, or widespread inability to claim/refund. Severity 2 covers material RPC, API, database, indexer or quote degradation. The on-call operator records the UTC timeline and affected chain, contracts, markets, blocks, transactions and services.

For a contract incident, stop new entry through the timelock/Safe only when the delay and threat permit it; pause never blocks claims or refunds. Remove a swap target through governance, disable the router address in the API/UI, preserve RPC and database evidence, and never upgrade or redeploy silently. For an offchain incident, fail quotes closed, switch only to a pre-approved RPC, preserve logs, and reconcile indexed state from the last finalized block.

Recovery requires a written root cause, deterministic replay or fork reproduction, corrected configuration/code, full release checks, Safe approval where applicable, user communication approved by operations/legal, and post-incident actions with owners and dates. Never expose private keys, API keys, wallet identities or unnecessary personal data in tickets or public updates.
