<img src="assets/icon.svg" width="64" height="64" alt="">

# Prijs per Promille (PPP)

Fotografeer de drankkaart (één of meerdere foto's) en zie meteen welke drank je de meeste alcohol voor je geld geeft. De ranking bouwt zich live op terwijl de AI de kaart leest, met stijgende en dalende posities.

Live: **https://ppp.larsschrijvers.be**

> Alcohol schaadt de gezondheid. Drink met mate. Wie drinkt, rijdt niet.

## Hoe het werkt

1. De browser verkleint elke foto tot max. 1600 px en stuurt ze (max. 3 tegelijk) naar `/api/scan`.
2. De Netlify Edge Function [`netlify/edge-functions/scan.ts`](netlify/edge-functions/scan.ts) roept de OpenAI Responses API aan met een strikt JSON-schema en streamt het antwoord door. De API-sleutel blijft op de server.
3. De client ([`src/lib/stream.ts`](src/lib/stream.ts)) haalt elke drank uit de stream zodra die compleet is, zodat de ranking live groeit.
4. Ranking op **prijs per promille**: wat het kost om je bloedalcohol met 1‰ te laten stijgen (formule van Widmark).
   - `gram alcohol = volume_ml × abv% ÷ 100 × 0,789`
   - `promille = gram alcohol ÷ (gewicht_kg × r)`, met r = 0,7 (man) of 0,6 (vrouw)
   - `prijs per promille = prijs ÷ promille`

   Gewicht en geslacht stel je in via "promille voor" (standaard man, 75 kg; enkel bewaard op het toestel). De volgorde van de ranking hangt daar niet van af, enkel de bedragen. Het is een geschatte piek zonder afbraak, nooit een rijtest.

Dezelfde drank op twee overlappende foto's (zelfde naam, volume en prijs) telt één keer. Alcoholvrije dranken worden door het model overgeslagen en daarna nog eens door de app gefilterd. Geschatte volumes/percentages krijgen een ≈ en zijn aan te passen door op een drank te tikken.

## Demo

"Bekijk eerst de demo" op de startpagina speelt een gescripte scan af ([`src/components/Demo.tsx`](src/components/Demo.tsx)): twee kaartfoto's, dranken die live binnenkomen en de kroon overnemen, een vinger die sorteert en filtert, een happy-hour-prijs en een ander profiel. Er gaat niets naar OpenAI en je eigen ranking blijft onaangeroerd. `node scripts/demo-shots.ts http://localhost:5173` maakt screenshots van de belangrijkste momenten.

## Bezoekersstatistieken

Eigen, cookieloze teller op Netlify Blobs: [`shared/analytics-core.ts`](shared/analytics-core.ts), functies in [`netlify/functions/`](netlify/functions).

- De app stuurt één `pageview` per bezoek en een `scan` per geslaagde foto naar `/api/hit`.
- Er wordt geen IP of cookie bewaard: een bezoeker is een hash van IP + browser + een geheim dat elke dag verandert, dus uniek per dag en niet over dagen heen te volgen.
- Bots, testbrowsers (`navigator.webdriver`) en toestellen met "tel mij niet mee" worden genegeerd.
- Dashboard: **https://ppp.larsschrijvers.be/stats** (wachtwoord = `STATS_TOKEN`).

## Ontwikkelen

```bash
npm install
cp .env.example .env      # vul OPENAI_API_KEY in
npm run dev               # Vite + lokale stand-in voor de edge function
npm test                  # unit tests (Vitest)
npm run typecheck
npm run e2e -- http://localhost:5173   # end-to-end in Chrome (playwright-core)
npm run bench -- gpt-5.4-mini none     # modelvergelijking op de testkaarten
```

Omgevingsvariabelen (Netlify → Site configuration → Environment variables):

| Variabele | Standaard | Doel |
| --- | --- | --- |
| `OPENAI_API_KEY` | — | Verplicht, enkel server-side |
| `OPENAI_MODEL` | `gpt-5.4-mini` | Vision-model voor het lezen van de kaart |
| `OPENAI_REASONING_EFFORT` | `none` | Sneller zonder redeneren; zelfde nauwkeurigheid op de testkaarten |
| `ALLOWED_HOSTS` | ppp.larsschrijvers.be, netlify.app, localhost | Origins die de scanner en teller mogen aanroepen |
| `ANALYTICS_SALT` | — | Geheim voor de dagelijkse bezoekers-hash |
| `STATS_TOKEN` | — | Wachtwoord voor `/stats` |

## Deploy

Netlify-site `prijs-per-promille` (team lars2008s), domein `ppp.larsschrijvers.be` via Netlify DNS.

```bash
netlify deploy --build --prod
```

## Later een mobiele app

De site is een installeerbare PWA (manifest + iconen). Voor een native app (bv. Capacitor) zet je `VITE_API_BASE=https://ppp.larsschrijvers.be` en voeg je de app-origin toe aan `ALLOWED_HOSTS`.
