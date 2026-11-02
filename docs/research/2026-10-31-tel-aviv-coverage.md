# Tel Aviv restaurant/photo coverage check

Status: partial research, not an imported restaurant catalog or a completed live coverage audit.

## User constraints

First coverage-check area: Tel Aviv. The app must show existing restaurant profiles before the couple visits. Profile names/photos are separate from the couple's private visit reviews and uploads. No billing accounts, payment information, paid APIs, or possible metered charges. Google Places API is excluded under that rule, even for names/photos only.

## Verified photo examples

The following Wikimedia Commons file-description pages were inspected. These are historical images of named venues; they do not establish current operating status, current appearance, branch coordinates, or complete city coverage.

| Venue / photo | Date given by file page | Author | License stated on file page | What it establishes |
| --- | --- | --- | --- | --- |
| [Keton restaurant in Tel Aviv](https://commons.wikimedia.org/wiki/File:Keton_restaurant_in_Tel_Aviv.JPG) | 2015-09-25 | Avi1111 / Dr. Avishai Teicher | CC BY-SA 4.0 | A reusable named-restaurant photo with attribution and license conditions; file description identifies Dizengoff Street. |
| [Hummus at Abu Hassan](https://commons.wikimedia.org/wiki/File:Hummus_at_Abu_Hassan.jpg) | 2022-07-14 | Artem.G | CC BY-SA 4.0 | A reusable food photo identified with Abu Hassan; does not establish the specific branch or its location. |
| [La Mer Beach Restaurant](https://commons.wikimedia.org/wiki/File:Tel_Aviv-Yaffo_-_La_Mer_Beach_Restaurant.JPG) | 2011-07-25 | User:Mattes | Public-domain dedication on the file page | A historical named-restaurant image; its camera coordinates are not a verified restaurant entrance pin. |

Use the attribution and license links from each source. Retain the photo date and describe historical images honestly. No image has been copied into app assets, used to invent a place location, or matched to an unverified live restaurant record.

The [Commons Tel Aviv-Yafo restaurant category](https://commons.wikimedia.org/wiki/Category:Restaurants_in_Tel_Aviv-Yafo) contains further files and venue categories, including historical material. Category file counts are not counts of current restaurants, unique restaurants, usable matches, or photo-coverage percentages. They may also reflect cached snapshots.

## Restaurant dataset check

Candidate source: OpenStreetMap restaurant features retrieved through an appropriate public Overpass instance. Existing OSM IDs, names, and coordinates need a real response before constructing map records. Any linked `wikimedia_commons` / `wikidata` metadata can help image matching, but no name-only fuzzy match should silently select a different venue or branch.

A read-only count query was prepared for a bounding box around Tel Aviv/Jaffa:

```overpass
[out:json][timeout:20];
nwr["amenity"="restaurant"](32.02,34.74,32.15,34.85);
out count;
```

The rectangle is a research sample area, not a verified municipal boundary. It includes only the `restaurant` tag, not all cafés, fast-food businesses, bars, bakeries, or permanently closed venues. Counts from it must not be described as the total number of Tel Aviv dining venues.

Results: the main and alternative public Overpass URLs could not be fetched through the browsing tool. A direct terminal request also failed with `Unable to connect to the remote server`. A small direct OSM map request was inaccessible as well. Therefore:

- Live restaurant count: **not verified**.
- Number of restaurants with matched reusable photos: **not verified**.
- Photo-coverage percentage: **not verified**.
- A complete, current Tel Aviv catalog with photos for every restaurant: **not demonstrated**.

Third-party search results mentioned OSM-derived restaurant counts, but those were not used as first-party dataset measurements or imported as licensed records.

## Proposed next steps

1. Resolved: user approved a selectable restaurant profile with a neutral "No photo yet" placeholder when no reusable photo exists. Keep it separate from private visit photos.
2. Obtain one bounded live Overpass response from an environment that can reach the public endpoint; save source timestamp and scope. Stay within the selected instance's usage policy and identify the app as required. Do not parallelize repeated retries or bulk-fetch tiles.
3. Inspect a small venue sample, match venue/branch identities, and request image/license metadata only for valid source links.
4. Report observed names, coordinate completeness, image matches, missing images, stale/closed venue indicators, and Hebrew/English name availability, with explicit sample size.
5. Show the revised map/profile wireframe and agree on a genuinely no-billing renderer before implementation.

Current recommendation: continue evaluating a no-billing open-data catalog with the approved missing-photo handling, rather than promising Google-equivalent coverage. Final provider/renderer proposal still requires agreement. No paid service was configured or called.

## Source/service references

- [Overpass public instances and usage guidance](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [OpenStreetMap Commons image references](https://wiki.openstreetmap.org/wiki/Key:wikimedia_commons)
- [Wikimedia Commons reuse guidance](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia)
- [OpenStreetMap tile usage policy](https://operations.osmfoundation.org/policies/tiles/)
- [Google Places billing prerequisites](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
