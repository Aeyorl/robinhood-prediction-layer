import Link from "next/link";

const guides = [
  {
    id: "start",
    number: "01",
    title: "Connect and start",
    body: "Connect an EVM wallet, switch to the supported Robinhood Chain network, then open a market. You can inspect every market without connecting.",
  },
  {
    id: "capital-share",
    number: "02",
    title: "Read capital share",
    body: "YES and NO percentages show the share of deposited capital on each side. They describe current positioning; they are not a guaranteed probability, forecast, or return.",
  },
  {
    id: "funding",
    number: "03",
    title: "Fund a position",
    body: "Choose YES or NO, select a supported funding token, enter an amount, then review the estimated USDG collateral, route, slippage, fees and projected payout before approving anything.",
  },
  {
    id: "transactions",
    number: "04",
    title: "Follow the transaction",
    body: "A routed entry may require a token approval, swap confirmation and market entry. Keep the page open while each step confirms, and do not retry a pending transaction unless your wallet shows it failed.",
  },
  {
    id: "resolution",
    number: "05",
    title: "Resolution and settlement",
    body: "Each market states its asset, comparator, strike, close time, resolution time and oracle feed. Entry closes before resolution. The contract settles from the configured oracle method after its safety checks pass.",
  },
  {
    id: "portfolio",
    number: "06",
    title: "Track and claim",
    body: "Portfolio shows open positions, claimable outcomes and completed activity for the connected wallet. Once a market resolves, the winning side can claim according to the contract’s settlement rules.",
  },
];

export default function DocsPage() {
  return (
    <div className="docs-page">
      <header className="docs-hero">
        <p className="section-kicker">Prediction Layer user guide</p>
        <h1 className="block-heading">
          Know every
          <br />
          move<span className="text-violet-400">.</span>
        </h1>
        <p>
          From wallet connection to settlement, this guide explains what the interface shows and
          what you approve.
        </p>
      </header>

      <nav className="docs-index" aria-label="Guide sections">
        {guides.map((guide) => (
          <a key={guide.id} href={`#${guide.id}`}>
            <span>{guide.number}</span>
            {guide.title}
          </a>
        ))}
        <a href="#risk">
          <span>07</span>Risk checklist
        </a>
      </nav>

      <div className="docs-grid">
        {guides.map((guide) => (
          <section key={guide.id} id={guide.id} className="docs-card">
            <span>{guide.number}</span>
            <h2>{guide.title}</h2>
            <p>{guide.body}</p>
            {guide.id === "funding" ? (
              <ol>
                <li>Select a side and funding token.</li>
                <li>Review the quote and minimum received.</li>
                <li>Approve only the displayed amount.</li>
                <li>Confirm the market entry.</li>
              </ol>
            ) : null}
          </section>
        ))}
        <section id="risk" className="docs-card docs-risk">
          <span>07</span>
          <h2>Risk checklist</h2>
          <ul>
            <li>Capital can be lost if your selected outcome does not win.</li>
            <li>Quotes can change before confirmation.</li>
            <li>Check the market terms, timestamps and oracle source.</li>
            <li>Verify the network and contract shown in your wallet.</li>
            <li>Never treat capital share as guaranteed probability.</li>
          </ul>
          <Link href="/risks">Read the full risk notice →</Link>
        </section>
      </div>

      <section className="docs-support">
        <div>
          <p className="section-kicker">Still checking?</p>
          <h2 className="block-section-title">Inspect before you sign.</h2>
        </div>
        <p>
          Every action remains visible in your wallet. Prediction Layer cannot approve or sign a
          transaction for you.
        </p>
        <Link href="/markets" className="lime-action">
          Explore markets →
        </Link>
      </section>
    </div>
  );
}
