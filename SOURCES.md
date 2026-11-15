# Sources and limits

Checked against the documents on 2026-11-15. Every value below was looked up in the document named
in its row. A row is only marked **verified** if the number or statement was found in that document.
Nothing here was filled in from memory. Formulas, thresholds and alert logic were not changed by
this check.

Status key:

- **verified**: the document was opened and the number or statement was found in it.
- **mismatch**: the document gives a different value (the document's value is shown).
- **unverified**: the value was not found, or the document could not be opened.
- **project estimate**: our own modelling choice, not taken from a source.

Paths: `3d/...` is the Vite app, `src/...` is the engine and data folder at the repository root.
Quotes are shorter than 15 words. Page numbers are PDF page numbers.

## Documents opened

| Short name | Document | URL |
| --- | --- | --- |
| HRP hazards | NASA HRP, "5 Hazards of Human Spaceflight" | https://www.nasa.gov/hrp/hazards |
| HRP distance | NASA HRP, "Hazard: Distance From Earth" | https://www.nasa.gov/hrp/hazard-distance-from-earth/ |
| HRP risks | NASA HRP, "Risks of Human Spaceflight" | https://www.nasa.gov/hrp/risks/ |
| HRP bone | NASA, "Risk of Spaceflight-Induced Bone Changes" (updated 2025-05-16) | https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/ |
| STD V1 C | NASA-STD-3001 Vol 1 Rev C, approved 2023-09-15 | https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf |
| STD V1 B | NASA-STD-3001 Vol 1 Rev B, approved 2022-01-05 | https://www.nasa.gov/wp-content/uploads/2020/10/2022-01-05_nasa-std-3001_vol.1_rev._b_final_draft_with_signature_010522.pdf |
| STD V2 F | NASA-STD-3001 Vol 2 Rev F, approved 2026-07-14 | https://www.nasa.gov/wp-content/uploads/2025/05/nasa-std-3001-vol-2.pdf |
| TB-020 | OCHMO-TB-020 Rev G, "Design for Ionizing Radiation Protection" (06/06/2025) | https://www.nasa.gov/sites/default/files/atoms/files/radiation_protection_technical_brief_ochmo.pdf |
| TB-004 | OCHMO-TB-004 Rev D, "Carbon Dioxide (CO2)" technical brief | https://www.nasa.gov/wp-content/uploads/2023/12/ochmo-tb-004-carbon-dioxide.pdf |
| LSAH 2023 | NASA Lifetime Surveillance of Astronaut Health newsletter, Oct 2023, Vol 28 Issue 2 | https://www.nasa.gov/wp-content/uploads/2023/10/lsah-newsletter-2023-vol28-issue2.pdf |
| Law 2016 | Law J, Alexander D. "CO2 on the International Space Station: An Operations Update". AsMA 2016 meeting abstract, JSC-CN-34542 (NTRS 20150019624) | https://ntrs.nasa.gov/citations/20150019624 |
| NSSDC Mars | NASA GSFC NSSDC, Mars Fact Sheet (updated 2025-05-19) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html |
| Rice 2011 | Rice AJ, Genc KO, Maender CC, Gopalakrishnan R, et al. "Inadequate Loading Stimulus on ISS Results in Bone and Muscle Loss". NTRS 20110015001 | https://ntrs.nasa.gov/citations/20110015001 |
| Barger 2014 | Barger LK et al. Lancet Neurol 2014;13(9):904-912. DOI 10.1016/S1474-4422(14)70122-X, PMID 25127232 | https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/ |
| Basner 2013 | Basner M et al. PNAS 2013, Mars-520 hypokinesis and sleep. DOI 10.1073/pnas.1212646110 | https://www.med.upenn.edu/uep/assets/user-content/documents/PNAS2013Basner1212646110withSupportingAppendix.pdf |
| Basner 2014 | Basner M et al. PLoS ONE 2014;9(3):e93298, Mars-520 psychological changes | https://doi.org/10.1371/journal.pone.0093298 |
| Basner 2011 | Basner M, Mollicone D, Dinges DF. PVT-B, Acta Astronaut 2011;69:949-959. DOI 10.1016/j.actaastro.2011.07.015, PMID 22025811 | https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786/ |
| LeBlanc 2000 | LeBlanc A et al. J Musculoskelet Neuronal Interact 2000;1(2):157-160. PMID 15758512 | https://pubmed.ncbi.nlm.nih.gov/15758512/ |
| Lang 2004 | Lang T et al. J Bone Miner Res 2004;19(6):1006-1012. DOI 10.1359/JBMR.040307, PMID 15125798 | https://pubmed.ncbi.nlm.nih.gov/15125798/ |
| Mader 2011 | Mader TH et al. Ophthalmology 2011;118(10):2058-2069. DOI 10.1016/j.ophtha.2011.06.021, PMID 21849212 | https://pubmed.ncbi.nlm.nih.gov/21849212/ |
| Zeitlin 2013 | Zeitlin C et al. Science 2013;340:1080-1084. DOI 10.1126/science.1235989 (abstract only) | https://elib.dlr.de/83619/ |
| SwRI 2013 | SwRI press release on Zeitlin 2013, 2013-05-30 | https://www.swri.org/newsroom/press-releases/swri-led-team-calculates-the-radiation-exposure-associated-trip-mars |
| Hassler 2014 | Hassler DM et al. Science 2014;343(6169). DOI 10.1126/science.1244797, PMID 24324275 (abstract only) | https://pubmed.ncbi.nlm.nih.gov/24324275/ |

## 1. Constants and thresholds

| Name | Value | Units | Used in | Source | Section / page | URL | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| CO2 critical limit `CO2_LIMITS_MMHG.critical` | 3 | mmHg ppCO2 | `3d/src/sim/constants.ts:60`, `src/engine/index.ts:97`, `3d/src/ui/co2.ts:17`, `3d/src/ui/ZoneCharts.tsx:34` | STD V2 F | [V2 6004] "Nominal Vehicle/Habitat Carbon Dioxide Levels", §6.2.1.3, p. 53: "limit the average one-hour CO2 partial pressure ... to no more than 3 mmHg" | STD V2 F | verified (1-hour average, see caveat C1) |
| CO2 critical limit, as cited to Law & Alexander | 3.0 | mmHg | reports | Law 2016 | abstract: "a new operational limit of 3.0 mmHg" | Law 2016 | verified |
| CO2 warning limit `CO2_LIMITS_MMHG.warn` | 2.5 | mmHg ppCO2 | `3d/src/sim/constants.ts:60`, same users as above | TB-004 | p. 5: 7-day average below 2.5 mmHg keeps headache risk below 1% | TB-004 | verified (7-day average target, not a requirement of the standard, see caveat C1) |
| CO2 warning limit, as cited to Law & Alexander | 2.5 | mmHg | reports | Law 2016 | abstract gives symptom bands 2.3-2.7 (fatigue), 2.7-3.0, above 3.0-3.4 (headache); no 2.5 | Law 2016 | unverified (not in this document) |
| Cabin total pressure for ppm -> mmHg `CABIN_PRESSURE_MMHG` | 760 | mmHg | `3d/src/sim/constants.ts:56` | none | sea-level cabin assumption | none | project estimate |
| CO2 stress scale (2500-7000 ppm) | 2500 / 4500 | ppm | `src/engine/index.ts:147` | none | | none | project estimate |
| CO2 deviation unit and brain weight `CO2_UNIT`, `CO2_BRAIN_WEIGHT` | 0.35 / 0.7 | level | `3d/src/sim/constants.ts:63-64` | none | | none | project estimate |
| Career effective dose limit (not used in code) | 600 | mSv | reports | STD V1 C; STD V1 B; TB-020 | [V1 4030] §4.8.2, Rev C p. 40, Rev B p. 29; same value in both revisions | STD V1 C | verified |
| Solar particle event design limit (not used in code as a limit) | 250 | mSv effective dose, per event | reports | STD V1 C; STD V1 B; TB-020 | [V1 4031] §4.8.3, Rev C p. 42 ("Radiation Limits – Solar Particle Events"), Rev B p. 31 ("Short-Term Radiation Limits – Solar Particle Events"); TB-020 p. 1: "250 mSv per event" | STD V1 C | verified |
| Radiation display scale: level 1.0 at 250 mSv cumulative dose | 250 | mSv cumulative | `src/engine/index.ts:150` | none (the 250 mSv in [V1 4031] is a per-event SPE design limit, not a cumulative-dose limit) | | none | project estimate |
| GCR design dose rate, free space (not used in code) | 1.3 | mSv/day | reports | STD V1 C; TB-020 | [V1 4033] §4.8.5, Rev C p. 45, new in Rev C (absent in Rev B) | STD V1 C | verified |
| GCR design dose rate, planetary surface (not used in code) | 0.9 | mSv/day | reports | STD V1 C; TB-020 | [V1 4033], Rev C p. 45. No 0.8 mSv/day figure in either document | STD V1 C | verified |
| ISS dose rate `ENVIRONMENTS.station.doseMsvPerDay` | 0.5 | mSv/day | `3d/src/sim/constants.ts:14` | LSAH 2023 | p. 6: ISS crew "receive doses in the order of 0.5 mSv/day" | LSAH 2023 | verified |
| Transit dose rate `ENVIRONMENTS.transit.doseMsvPerDay` | 1.84 | mSv/day | `3d/src/sim/constants.ts:17` | Zeitlin 2013; SwRI 2013 | the abstract gives only the round trip (0.66 ± 0.12 Sv); the SwRI release gives 1.8 mSv/day in cruise | SwRI 2013 | unverified (1.84 not found; 1.8 found in the press release) |
| Mars surface dose rate `ENVIRONMENTS.mars_surface.doseMsvPerDay` | 0.64 | mSv/day | `3d/src/sim/constants.ts:20` | Hassler 2014 | abstract has no dose-rate number; full text not opened | Hassler 2014 | unverified |
| Radiation display scale `RADIATION_SCALE_MSV_DAY`, `RADIATION_UNIT` | 5 / 0.4 | mSv/day / level | `3d/src/sim/constants.ts:9, 65` | none | | none | project estimate |
| Mars gravity `ENVIRONMENTS.mars_surface.gravityField` | 0.38 | g | `3d/src/sim/constants.ts:20` | NSSDC Mars | Mars/Earth surface gravity ratio 0.380 (3.73 vs 9.82 m/s²) | NSSDC Mars | verified |
| Mars-Earth one-way delay, maximum | up to ~20 | min | NASA hazard text, reports | HRP distance | "a communication delay of up to 20 minutes one way" | HRP distance | verified |
| One-way light time range (code comment) | 3..22 | min | `3d/src/sim/constants.ts:16` | NSSDC Mars | Earth distance min 54.6, max 401.4 million km; light time 3.0-22.3 min is our calculation | NSSDC Mars | verified (derived) |
| Mars surface delay `commDelaySec` | 750 (12.5 min) | s | `3d/src/sim/constants.ts:20` | HRP distance | "Mars is, on average, 140 million miles from Earth" (≈ 751 s light time, our calculation) | HRP distance | verified (derived) |
| Transit delay `commDelaySec` | 300 | s | `3d/src/sim/constants.ts:17` | none | mid-cruise pick | none | project estimate |
| Station delay `commDelaySec` | 1 | s | `3d/src/sim/constants.ts:14` | none | | none | project estimate |
| Distance threat full at `DISTANCE_DELAY_FULL_SEC` | 800 | s | `3d/src/sim/constants.ts:100` | none | | none | project estimate |
| Bone loss, weight-bearing bones | 1-1.5 | %/month | `3d/src/sim/constants.ts:68-70`, `src/engine/index.ts:39` | HRP bone | "bones lose between 1% and 1.5% of their density each month" (4-6 month missions, spine and hips) | HRP bone | verified |
| Bone loss, spine `BONE_LOSS_PER_MONTH.spine` | 1.1 | %/month | `3d/src/sim/constants.ts:76` | LeBlanc 2000; Lang 2004 | LeBlanc Table 1 (p. 2): spine -1.06 %/month; Lang abstract: spine aBMD 0.9 %/month | LeBlanc 2000 | verified |
| Bone loss, pelvis `BONE_LOSS_PER_MONTH.pelvis` | 1.6 | %/month | `3d/src/sim/constants.ts:73` | LeBlanc 2000 | Table 1: pelvis -1.35 ± 0.54 %/month (trochanter -1.56) | LeBlanc 2000 | mismatch (document: 1.35) |
| Bone loss, legs `BONE_LOSS_PER_MONTH.leg_*` | 1.5 | %/month | `3d/src/sim/constants.ts:74-75` | LeBlanc 2000; Lang 2004 | LeBlanc Table 1: whole-body leg BMD -0.34 %/month; femoral neck -1.15, trochanter -1.56; Lang: hip aBMD 1.4-1.5 %/month | LeBlanc 2000 | mismatch (document: legs 0.34; 1.5 matches the hip, not the leg region) |
| Bone loss, arms `BONE_LOSS_PER_MONTH.arm_*` | 0.4 | %/month | `3d/src/sim/constants.ts:77-78` | LeBlanc 2000 | Table 1: arm BMD -0.04 %/month, not significant | LeBlanc 2000 | mismatch (document: 0.04) |
| Bone loss, ribs `BONE_LOSS_PER_MONTH.ribs` | 0.5 | %/month | `3d/src/sim/constants.ts:77` | none | not reported in LeBlanc 2000 or Lang 2004 | none | project estimate |
| Bone loss, skull `BONE_LOSS_PER_MONTH.skull` | 0 | %/month | `3d/src/sim/constants.ts:80` | LeBlanc 2000 | p. 3: head +0.09 ± 0.40 %/month, not significant | LeBlanc 2000 | verified |
| Engine per-part bone loss `MONTHLY_BONE_LOSS` | spine 1.25, pelvis 1.5, legs 1.3, ribs 0.3, arms 0.25, skull 0.05 | %/month | `src/engine/index.ts:40-49` | HRP bone (range only) | per-part split not in the sources; legs and arms are higher than LeBlanc Table 1 | none | project estimate |
| Bone deviation unit `BONE_UNIT` | 0.05 | density | `3d/src/sim/constants.ts:82` | none | | none | project estimate |
| Muscle loss with ISS exercise `MUSCLE_LOSS_PER_MONTH` | 1.5 | %/month | `3d/src/sim/constants.ts:85` | Rice 2011 | abstract: calf -10 to -16 %, thigh -4 to -7 % after 181 ± 15 days (≈ 0.7-2.7 %/month, our calculation); 1.5 itself is not stated | Rice 2011 | project estimate (within the measured range) |
| Muscle loss, as cited to Gopalakrishnan et al. 2010 | 1.5 | %/month | `3d/src/sim/constants.ts:84` (comment) | Gopalakrishnan 2010 (Aviat Space Environ Med 81:91-104) | paper not opened; only the companion NTRS abstract (Rice 2011) | none | unverified |
| Engine muscle loss without resistance exercise | 3 | %/month | `src/engine/index.ts:161` | none | labelled "(demo)" in the UI | none | project estimate |
| Muscle deviation unit `MUSCLE_UNIT` | 0.06 | mass | `3d/src/sim/constants.ts:86` | none | | none | project estimate |
| Fluid shift model `FLUID_SHIFT_START`, `FLUID_SHIFT_PER_DAY`, `EYES_FLUID_FROM`, `EYES_UNIT` | 0.1, 1/300, 0.1, 0.4 | index | `3d/src/sim/constants.ts:90-93` | Mader 2011 (qualitative only) | abstract: changes "may result from cephalad fluid shifts"; vision worse in ~60 % of long vs ~29 % of short missions; no rate model | Mader 2011 | project estimate |
| Planned daily exercise on the ISS | ~2.5 | h/day | `3d/src/sim/constants.ts:127, 142` | Rice 2011 | abstract: 146.8 min assigned for exercise | Rice 2011 | verified |
| NASA sleep time line in the brain chart `NASA_SLEEP_SCHEDULE_H` | 8.5 | h | `3d/src/ui/ZoneCharts.tsx:32` | Barger 2014 | Discussion: NASA regulations "mandate 8·5 hours of protected time for sleep" | Barger 2014 | verified (protected sleep time, not a scheduled sleep duration) |
| In-flight sleep, Shuttle / ISS (not used in code) | 5.96 / 6.09 | h | reports | Barger 2014 | abstract and Table 1: 5.96 ± 0.56 h (Shuttle), 6.09 ± 0.67 h (ISS) | Barger 2014 | verified |
| Pre-flight training sleep (not used in code) | < 6.5 | h | reports | Barger 2014 | Discussion: under 6.5 h during the SL-90 training interval (6.29 h Shuttle, 6.41 h ISS) | Barger 2014 | verified |
| Mars-520 activity and sleep (not used in code) | -1.12 h active wake, +8.4 % sleep, < 6.78 h sleep in days 1-40 | h/day | reports | Basner 2013 | Results p. 1-2: last vs first mission quarter | Basner 2013 | verified |
| Mars-520 mood (not used in code) | 1 of 6 crew with depressive symptoms in 93 % of weeks; conflicts with mission control 5× more often | count | reports | Basner 2014 | Abstract | Basner 2014 | verified |
| Mars-520 mean sleep (not used in code) | 7.39 | h/day | reports | Basner 2014 | Discussion; only seen as a fetch-tool summary, not read word for word | Basner 2014 | unverified |
| Engine sleep reference | 8 | h | `src/engine/index.ts:148`, advice `3d/src/sim/constants.ts:122` | none | | none | project estimate |
| Reaction test lapse cut-off `LAPSE_MS` | 500 | ms | `3d/src/ui/ReactionTest.tsx:11` | Basner 2011 | Methods: lapses are RT ≥ 500 ms for the 10-min PVT; for PVT-B the cut-off is lowered "from 500 ms to 355 ms" | Basner 2011 | mismatch (PVT-B document value: 355 ms) |
| Reaction test signal wait `WAIT_MS` | 1-4 | s | `3d/src/ui/ReactionTest.tsx:10` | Basner 2011 | PVT-B inter-stimulus interval 1-4 s (standard PVT 2-10 s) | Basner 2011 | verified |
| Reaction test length `TEST_MS` | 30 | s | `3d/src/ui/ReactionTest.tsx:9` | Basner 2011 | PVT-B lasts 3 min | Basner 2011 | project estimate (shortened for the demo) |
| No-response timeout `MISS_MS` | 2 | s | `3d/src/ui/ReactionTest.tsx:12` | Basner 2011 | PVT: a trial without a response for 30 s counts as a lapse | Basner 2011 | project estimate |
| Deviation scale `WARN_AT`, `CRITICAL_AT`, `SCORE_PER_UNIT` | 1, 2, 30 | units | `3d/src/sim/constants.ts:27-30` | none | | none | project estimate |
| Personal tolerances `TOLERANCE` (systolic 15, diastolic 10, HR 20, glucose 1.5, temp 0.5, sleep 1.5, mood 1, reaction 50) | see value | mmHg, bpm, mmol/L, °C, h, points, ms | `3d/src/sim/constants.ts:33-42` | none | | none | project estimate |
| Threat timing `GRAVITY_THREAT_DAYS`, `ISOLATION_DAYS` | 120, 500 | days | `3d/src/sim/constants.ts:98-99` | none | | none | project estimate |
| Isolation units `SLEEP_SHIFT_UNIT`, `ACTIVITY_DROP_UNIT` | 1.5, 0.25 | h, share | `3d/src/sim/constants.ts:141-143` | none | | none | project estimate |

### Caveats on verified rows

- **C1, CO2 averaging time.** [V2 6004] is a **1-hour average** of no more than 3 mmHg. The 2.5 mmHg value
  in TB-004 is a **7-day average** that keeps headache risk below 1%, not a requirement of the standard.
  The app compares one **daily mean** (`co2Ppm`, `3d/src/contract/types.ts:78`) against both. The values
  and units match the documents. The averaging times do not.
- **C2, the 250 mSv value.** In NASA-STD-3001 it is a vehicle design limit for one solar particle event
  (the design reference event is the sum of the October 1989 events). It is not a 30-day or cumulative
  limit. The engine uses 250 mSv only as the full-scale point of a display level.
- **C3, sleep 8.5 h.** Barger 2014 describes 8.5 h of *protected time for sleep*, which NASA regulations
  require. It does not describe 8.5 h of measured or scheduled sleep.

## 2. Claims in UI text

| Text | Where | Source | Status |
| --- | --- | --- | --- |
| Five hazards: Radiation, Isolation, Gravity, Distance from Earth, Environment | `3d/src/twin/labels.ts:51-57` | HRP hazards: Space Radiation, Isolation and Confinement, Distance from Earth, Gravity Fields, Hostile/Closed Environments | verified (short names) |
| "NASA HRP: cardiovascular adaptation; reduced cardiorespiratory fitness" | `src/data/zoneInfo.ts:78` | HRP risks: "Risk of Cardiovascular Adaptations", "Risk of Reduced Cardiorespiratory and Musculoskeletal Fitness" | verified |
| "NASA HRP: behavioral conditions; inadequate sleep; hypoxia and CO₂" | `src/data/zoneInfo.ts:118` | HRP risks lists "Risk of Hypoxia" but no CO₂ risk. CO₂ is covered by TB-004 | mismatch, reworded (see Wording fixes) |
| "NASA HRP: hypoxia and CO₂" | `src/data/zoneInfo.ts:287` | same as above | mismatch, reworded |
| "NASA HRP: risk of spaceflight-induced bone changes" | `src/data/zoneInfo.ts:151` | HRP risks, exact name | verified |
| "NASA HRP: reduced cardiorespiratory and musculoskeletal fitness" | `src/data/zoneInfo.ts:184`, `3d/src/ui/alerts.ts:56` | HRP risks, exact name | verified |
| "NASA HRP: spaceflight associated neuro-ocular syndrome (SANS)" | `src/data/zoneInfo.ts:217` | HRP risks | verified |
| "NASA HRP: altered immune responses" | `src/data/zoneInfo.ts:251` | HRP risks: "Risk of Altered Immune System Responses" | verified |
| "NASA HRP: inadequate food and nutrition" | `src/data/zoneInfo.ts:321` | HRP risks, exact name | verified |
| "NASA HRP: inadequate sleep" / "behavioral conditions" | `3d/src/ui/alerts.ts:38, 44, 50` | HRP risks: "Risk of Inadequate Sleep and Irregular Schedules"; "Risk of Behavioral Changes and Psychiatric Disorders" (URL slug "behavioral-conditions") | verified |
| "NASA reports ~1–1.5%/month in weight-bearing bones" | `src/engine/index.ts:39` (comment) | HRP bone | verified |
| Advice links: HRP risks, isolation hazard, OCHMO-TB-004, bone risk page | `src/engine/advice.ts:3-12` | pages opened | verified |
| Advice links: Human Research Roadmap gaps 675 and 818 | `src/engine/advice.ts:10-11` | not opened | unverified |
| "Based on NASA's Reaction Self-Test (PVT-B), shortened for demo" | `3d/src/ui/ReactionTest.tsx:23` | PVT-B (Basner 2011) verified; no NASA "Reaction Self Test" page was found | reworded (see Wording fixes) |
| Reaction test false starts: only presses before the signal | `3d/src/ui/ReactionTest.tsx:5` | Basner 2011 also counts responses under 100 ms as false starts | project estimate |
| "NASA schedule 8.5 h" (brain chart line) | `3d/src/ui/ZoneCharts.tsx:230` | Barger 2014: protected sleep time (C3) | reworded |
| "limits 2.5 / 3 mmHg" (CO₂ note) | `3d/src/ui/co2.ts:8` | STD V2 F [V2 6004]; TB-004 | verified values (C1); marked as NASA |
| "ARED, 2.5 h total exercise" (bones advice) | `3d/src/sim/constants.ts:127` | Rice 2011: 146.8 min assigned | verified |
| "Cumulative dose (demo)", "Muscle loss (demo)" and the other "(demo)" metrics | `src/engine/index.ts:143-166` | none | project estimate (already labelled) |

## 3. For the submission form

### (a) NASA data and resources

```
5 Hazards of Human Spaceflight (NASA HRP) | https://www.nasa.gov/hrp/hazards
Hazard: Distance From Earth (NASA HRP) | https://www.nasa.gov/hrp/hazard-distance-from-earth/
Hazard: Isolation and Confinement (NASA HRP) | https://www.nasa.gov/hrp/hazard-isolation-and-confinement/
Risks of Human Spaceflight (NASA HRP) | https://www.nasa.gov/hrp/risks/
Risk of Spaceflight-Induced Bone Changes (NASA) | https://www.nasa.gov/reference/risk-of-spaceflight-induced-bone-changes/
NASA-STD-3001 Volume 1 Rev C (radiation limits V1 4030, 4031, 4033) | https://standards.nasa.gov/sites/default/files/standards/NASA/C//nasa-std-3001-vol-1-rev-c-signature.pdf
NASA-STD-3001 Volume 1 Rev B | https://www.nasa.gov/wp-content/uploads/2020/10/2022-01-05_nasa-std-3001_vol.1_rev._b_final_draft_with_signature_010522.pdf
NASA-STD-3001 Volume 2 Rev F (CO2 limit V2 6004) | https://www.nasa.gov/wp-content/uploads/2025/05/nasa-std-3001-vol-2.pdf
OCHMO-TB-020 Design for Ionizing Radiation Protection | https://www.nasa.gov/sites/default/files/atoms/files/radiation_protection_technical_brief_ochmo.pdf
OCHMO-TB-004 Carbon Dioxide technical brief | https://www.nasa.gov/ochmo-tb-004-carbon-dioxide-2/
Law & Alexander, CO2 on the ISS: An Operations Update (NTRS) | https://ntrs.nasa.gov/citations/20150019624
Rice et al., Inadequate Loading Stimulus on ISS Results in Bone and Muscle Loss (NTRS) | https://ntrs.nasa.gov/citations/20110015001
Lifetime Surveillance of Astronaut Health newsletter, Oct 2023 (ISS dose rate) | https://www.nasa.gov/wp-content/uploads/2023/10/lsah-newsletter-2023-vol28-issue2.pdf
Mars Fact Sheet (NASA NSSDC) | https://nssdc.gsfc.nasa.gov/planetary/factsheet/marsfact.html
```

### (b) Partner agency and other scientific sources

```
Barger et al. 2014, Lancet Neurology, sleep deficiency in astronauts | https://pmc.ncbi.nlm.nih.gov/articles/PMC4188436/
Basner et al. 2013, PNAS, Mars-520 hypokinesis and sleep | https://doi.org/10.1073/pnas.1212646110
Basner et al. 2014, PLoS ONE, Mars-520 psychological and behavioral changes | https://doi.org/10.1371/journal.pone.0093298
Basner, Mollicone & Dinges 2011, Acta Astronautica, brief PVT (PVT-B) | https://pmc.ncbi.nlm.nih.gov/articles/PMC3197786/
LeBlanc et al. 2000, J Musculoskelet Neuronal Interact, bone and lean tissue loss on Mir | https://pubmed.ncbi.nlm.nih.gov/15758512/
Lang et al. 2004, J Bone Miner Res, spine and hip bone loss on the ISS | https://pubmed.ncbi.nlm.nih.gov/15125798/
Mader et al. 2011, Ophthalmology, optic disc edema and globe flattening after long-duration flight | https://pubmed.ncbi.nlm.nih.gov/21849212/
```

Zeitlin 2013 and Hassler 2014 are left out of this list because their dose rates are unverified.

### (c) Software libraries

```
React (MIT) | https://react.dev/
React DOM (MIT) | https://react.dev/
three.js (MIT) | https://threejs.org/
React Three Fiber (MIT) | https://github.com/pmndrs/react-three-fiber
drei (MIT) | https://github.com/pmndrs/drei
React Postprocessing (MIT) | https://github.com/pmndrs/react-postprocessing
Zustand (MIT) | https://github.com/pmndrs/zustand
Vite (MIT, build tool) | https://vite.dev
TypeScript (Apache-2.0, build tool) | https://www.typescriptlang.org/
@vitejs/plugin-react (MIT, build tool) | https://github.com/vitejs/vite-plugin-react
Oxlint (MIT, dev tool) | https://oxc.rs/docs/guide/usage/linter
Kenney sound effects (CC0 1.0), see 3d/public/sounds/LICENSES.md | https://kenney.nl/assets/sci-fi-sounds
```

Runtime dependencies are react, react-dom, three, @react-three/fiber, @react-three/drei,
@react-three/postprocessing and zustand. Licenses come from the npm registry for the versions in
`3d/package.json`.

## 4. Mismatches and unverified rows, by importance for the demo

1. **CO₂ averaging time (caveat C1).** The standard gives 3 mmHg as a 1-hour average ([V2 6004], Vol 2
   Rev F p. 53). The 2.5 mmHg value is a 7-day average headache-risk target (TB-004 Rev D p. 5). The app
   compares a daily mean against both.
2. **Radiation scale at 250 mSv (caveat C2).** The engine reaches full radiation level at 250 mSv of
   cumulative dose. In NASA-STD-3001, 250 mSv is the per-event solar particle event design limit. The
   career limit is 600 mSv.
3. **Transit dose 1.84 mSv/day: unverified.** The Zeitlin 2013 abstract gives only the 0.66 Sv round trip.
   The SwRI release gives 1.8 mSv/day.
4. **Mars surface dose 0.64 mSv/day: unverified.** The Hassler 2014 abstract has no number, and the full
   text was not opened.
5. **2.5 mmHg attributed to Law & Alexander: unverified.** The NTRS item is a 2016 AsMA abstract. It
   gives 3.0 mmHg and symptom bands of 2.3-2.7, 2.7-3.0 and 3.0-3.4 mmHg, but not 2.5.
6. **Sleep 8.5 h (caveat C3).** Barger 2014 describes required protected sleep time, not scheduled sleep.
   The chart label was reworded.
7. **Mars-520 mean sleep 7.39 h: unverified.** It was only seen in a tool summary.
8. **PVT-B lapse cut-off: mismatch.** The app uses 500 ms. PVT-B uses 355 ms; 500 ms is the
   10-minute PVT value.
9. **Bone loss, pelvis: mismatch.** The app uses 1.6 %/month. LeBlanc 2000 gives 1.35.
10. **Bone loss, legs: mismatch.** The app uses 1.5 %/month. LeBlanc 2000 gives 0.34 for whole-body leg
    BMD. The 1.5 value fits the hip (femoral neck 1.15, trochanter 1.56, Lang hip 1.4-1.5).
11. **Bone loss, arms: mismatch.** The app uses 0.4 %/month. LeBlanc 2000 gives 0.04, not significant.
12. **Gopalakrishnan 2010: unverified.** The paper was not opened. Its NTRS companion (Rice 2011) supports
    the muscle range.
13. **Human Research Roadmap gap pages 675 and 818: unverified.** They were not opened.

Not used in code but checked: 600 mSv career limit, 250 mSv per-event SPE limit and the 1.3 / 0.9 mSv/day
GCR design rates. All three are verified, and the 600 and 250 values are the same in Rev B and Rev C. The
GCR requirement [V1 4033] is new in Rev C. No official document gave 0.8 mSv/day.
