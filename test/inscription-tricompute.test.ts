import {
  analyzeInscription,
  forwardTriCompute,
  reverseTriCompute,
  getReverseProfilePreset,
} from "../src/parser";

const inscription =
  "隹三年五月丁巳，王在宗周，令「史颂稣，瀳友里君、百生，师隅盩于成周。」休又成事，稣宾章、马四匹、吉金，用乍彝。颂其万年无疆，日天子令，子子孙孙永宝用。";

describe("inscription tri-compute", () => {
  it("extracts a structural analysis from bronze-style prose", () => {
    const analysis = analyzeInscription(inscription);
    expect(analysis.mode).toBe("inscription");
    expect(analysis.time.year).toBe("三年");
    expect(analysis.time.month).toBe("五月");
    expect(analysis.time.dayGanzhi).toBe("丁巳");
    expect(analysis.location).toBe("宗周");
    expect(analysis.rewards).toEqual(["稣宾章", "马四匹", "吉金"]);
    expect(analysis.containsThree).toBe(true);
    expect(analysis.threeOccurrences).toBeGreaterThanOrEqual(1);
  });

  it("maps analysis into the three-channel forward state", () => {
    const state = forwardTriCompute(analyzeInscription(inscription));
    expect(state.observation).toBeGreaterThan(0);
    expect(state.action).toBeGreaterThan(0);
    expect(state.memory).toBeGreaterThan(0);
    expect(state.evidence.memory).toContain("contains-three");
  });

  it("runs reverse convergence and keeps a hypothesis containing 三", () => {
    const result = reverseTriCompute(inscription, {
      mustContainThree: true,
      preferOracleTone: true,
    });
    expect(result.convergenceScore).toBeGreaterThan(0.6);
    expect(result.matched.containsThree).toBe(true);
    expect(result.hypothesis).toContain("新假设");
    expect(result.hypothesis).toContain("三");
    expect(result.hypothesisMeta.isNewHypothesis).toBe(true);
    expect(["working", "strong"]).toContain(
      result.hypothesisMeta.confidenceBand
    );
  });

  it("supports custom confidence thresholds for tri-compute profiles", () => {
    const result = reverseTriCompute(inscription, {
      mustContainThree: true,
      preferOracleTone: true,
      profile: {
        thresholds: {
          working: 0.97,
          strong: 0.99,
        },
      },
    });

    expect(result.convergenceScore).toBeGreaterThan(0.9);
    expect(result.hypothesisMeta.confidenceBand).toBe("exploratory");
  });

  it("exposes named reverse scoring presets", () => {
    expect(getReverseProfilePreset("seed").thresholds?.working).toBe(0.58);
    expect(getReverseProfilePreset("oracle").weights?.containsThree).toBe(0.55);
    expect(getReverseProfilePreset("strict").thresholds?.strong).toBe(0.9);
  });
});
