import { Button } from "@pl/ui";

/** The public preview never connects wallets or requests permissions. */
export function ConnectWallet() {
  return (
    <Button size="sm" className="wallet-connect-button" disabled title="Trading is not open yet">
      Trading not open
    </Button>
  );
}
