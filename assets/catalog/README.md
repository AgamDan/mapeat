# Built-in restaurant catalog

`israel.json` lists restaurants, cafés, fast food, bars, pubs, and ice cream places in Israel and Palestine. The app loads it into its on-phone database on first launch (and again whenever this file's `version` changes), so the map has places even when the public Overpass servers are busy.

- **Source:** [Geofabrik](https://download.geofabrik.de/asia/israel-and-palestine.html) daily OpenStreetMap extract.
- **License:** © OpenStreetMap contributors, [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/). The app must keep showing the attribution.
- **Rebuild** (free, no account; downloads ~120 MB into the gitignored `.cache/`):

  ```powershell
  npm run catalog:build              # reuses an extract downloaded within the last day
  npm run catalog:build -- --refresh # forces a fresh download
  ```

- **Format:** `{ version, fields, places }`. Each place is an array ordered like `fields`; `version` is the extract's date. Do not edit by hand.
- **Areas (`israel-areas.json`, same build):** `{ version, cityFields, cities, neighborhoodFields, neighborhoods }` for explorer progress. Cities are `place=city|town` nodes; neighborhoods are `place=suburb|quarter|neighbourhood` nodes, each tied (by row index) to the nearest city inside its municipality boundary (`admin_level=8`). Names are `name`, `name:he`, `name:en`; coordinates are rounded to 5 decimals.
