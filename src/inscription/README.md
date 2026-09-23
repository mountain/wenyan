# Inscription tri-compute utilities

This folder adds a prose-friendly path for bronze/oracle style input.

The optional [finite changes grammar](CHANGES.md) adds sourced six-line inquiries
and categorical syllogisms through explicit APIs. Corpus storage and contextual
learning live in the separate relation-data repository.

## API

- `analyzeInscription(text)`
  - Extracts structured fields (time, location, command, rewards, purpose, blessing).
- `forwardTriCompute(analysis)`
  - Maps structure into the three channels: observation/action/memory.
- `reverseTriCompute(text, target)`
  - Computes a reverse convergence score and emits a hypothesis sentence.
  - The `hypothesis` output is explicitly marked as `【新假设（实验性）】`.
  - `hypothesisMeta.isNewHypothesis` is always `true` in this exploratory phase.
  - `hypothesisMeta.confidenceBand` grades maturity as `exploratory | working | strong`.
  - `target.profilePreset` chooses a named mode: `seed | oracle | strict`.
  - `target.profile` can further tune scoring:
    - `weights.containsThree | structure | style`
    - `thresholds.working | strong`
- `getReverseProfilePreset(name)`
  - Returns built-in profile values for repeatable experiments.
- `runInscriptionPipeline(text, options)`
  - Runs forward + reverse in a small co-iteration trajectory.
  - Always returns `entryWarning` and the exported constant `INSCRIPTION_EXPERIMENT_WARNING`.
  - The warning clearly states: this is not a real story, only an exploration game.
  - Optional acknowledgement gate:
    - set `safety.requireAcknowledgement = true`
    - pass `safety.acknowledged = true` to proceed
    - otherwise returns `{ blocked: true, blockedReason: INSCRIPTION_ACK_REQUIRED_WARNING }`
  - CLI note: `wenyan --inscription` without `--ack-experiment` shows a rerun hint.
  - CLI acknowledgement phrase alternative:
    - `--inscription-ack-text '我确认这不是真实故事，只是探索游戏'`
    - `--inscription-ack-from-file <path>`
  - CLI output mode:
    - `--inscription-output pretty|compact`
  - CLI phrase management:
    - `--print-inscription-ack-phrase` prints the currently effective phrase
    - `WENYAN_INSCRIPTION_ACK_PHRASE` overrides the default phrase
  - Keeps `target.profile` across steps.
  - Supports optimizer controls inspired by historical tuning loops:
    - `optimizer.minGain` (acceptance gate)
    - `optimizer.damping` (weight update smoothness)
  - Emits `growth` metrics for the narrative-learning experiment:
    - `worldFeatureDensity` (text as observed world features)
    - `storyHumanCoupling` (action-memory coupling)
    - `learningPulse` (feature + coupling + balance)
  - Emits `optimization` telemetry:
    - per step: `accepted`, `deltaScore`, `reason`
    - global: `acceptedSteps`, `rejectedSteps`, `bestScore`

## Example

```ts
import {
  runInscriptionPipeline,
  INSCRIPTION_EXPERIMENT_WARNING,
  INSCRIPTION_ACK_REQUIRED_WARNING
} from "../src/parser";

const text = "隹三年五月丁巳，王在宗周，令…";
const out = runInscriptionPipeline(text, {
  safety: {
    requireAcknowledgement: true,
    acknowledged: true
  },
  steps: 3,
  optimizer: {
    minGain: 0.01,
    damping: 0.85
  },
  target: {
    mustContainThree: true,
    preferOracleTone: true,
    profilePreset: "oracle",
    profile: {
      thresholds: { working: 0.97, strong: 0.99 }
    }
  }
});

if (out.blocked) {
  console.warn(INSCRIPTION_EXPERIMENT_WARNING);
  console.warn(INSCRIPTION_ACK_REQUIRED_WARNING);
} else {
  console.warn(out.entryWarning);
  console.log(out.reverse.convergenceScore);
  console.log(out.reverse.hypothesis);
  console.log(out.reverse.hypothesisMeta.confidenceBand);
  console.log(out.growth.storyHumanCoupling);
  console.log(out.optimization.bestScore);
}
```

CLI quick examples:

```sh
wenyan --print-inscription-ack-phrase
WENYAN_INSCRIPTION_ACK_PHRASE='自定义确认短语' wenyan --print-inscription-ack-phrase
wenyan --inscription --ack-experiment --inscription-output compact --eval '隹三年五月丁巳，王在宗周。'
wenyan --inscription --inscription-ack-text '我确认这不是真实故事，只是探索游戏' --inscription-profile strict --inscription-steps 2 --eval '隹三年五月丁巳，王在宗周。'
printf '我确认这不是真实故事，只是探索游戏\n' > ack.txt
wenyan --inscription --inscription-ack-from-file ack.txt --eval '隹三年五月丁巳，王在宗周。'
```
