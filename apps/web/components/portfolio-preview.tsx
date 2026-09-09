import Link from "next/link";

const rows = [
  ["NVDA above $200", "▲ YES", "OPEN", "100.00", "63%", "Sep 30"],
  ["PONS above $100M", "○ NO", "OPEN", "250.00", "37%", "Oct 15"],
  ["AAPL AI hardware", "▲ YES", "PREVIEW", "370.00", "54%", "Oct 15"],
] as const;

export function PortfolioPreview() {
  return (
    <div className="portfolio-ledger demo-surface">
      <div className="demo-banner">Demonstration portfolio · no wallet data or live positions</div>
      <div className="portfolio-summary">
        <div className="portfolio-wallet-state">
          <small>Wallet</small>
          <strong>Not connected</strong>
          <span>Read-only product preview</span>
        </div>
        <dl>
          <div>
            <dt>Sample position value</dt>
            <dd>1,842.50</dd>
          </div>
          <div>
            <dt>Sample capital at risk</dt>
            <dd>720.00</dd>
          </div>
          <div>
            <dt>Sample claimable</dt>
            <dd>210.25</dd>
          </div>
          <div>
            <dt>Sample realized PnL</dt>
            <dd className="no-copy">+184.30</dd>
          </div>
        </dl>
      </div>
      <section className="portfolio-exposure" aria-label="Demonstration exposure">
        <div>
          <small>YES positions</small>
          <strong className="yes-copy">68%</strong>
          <span>1,252.50 USDG</span>
        </div>
        <div className="portfolio-exposure-track">
          <span style={{ width: "68%" }} />
        </div>
        <div>
          <small>NO positions</small>
          <strong className="no-copy">32%</strong>
          <span>590.00 USDG</span>
        </div>
      </section>
      <div className="portfolio-tabs">
        <button className="active">Sample positions</button>
        <button>Claimable</button>
        <button>History</button>
        <span>Trading not open</span>
      </div>
      <div className="portfolio-position-list">
        {rows.map(([market, side, status, stake, share, close]) => (
          <div className="portfolio-position-row" key={market}>
            <div className="position-market-cell">
              <span className={`position-side-mark ${side.includes("NO") ? "no" : "yes"}`}>
                {side}
              </span>
              <div>
                <Link href="/markets">{market}</Link>
                <small>Sample market</small>
              </div>
            </div>
            <div className="position-data-cell">
              <small>Position</small>
              <strong>{side}</strong>
              <span>{status}</span>
            </div>
            <div className="position-data-cell">
              <small>Stake</small>
              <strong>{stake}</strong>
              <span>USDG</span>
            </div>
            <div className="position-data-cell">
              <small>Capital share</small>
              <strong>{share}</strong>
              <span>illustrative</span>
            </div>
            <div className="position-action-cell">
              <span>Closes {close}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
