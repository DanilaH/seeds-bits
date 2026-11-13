# Commercial research — applying it to Семечки

Adopted for research/decision work on 13 November 2026. This supplement routes tasks that the stable kit router does not yet include. It does not approve or implement a new monetization mechanic.

## Sources and status

Research snapshot: `6bff183070f6feecad3f561d268145a8500fbb1b`, from [draft PR #30](https://github.com/DanilaH/mini-games-kit/pull/30) in `DanilaH/mini-games-kit`. Still draft/open at adoption; separate from stable guidance `1f286e6e98cafee6679a1a0a13519c7bcded97a5` and the vendored runtime pin. Recheck status before a later update, and review changes deliberately.

Choose at most two relevant studies alongside the [stable router](kit-guidance/TASK_ROUTER.md). Do not read the whole source atlas for a small fix.

| Task | Pinned material | Expected result |
| --- | --- | --- |
| Existing rewarded path, offer/help usefulness | [Commercial teardowns](https://github.com/DanilaH/mini-games-kit/blob/6bff183070f6feecad3f561d268145a8500fbb1b/docs/game-economics/COMMERCIAL_TEARDOWNS_2026-11-13.md) and [evidence audit](https://github.com/DanilaH/mini-games-kit/blob/6bff183070f6feecad3f561d268145a8500fbb1b/docs/game-economics/COMMERCIAL_TEARDOWNS_AUDIT_2026-11-13.md) | One actual path, observed issue, bounded hypothesis |
| A concrete commercial experiment | [Experiment brief](https://github.com/DanilaH/mini-games-kit/blob/6bff183070f6feecad3f561d268145a8500fbb1b/docs/game-economics/MONETIZATION_EXPERIMENT_BRIEF_TEMPLATE.md) | Defined assignment, observation window, revenue source and decision rule |
| Finding/verifying a competitor source | [Source atlas](https://github.com/DanilaH/mini-games-kit/blob/6bff183070f6feecad3f561d268145a8500fbb1b/docs/game-economics/COMMERCIAL_SOURCE_ATLAS_2026-11-13.md) | One accessible primary artifact and explicit evidence limits |

The project has reviewed the experiment brief, relevant teardown/audit methodology and the atlas's portfolio application/queue. That does not mean every underlying paper, video, APK or commercial claim has been independently inspected. Read the specific cited source before relying on it.

## Start with the current game

Establish branch/build, existing offer wording, hint behavior, saved reward authority and ad placements first. Trace **state before offer → consent → ad ready/show → eligible reward → saved useful help → next accepted gameplay action**. Record refusal, no-fill, early close, duplicate callback, process interruption and save failure separately.

Rewarded hints are a relevant existing path to investigate; no specific hint redesign or live experiment is approved here. Do not add lives, forced losses, shops or personalized difficulty simply because another game uses them. A future owner task may deliberately change mechanics; record that scope before implementing it.

For an experiment, vary one factor first: the offer, explanation/usefulness of help, or ad adjacency. Keep generator/difficulty and other policy fixed unless the experiment specifically targets them. Use the brief for an actual proposed test, not an empty document for every bugfix.

## Measurement contracts

- Assign units randomly before exposure; retain their assigned variant across normal restarts. Define eligibility, exclusions and full observation horizon in advance.
- The primary revenue comparison includes **all initially assigned users**, including those who leave or never watch ads. Rewarded viewers versus non-viewers is not a randomized comparison.
- Link revenue to the same assignment unit and variant. App-wide income without this link supports funnel diagnosis, not variant revenue uplift.
- Distinguish request/load, impression, reward eligibility, saved help and publisher payout. An impression is not a saved hint, and a saved hint does not prove it helped.
- Yandex Mobile Ads Android ILRD describes an impression; it is not proof of a loaded ad's price before show. Do not transplant MAX callbacks or Yandex Games web assumptions.
- Inspect the existing manual native Ad Revenue path and actual AppMetrica settings before adding automatic reporting. Do not sum network and AppMetrica records of the same impression. Missing/invalid revenue remains unknown, with completeness checked by variant; never silently convert it to zero.
- Consider churn/return, displaced ads or purchases, acquisition/variable costs where applicable, and implementation/support cost. Higher eCPM alone is not proof of higher revenue per original user or profit.

Technical tests establish state transitions and data contracts. Live traffic and a valid experiment establish commercial outcomes. Competitor code, screenshots or company profit do not establish causal uplift from one mechanism.

**KIT IMPACT:** REUSE of documented methodology. No new runtime API, analytics system, ad policy or gameplay mechanic is introduced by this adoption.
