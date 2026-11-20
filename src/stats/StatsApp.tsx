import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { DayStats, Stats } from "../../shared/analytics-core.ts";
import { LogoMark } from "../components/Icon.tsx";
import { isOptedOut, setOptOut } from "../lib/analytics.ts";
import { ColumnChart, type Column } from "./ColumnChart.tsx";

const TOKEN_KEY = "ppp:stats-token";
const RANGES = [7, 30, 90] as const;
const nf = new Intl.NumberFormat("nl-BE");
const COUNTRY = new Intl.DisplayNames(["nl-BE"], { type: "region" });

function readToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? "";
  } catch {
    return "";
  }
}

function saveToken(t: string) {
  try {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

const dayDate = (day: string) => new Date(`${day}T12:00:00Z`);
const shortDay = (day: string) =>
  dayDate(day).toLocaleDateString("nl-BE", { day: "numeric", month: "short", timeZone: "UTC" });
const longDay = (day: string) =>
  dayDate(day).toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

function countryName(code: string) {
  if (code === "--") return "Onbekend";
  try {
    return COUNTRY.of(code) ?? code;
  } catch {
    return code;
  }
}

export function StatsApp() {
  const [token, setToken] = useState(readToken);
  const [range, setRange] = useState<(typeof RANGES)[number]>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [optOut, setOptOutState] = useState(isOptedOut);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/stats?days=${range}`, { headers: { authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (res.status === 401) {
        saveToken("");
        setToken("");
        setError("Verkeerd wachtwoord.");
        return;
      }
      if (!res.ok) throw new Error(data.error ?? "Kon de statistieken niet laden.");
      setStats(data as Stats);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kon de statistieken niet laden.");
    } finally {
      setLoading(false);
    }
  }, [token, range]);

  useEffect(() => {
    void load();
    const t = window.setInterval(() => document.visibilityState === "visible" && void load(), 60_000);
    return () => window.clearInterval(t);
  }, [load]);

  if (!token) {
    return (
      <Login
        error={error}
        onSubmit={(t) => {
          saveToken(t);
          setToken(t);
          setError(null);
        }}
      />
    );
  }

  const today = stats?.days[stats.days.length - 1];
  const columns = (pick: (d: DayStats) => number): Column[] =>
    (stats?.days ?? []).map((d) => ({
      key: d.day,
      label: shortDay(d.day),
      value: pick(d),
      tooltip: (
        <>
          <strong>{longDay(d.day)}</strong>
          <span>
            <b>{nf.format(d.visitors)}</b> bezoekers
          </span>
          <span>
            <b>{nf.format(d.pageviews)}</b> paginaweergaven
          </span>
          <span>
            <b>{nf.format(d.scans)}</b> scans door {nf.format(d.scanners)} {d.scanners === 1 ? "persoon" : "personen"}
          </span>
        </>
      ),
    }));

  return (
    <div className="stats">
      <header className="stats-head">
        <a href="/" className="brand" aria-label="Naar de app">
          <LogoMark size={34} />
          <span className="brand-text">
            PPP<small>Statistieken</small>
          </span>
        </a>
        <div className="seg" role="tablist" aria-label="Periode">
          {RANGES.map((r) => (
            <button key={r} role="tab" aria-selected={range === r} className={range === r ? "on" : ""} onClick={() => setRange(r)}>
              {r} dagen
            </button>
          ))}
        </div>
      </header>

      {error && <p className="stats-error">{error}</p>}

      {!stats ? (
        <p className="stats-loading">{loading ? "Laden…" : ""}</p>
      ) : (
        <>
          <section className="hero-stat">
            <span className="hero-label">Bezoekers, laatste {stats.range} dagen</span>
            <span className="hero-value">{nf.format(stats.totals.visitors)}</span>
            <span className="hero-sub">
              Vandaag {nf.format(today?.visitors ?? 0)} · {nf.format(stats.totals.pageviews)} paginaweergaven
            </span>
          </section>

          <section className="tiles">
            <Tile label="Bezoekers vandaag" value={today?.visitors ?? 0} />
            <Tile label="Paginaweergaven" value={stats.totals.pageviews} />
            <Tile label="Foto's gescand" value={stats.totals.scans} />
            <Tile label="Mensen die scanden" value={stats.totals.scanners} />
          </section>

          <section className="panel">
            <h2>Bezoekers per dag</h2>
            <ColumnChart data={columns((d) => d.visitors)} label={`Bezoekers per dag, laatste ${stats.range} dagen`} />
          </section>

          <section className="panel">
            <h2>Gescande foto's per dag</h2>
            <ColumnChart
              data={columns((d) => d.scans)}
              height={160}
              label={`Gescande foto's per dag, laatste ${stats.range} dagen`}
            />
          </section>

          <div className="breakdowns">
            <Breakdown title="Waar komen ze vandaan" rows={stats.referrers} />
            <Breakdown title="Landen" rows={stats.countries.map(([c, n]) => [countryName(c), n])} />
            <Breakdown title="Toestellen" rows={stats.devices.map(([d, n]) => [d[0].toUpperCase() + d.slice(1), n])} />
          </div>

          <details className="panel table-view">
            <summary>Toon als tabel</summary>
            <table>
              <thead>
                <tr>
                  <th>Dag</th>
                  <th>Bezoekers</th>
                  <th>Weergaven</th>
                  <th>Scans</th>
                </tr>
              </thead>
              <tbody>
                {[...stats.days].reverse().map((d) => (
                  <tr key={d.day}>
                    <td>{shortDay(d.day)}</td>
                    <td>{nf.format(d.visitors)}</td>
                    <td>{nf.format(d.pageviews)}</td>
                    <td>{nf.format(d.scans)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>

          <footer className="stats-foot">
            <label className="toggle">
              <input
                type="checkbox"
                checked={optOut}
                onChange={(e) => {
                  setOptOut(e.target.checked);
                  setOptOutState(e.target.checked);
                }}
              />
              Tel mijn eigen bezoeken op dit toestel niet mee
            </label>
            <p>
              Zonder cookies geteld: een bezoeker is per dag uniek, dus wie op 2 dagen komt telt 2 keer mee. Bots en
              testbrowsers worden niet geteld. Bijgewerkt {new Date(stats.generatedAt).toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" })}.
            </p>
            <button
              className="btn btn-ghost"
              onClick={() => {
                saveToken("");
                setToken("");
                setStats(null);
              }}
            >
              Uitloggen
            </button>
          </footer>
        </>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="tile-stat">
      <span className="tile-label">{label}</span>
      <span className="tile-value">{nf.format(value)}</span>
    </div>
  );
}

function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <section className="panel">
      <h2>{title}</h2>
      {rows.length === 0 ? (
        <p className="muted">Nog geen gegevens.</p>
      ) : (
        <ul className="hbars">
          {rows.map(([name, n]) => (
            <li key={name} title={`${name}: ${nf.format(n)}`}>
              <span className="hbar-name">{name}</span>
              <span className="hbar-track">
                <span className="hbar-fill" style={{ width: `${(n / max) * 100}%` }} />
              </span>
              <span className="hbar-value">{nf.format(n)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Login({ error, onSubmit }: { error: string | null; onSubmit: (token: string) => void }) {
  const [value, setValue] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (value.trim()) onSubmit(value.trim());
  };
  return (
    <form className="login" onSubmit={submit}>
      <LogoMark size={72} />
      <h1>PPP Statistieken</h1>
      <label htmlFor="pw">Wachtwoord</label>
      <input id="pw" type="password" autoComplete="current-password" value={value} onChange={(e) => setValue(e.target.value)} autoFocus />
      {error && <p className="stats-error">{error}</p>}
      <button className="btn btn-primary btn-lg" type="submit">
        Bekijk statistieken
      </button>
    </form>
  );
}
