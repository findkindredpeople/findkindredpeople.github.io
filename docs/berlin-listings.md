# Maintaining the Berlin collection

The first 15 programme cards were checked against linked official Berlin library pages on 20 September 2026. The collection is deliberately limited to four areas and is not a live booking feed. Kindred first-visit suggestions are editorial advice, not participant reviews.

## Review on 11 October 2026

All 13 linked official pages were read again. Published dates, session times, joining requirements and stated costs still support the current records. Historical September dates are retained as archive data; the English and German current lists now hide past one-off events before JavaScript runs. Four explicit sessions fall in 11–17 October: English book club (12 October), singing and crochet (13 October), and board-game swap (17 October). The three SprachRaum locations still publish weekly rhythms rather than individual session dates.

The daily `refresh-berlin-pages.yml` workflow rebuilds the date windows from existing published dates and requests the existing GitHub Pages build after a bot commit. It never changes `checkedOn` or approves new source facts. The separate weekly source monitor remains read-only. `KINDRED_BUILD_AT` provides a deterministic clock for snapshot regression checks.

Edit `berlin-activities-data.mjs`, then run `node scripts/build-berlin-page.mjs` to regenerate the static, indexable page. Keep both data and generated HTML in the same commit. Run `node --test tests/*.test.mjs` after changing dates, filters or calendar logic.

Before advancing `checkedOn`, read every listed source again. Copy only explicit future session dates into `dates`; never infer a date from “every Tuesday”. If an overview and detail page disagree, exclude the date until resolved. The Klima GameNight listing was excluded because the overview and detail page showed conflicting dates/years.

Use `null` when the fee is not stated. `fee: 0` means the source explicitly says free entry. Set `materialsUnknown: true` when required personal supplies have unlisted costs, so the comparison does not treat the full visit as free. Unknown language must remain `unknown`; the source website's language does not prove the session language. Check registration conditions and adult eligibility.

Published calendar downloads use Europe/Berlin, convert to UTC and mark the visit tentative. They are not registrations. Past one-off dates are hidden in the interactive list. Recurring formats remain visible with “ask for the next date” once listed dates have passed. A notice appears once the last source check is more than 30 days old. The weekly source monitor compares article fingerprints and reports possible changes. It never advances checkedOn or publishes dates automatically. An editor must read and validate changed source facts.

The September source list includes three SprachRaum locations on one shared source, five Pablo Neruda recurring formats without a future explicitly dated session, and the sources linked in each card. Recheck every registration link on the organiser's page before recommending attendance. Do not reproduce therapeutic claims from the singing page.

Visitor feedback is an email draft only. No review is fabricated or automatically published. Obtain and retain the contributor's optional permission before publishing an anonymised tip; remove names and private information about other people. Corrections can be handled privately without publication permission.

The planner and shortlist use `kindred-public-plan-v1` and `kindred-berlin-shortlist-v1`, only after an explicit save. The separate 30-day pilot uses `kindred-berlin-pilot-v1` only after its own opt-in. Pilot counters stay in this browser and are never sent automatically; they are not site-wide analytics. Each deletion removes only the relevant tool’s key. See `docs/berlin-pilot.md` for the five-person study and consent workflow.

Weekday filters use `recurringWeekdays` for recurring schedules without dated sessions. Leave the weekday unknown if the source does not specify one. A weekday must never create a session date. When changing catalogue data, update the versioned data imports in the collection, first-visit helper and pilot module together, regenerate HTML, and bump the HTML asset versions and service-worker cache when needed.


## German tools and source monitoring

Run `node scripts/build-german-tools.mjs`, `node scripts/build-berlin-discovery.mjs` and `node scripts/build-german-practice.mjs` after updating German copy. The German planner uses `kindred-public-plan-de-v1`; the English planner keeps its original key. The shortlist key is shared, containing only public activity IDs. Shared URLs and locally generated QR codes include only these IDs. The QR generator is vendored with its MIT license; it makes no network requests.

The dedicated German-practice guide was checked against the shared official SprachRaum source on 4 October 2026. It describes published rhythms and does not invent dated sessions.

The `Check Berlin source changes` workflow runs every Monday and can be run manually. The first successful run records a fingerprint baseline; later runs compare against the most recent restored cache. Caches can expire: a missing baseline is explicitly reported, never treated as unchanged. The JSON report is retained as an Actions artifact for 30 days. Requests are spaced two seconds apart. HTTP 429 and temporary server errors (500, 502, 503, 504) get up to three attempts with increasing delays, respecting `Retry-After` seconds or HTTP dates. A requested wait above 60 seconds or beyond the eight-minute check budget is left for a later run and reported as unavailable. Exhausted retries and other HTTP failures still fail the check and require review; errors appear in the log, summary and JSON report, and the last good observation is preserved. Changed article text or new full-date tokens are only review prompts; tokens can concern other events. No automatic commits, attendee messages or publication occur.

After editorial review: update the shared data, bump data/module asset versions as needed, run `node scripts/build-source-list.mjs`, regenerate both English and German pages, run Node and Python tests, and publish the data and generated pages together. Do not advance the global source-check date unless every active source was read. Search Console query prioritisation needs current authenticated account data; it is not supplied by this monitor.
