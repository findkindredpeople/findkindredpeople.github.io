# Maintaining the Berlin collection

The first 15 programme cards were checked against linked official Berlin library pages on 20 September 2026. The collection is deliberately limited to four areas and is not a live booking feed. Kindred first-visit suggestions are editorial advice, not participant reviews.

Edit `berlin-activities-data.mjs`, then run `node scripts/build-berlin-page.mjs` to regenerate the static, indexable page. Keep both data and generated HTML in the same commit. Run `node --test tests/*.test.mjs` after changing dates, filters or calendar logic.

Before advancing `checkedOn`, read every listed source again. Copy only explicit future session dates into `dates`; never infer a date from “every Tuesday”. If an overview and detail page disagree, exclude the date until resolved. The Klima GameNight listing was excluded because the overview and detail page showed conflicting dates/years.

Use `null` when the fee is not stated. `fee: 0` means the source explicitly says free entry. Set `materialsUnknown: true` when required personal supplies have unlisted costs, so the comparison does not treat the full visit as free. Unknown language must remain `unknown`; the source website's language does not prove the session language. Check registration conditions and adult eligibility.

Published calendar downloads use Europe/Berlin, convert to UTC and mark the visit tentative. They are not registrations. Past one-off dates are hidden in the interactive list. Recurring formats remain visible with “ask for the next date” once listed dates have passed. A notice appears once the last source check is more than 30 days old. No background service rechecks sources automatically.

The September source list includes three SprachRaum locations on one shared source, five Pablo Neruda recurring formats without a future explicitly dated session, and the sources linked in each card. Recheck every registration link on the organiser's page before recommending attendance. Do not reproduce therapeutic claims from the singing page.

Visitor feedback is an email draft only. No review is fabricated or automatically published. Obtain and retain the contributor's optional permission before publishing an anonymised tip; remove names and private information about other people. Corrections can be handled privately without publication permission.

The planner and shortlist use `kindred-public-plan-v1` and `kindred-berlin-shortlist-v1`, only after an explicit save. The separate 30-day pilot uses `kindred-berlin-pilot-v1` only after its own opt-in. Pilot counters stay in this browser and are never sent automatically; they are not site-wide analytics. Each deletion removes only the relevant tool’s key. See `docs/berlin-pilot.md` for the five-person study and consent workflow.

Weekday filters use `recurringWeekdays` for recurring schedules without dated sessions. Leave the weekday unknown if the source does not specify one. A weekday must never create a session date. When changing catalogue data, update the versioned data imports in the collection, first-visit helper and pilot module together, regenerate HTML, and bump the HTML asset versions and service-worker cache when needed.
