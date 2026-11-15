/**
 * Zone info: plain-language content for the region panel (one entry per RegionId).
 * For each region: why it is measured, how to measure it on board, which of the five
 * hazards affect it, what to do at warning / critical, and who to involve.
 *
 * Based only on these NASA HRP risks: altered immune responses, cardiovascular adaptation,
 * SANS, bone changes, reduced cardiorespiratory and musculoskeletal fitness, hypoxia and CO₂,
 * behavioral conditions, inadequate sleep, inadequate food and nutrition.
 * No numbers here on purpose: thresholds and rates live in 3d/src/sim/constants.ts.
 * Every entry is `verified: false` until participant 3 checks it against the sources.
 */
import type { Escalation, RegionId, Source, ThreatId } from '../../3d/src/contract/types'

export const DISCLAIMER = 'Not medical advice'

export interface ZoneHazard {
  hazard: ThreatId
  effect: string // how this hazard affects the region, in plain words
}

export interface ZoneEscalationStep {
  who: Escalation // same rule as the engine: warning -> crew, critical -> ground
  text: string // who to involve, in plain words
}

export interface ZoneInfo {
  why: string // why measure this (1–2 plain sentences)
  how: string[] // how to measure it in space with what is on board
  measurement: Source // 'measured' on board, or 'forecast' by the model (no in-flight measurement)
  hazards: ZoneHazard[]
  actions: { warning: string[]; critical: string[] }
  escalation: {
    warning: ZoneEscalationStep
    critical: ZoneEscalationStep
    autonomous: string // replaces the critical step when Earth is not reachable
  }
  source: string // short source name
  verified: false
}

// Shared wording, so every region says the same thing the same way.
const CREW = 'Tell the crew medical officer today and agree on the next check together.'
const GROUND = 'Tell the crew medical officer now and request a call with the flight surgeon on Earth.'
const AUTONOMOUS =
  'Earth is not reachable: follow the onboard checklist with the crew medical officer, log every step and send the log when the link returns.'

