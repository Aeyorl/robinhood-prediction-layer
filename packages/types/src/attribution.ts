/** A signature authorizes only this immutable correlation; replay is idempotent. */
export function attributionMessage(
  chainId: number,
  input: {
    wallet: string;
    quoteId: string;
    enterTxHash: string;
    swapTxHash: string;
    fundingToken: string;
    fundingAmount: string;
  },
) {
  return [
    "Prediction Layer funding attribution v1",
    `Chain: ${chainId}`,
    `Wallet: ${input.wallet.toLowerCase()}`,
    `Quote: ${input.quoteId}`,
    `Entry: ${input.enterTxHash.toLowerCase()}`,
    `Swap: ${input.swapTxHash.toLowerCase()}`,
    `Token: ${input.fundingToken.toLowerCase()}`,
    `Amount: ${input.fundingAmount}`,
  ].join("\n");
}
