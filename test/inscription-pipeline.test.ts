import {
  runInscriptionPipeline,
  INSCRIPTION_EXPERIMENT_WARNING,
  INSCRIPTION_ACK_REQUIRED_WARNING,
} from "../src/parser";

function expectReady(result: ReturnType<typeof runInscriptionPipeline>) {
  if (result.blocked) {
    throw new Error(`Pipeline blocked unexpectedly: ${result.blockedReason}`);
  }
  return result as Exclude<
    ReturnType<typeof runInscriptionPipeline>,
    { blocked: true }
  >;
}

const inscription =
  "隹三年五月丁巳，王在宗周，令「史颂稣，瀳友里君、百生，师隅盩于成周。」休又成事，稣宾章、马四匹、吉金，用乍彝。颂其万年无疆，日天子令，子子孙孙永宝用。";

describe("inscription pipeline", () => {
  it("runs forward and reverse paths together", () => {
    const result = expectReady(
      runInscriptionPipeline(inscription, {
        steps: 3,
        target: { mustContainThree: true, preferOracleTone: true },
      })
    );

    expect(result.analysis.containsThree).toBe(true);
    expect(result.entryWarning).toBe(INSCRIPTION_EXPERIMENT_WARNING);
    expect(result.entryWarning).toContain("不是真实的故事");
    expect(result.entryWarning).toContain("探索游戏");
    expect(result.forward.memory).toBeGreaterThan(0);
    expect(result.reverse.convergenceScore).toBeGreaterThan(0.6);
    expect(result.reverse.hypothesisMeta.isNewHypothesis).toBe(true);
    expect(["working", "strong"]).toContain(
      result.reverse.hypothesisMeta.confidenceBand
    );
    expect(result.trajectory).toHaveLength(3);
    expect(result.trajectory[0].step).toBe(1);
    expect(result.trajectory[0].growth.worldFeatureDensity).toBeGreaterThan(0);
    expect(result.trajectory[0].growth.storyHumanCoupling).toBeGreaterThan(0);
    expect(result.trajectory[0].growth.learningPulse).toBeGreaterThan(0);
    expect(result.trajectory[0].optimization.reason).toBe("initial");
    expect(result.optimization.acceptedSteps).toBeGreaterThan(0);
    expect(result.optimization.bestScore).toBeGreaterThan(0);
    expect(result.growth.storyHumanCoupling).toBeGreaterThan(0);
    expect(result.growth.learningPulse).toBeGreaterThan(0);
    expect(result.trajectory[2].target.mustContainThree).toBe(true);
  });

  it("preserves custom reverse profile across co-iteration", () => {
    const result = expectReady(
      runInscriptionPipeline(inscription, {
        steps: 2,
        target: {
          mustContainThree: true,
          preferOracleTone: true,
          profile: {
            thresholds: {
              working: 0.97,
              strong: 0.99,
            },
          },
        },
      })
    );

    expect(result.reverse.hypothesisMeta.confidenceBand).toBe("exploratory");
    expect(result.trajectory[0].target.profile?.thresholds?.working).toBe(0.97);
    expect(result.trajectory[1].target.profile?.thresholds?.strong).toBe(0.99);
  });

  it("preserves profilePreset across co-iteration", () => {
    const result = expectReady(
      runInscriptionPipeline(inscription, {
        steps: 2,
        target: {
          mustContainThree: true,
          preferOracleTone: true,
          profilePreset: "strict",
        },
      })
    );

    expect(result.trajectory[0].target.profilePreset).toBe("strict");
    expect(result.trajectory[1].target.profilePreset).toBe("strict");
  });

  it("records damped steps when minGain is very strict", () => {
    const result = expectReady(
      runInscriptionPipeline(inscription, {
        steps: 3,
        optimizer: {
          minGain: 0.99,
          damping: 0.9,
        },
        target: {
          mustContainThree: true,
          preferOracleTone: true,
          profilePreset: "oracle",
        },
      })
    );

    expect(result.optimization.rejectedSteps).toBeGreaterThanOrEqual(1);
    expect(
      result.trajectory.some((step) => step.optimization.reason === "damped")
    ).toBe(true);
  });

  it("blocks execution when acknowledgement is required but missing", () => {
    const result = runInscriptionPipeline(inscription, {
      safety: {
        requireAcknowledgement: true,
      },
    });

    expect(result.blocked).toBe(true);
    if (!result.blocked) {
      throw new Error("Expected blocked pipeline result");
    }
    expect(result.entryWarning).toBe(INSCRIPTION_EXPERIMENT_WARNING);
    expect(result.blockedReason).toBe(INSCRIPTION_ACK_REQUIRED_WARNING);
  });
});