export const ZONE_INFO: Record<RegionId, ZoneInfo> = {
  heart: {
    why: 'In low gravity the heart and blood vessels adapt to less work. Changes in pulse and blood pressure show how well your body is coping, and matter most before landing.',
    how: [
      'Sit still for a few minutes, then count your pulse or read it from the cuff.',
      'Measure blood pressure with the cuff on the same arm, at the same time of day.',
      'Log the values in the app so they are compared with your own pre-flight values.',
    ],
    measurement: 'measured',
    hazards: [
      { hazard: 'gravity', effect: 'Fluid moves toward the head and the heart works less, so fitness drops.' },
      { hazard: 'environment', effect: 'Heat and stale cabin air make the heart work harder.' },
      { hazard: 'distance', effect: 'No quick return to Earth, so problems must be caught early on board.' },
    ],
    actions: {
      warning: [
        'Rest and measure again after a short break.',
        'Drink water.',
        'Skip intense exercise until the values are back to your normal.',
      ],
      critical: [
        'Stop physical work and sit or lie down.',
        'Measure pulse and blood pressure again.',
        'Do not stay alone: ask a crewmate to stay with you.',
      ],
    },
    escalation: {
      warning: { who: 'crew', text: CREW },
      critical: { who: 'ground', text: GROUND },
      autonomous: AUTONOMOUS,
    },
    source: 'NASA HRP: cardiovascular adaptation; reduced cardiorespiratory fitness',
    verified: false,
  },

  brain: {
    why: 'Sleep, mood and alertness decide how safely you work. Small changes are easy to miss on your own, so a short daily check catches them early.',
    how: [
      'Log last night’s sleep in the sleep log: when you fell asleep and woke up.',
      'Rate your mood honestly in the daily check-in.',
      'Take the reaction test at the same time each day.',
    ],
    measurement: 'measured',
    hazards: [
      { hazard: 'isolation', effect: 'Confinement, monotony and little contact lower mood and disturb sleep.' },
      { hazard: 'environment', effect: 'High cabin CO₂ can cause headaches and slow thinking.' },
      { hazard: 'distance', effect: 'Delayed or no contact with family and ground adds stress.' },
      { hazard: 'radiation', effect: 'Space radiation is studied as a possible long-term risk to the brain.' },
    ],
    actions: {
      warning: [
        'Plan a full sleep window tonight and avoid screens before bed.',
        'Get bright light in the morning.',
        'Repeat the reaction test after a break.',
        'Talk to a crewmate about how you feel.',
      ],
      critical: [
        'Postpone critical or risky tasks.',
        'Check the cabin CO₂ reading.',
        'Rest and repeat the reaction test.',
        'Ask a crewmate to double-check your work today.',
      ],
    },
    escalation: {
      warning: { who: 'crew', text: CREW },
      critical: {
        who: 'ground',
        text: 'Tell the crew medical officer now and request a private call with the flight surgeon or psychologist on Earth.',
      },
      autonomous: AUTONOMOUS,
    },
    source: 'NASA HRP: behavioral conditions; inadequate sleep; hypoxia and CO₂',
    verified: false,
  },

  bones: {
    why: 'Bones lose strength when they carry no weight. You cannot feel it, but weak bones can break during landing or work on a planet.',
    how: [
      'Bone density cannot be measured on board with the available tools.',
      'The app forecasts it from days in low gravity and the exercise you log (model rates: 3d/src/sim/constants.ts, BONE_LOSS_PER_MONTH).',
      'Log every resistance exercise session, so the forecast stays accurate.',
    ],
    measurement: 'forecast',
    hazards: [
      { hazard: 'gravity', effect: 'Without weight on the skeleton, the hips, pelvis and spine lose density fastest.' },
      { hazard: 'distance', effect: 'A fracture far from Earth cannot be treated in a hospital.' },
    ],
    actions: {
      warning: [
        'Do the full resistance exercise session today.',
        'Eat the planned meals: calcium and vitamin D matter.',
      ],
      critical: [
        'Do not skip any resistance session until the forecast improves.',
        'Avoid sudden heavy loads and impacts.',
        'Plan landing and first steps on a planet with the crew.',
      ],
    },
    escalation: {
      warning: { who: 'crew', text: CREW },
      critical: { who: 'ground', text: GROUND },
      autonomous: AUTONOMOUS,
    },
    source: 'NASA HRP: risk of spaceflight-induced bone changes',
    verified: false,
  },

  muscles: {
    why: 'Muscles shrink when they do not work against gravity. Strong legs and back are needed to stand, walk and work after landing.',
    how: [
      'Muscle mass is not measured on board with the available tools.',
      'The app forecasts it from days in low gravity and the exercise you log (model rate: 3d/src/sim/constants.ts, MUSCLE_LOSS_PER_MONTH).',
      'Note if exercise feels harder than usual: that is a useful self-check.',
    ],
    measurement: 'forecast',
    hazards: [
      { hazard: 'gravity', effect: 'Leg and back muscles lose mass and strength without load.' },
      { hazard: 'isolation', effect: 'Low mood and long shelter time often mean less exercise.' },
    ],
    actions: {
      warning: [
        'Add a lower-body resistance set today.',
        'Eat the planned protein at every meal.',
      ],
      critical: [
        'Follow the full exercise plan every day.',
        'Ask a crewmate to help you keep the schedule.',
        'Plan the first activities after landing with the crew.',
      ],
    },
    escalation: {
      warning: { who: 'crew', text: CREW },
      critical: { who: 'ground', text: GROUND },
      autonomous: AUTONOMOUS,
    },
    source: 'NASA HRP: reduced cardiorespiratory and musculoskeletal fitness',
    verified: false,
  },

  eyes: {
    why: 'In low gravity fluid moves toward the head and can change the eyes and vision. Catching it early helps the crew and ground plan care.',
    how: [
      'Read the same line of small text with each eye covered in turn, and note if it looks blurred.',
      'Note headaches or new pressure behind the eyes in the daily check-in.',
      'The app also forecasts the risk from days in low gravity (eye scans need the onboard medical kit and ground help).',
    ],
    measurement: 'forecast',
    hazards: [
      { hazard: 'gravity', effect: 'Fluid shift toward the head is the main suspected cause of SANS.' },
      { hazard: 'environment', effect: 'High cabin CO₂ is studied as a possible contributing factor.' },
      { hazard: 'radiation', effect: 'Space radiation can raise the long-term risk of cataracts.' },
    ],
    actions: {
      warning: [
        'Do the vision self-check again today.',
        'Note any blurred vision or headache in the log.',
      ],
      critical: [
        'Report any new blurred vision right away.',
        'Avoid tasks that need sharp vision until it is checked.',
        'Prepare for an eye exam with the onboard medical kit.',
      ],
    },
    escalation: {
      warning: { who: 'crew', text: CREW },
      critical: { who: 'ground', text: GROUND },
      autonomous: AUTONOMOUS,
    },
    source: 'NASA HRP: spaceflight associated neuro-ocular syndrome (SANS)',
    verified: false,
  },

  immune: {
    why: 'Spaceflight can weaken the body’s defence against infection. A rising temperature is often the first sign you can see yourself.',
    how: [
      'Measure body temperature with the thermometer at the same time each day.',
      'Note any symptoms: sore throat, cough, rash, tiredness.',
      'Check the radiation dose reading after any radiation alert.',
    ],
    measurement: 'measured',
    hazards: [
      { hazard: 'radiation', effect: 'Radiation is studied as one possible factor in immune changes; dose alone does not prove harm.' },
      { hazard: 'isolation', effect: 'Stress and poor sleep can weaken immune defence.' },
      { hazard: 'environment', effect: 'In a closed cabin germs spread easily between crewmates.' },
    ],
    actions: {
      warning: [
        'Measure temperature again later today.',
        'Drink water and rest.',
        'Wash hands often and keep your own cup and towel.',
      ],
      critical: [
        'Measure temperature again and log all symptoms.',
        'Limit close contact with the crew.',
        'Stay in the shelter if a radiation alert is active.',
      ],
    },
    escalation: {
      warning: { who: 'crew', text: CREW },
      critical: { who: 'ground', text: GROUND },
      autonomous: AUTONOMOUS,
    },
    source: 'NASA HRP: altered immune responses',
    verified: false,
  },

  lungs: {
    why: 'In a closed cabin the air is recycled, so CO₂ can build up. Too much CO₂ causes headaches and slows thinking before you notice it.',
    how: [
      'Read the cabin CO₂ sensor in the app.',
      'Note headache, shortness of breath or unusual tiredness in the daily check-in.',
      'Count your breathing rate at rest if you feel short of breath.',
    ],
    measurement: 'measured',
    hazards: [
      { hazard: 'environment', effect: 'Poor air flow or a weak CO₂ scrubber raises CO₂ in the cabin.' },
      { hazard: 'isolation', effect: 'In a small shelter, many people share little air.' },
    ],
    actions: {
      warning: [
        'Move to a better ventilated module.',
        'Check that the fans and the CO₂ scrubber work.',
        'Limit hard exercise until the reading drops.',
      ],
      critical: [
        'Move the crew to a module with fresh air.',
        'Check the CO₂ scrubber with the crew.',
        'Stop hard physical work.',
      ],
    },
    escalation: {
      warning: { who: 'crew', text: 'Tell the crew: the CO₂ reading affects everyone on board.' },
      critical: {
        who: 'ground',
        text: 'Tell the crew now and request a call with ground life support and the flight surgeon.',
      },
      autonomous: AUTONOMOUS,
    },
    source: 'NASA HRP: hypoxia and CO₂',
    verified: false,
  },

  metabolism: {
    why: 'Your body needs regular, balanced food to stay strong. Blood glucose shows if your energy supply is steady.',
    how: [
      'Measure glucose with the glucose meter before a meal.',
      'Log what you eat and drink in the app.',
      'Note weight changes if a scale or body mass device is available.',
    ],
    measurement: 'measured',
    hazards: [
      { hazard: 'isolation', effect: 'Stress, monotony and poor sleep change appetite and eating times.' },
      { hazard: 'gravity', effect: 'Less physical load changes how the body uses energy.' },
      { hazard: 'distance', effect: 'Food is limited to what was packed, so meals must follow the plan.' },
    ],
    actions: {
      warning: [
        'Check glucose again before the next meal.',
        'Keep regular meal times today.',
        'Do not skip planned meals.',
      ],
      critical: [
        'Check glucose again now.',
        'Follow the onboard nutrition plan strictly.',
        'Tell a crewmate if you feel dizzy, shaky or very tired.',
      ],
    },
    escalation: {
      warning: { who: 'crew', text: CREW },
      critical: { who: 'ground', text: GROUND },
      autonomous: AUTONOMOUS,
    },
    source: 'NASA HRP: inadequate food and nutrition',
    verified: false,
  },
}
