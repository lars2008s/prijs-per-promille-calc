const ITEMS = [
  "Alcohol schaadt de gezondheid",
  "Drink met mate",
  "Wie drinkt, rijdt niet",
  "Geen alcohol onder 18",
  "Wissel af met water",
];

function Group() {
  return (
    <div className="ticker-group">
      {ITEMS.map((t) => (
        <span key={t} className="ticker-item">
          {t}
          <span className="ticker-dot">✦</span>
        </span>
      ))}
    </div>
  );
}

/** Always-visible health warning. */
export function DisclaimerTicker() {
  return (
    <div className="ticker" role="note" aria-label="Alcohol schaadt de gezondheid. Drink met mate. Wie drinkt, rijdt niet.">
      <div className="ticker-track" aria-hidden="true">
        <Group />
        <Group />
      </div>
      <div className="ticker-static" aria-hidden="true">
        Alcohol schaadt de gezondheid · Drink met mate
      </div>
    </div>
  );
}
