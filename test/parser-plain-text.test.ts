import { compile, evalCompiled, wy2tokens } from "../src/parser";

const inscription =
  "隹三年五月丁巳，王在宗周，令「史颂稣，瀳友里君、百生，师隅盩于成周。」休又成事，稣宾章、马四匹、吉金，用乍彝。颂其万年无疆，日天子令，子子孙孙永宝用。";

describe("plain text fallback", () => {
  it("does not treat prose 又 as a standalone number token", () => {
    expect(wy2tokens("休又成事")).toEqual([["data", "休又成事", 4]]);
  });

  it("still allows numbers that intentionally start with 又", () => {
    expect(wy2tokens("又五絲")).toEqual([["num", "5e-4", 3]]);
  });

  it("compiles prose-only input into an output-producing program", () => {
    expect(compile(inscription, { lang: "js", logCallback: () => {} })).toBe(
      `console.log(${JSON.stringify(inscription)});`
    );
  });

  it("executes prose-only input and emits the original text", () => {
    const compiled = compile(inscription, {
      lang: "js",
      logCallback: () => {},
    });
    let output = "";
    evalCompiled(compiled, {
      lang: "js",
      scoped: true,
      output: (...args) => (output += args.join(" ") + "\n"),
    });
    expect(output).toBe(`${inscription}\n`);
  });
});
