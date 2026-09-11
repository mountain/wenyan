import fs from "fs";
import path from "path";
import commander from "commander";
import findUp from "find-up";
import { version } from "./version";
import { compile, evalCompiled, runInscriptionPipeline } from "./parser";
import { render, unrender } from "./render";
import { outputHanziWrapper } from "./execute";

var readline;
var rl;
var inpHistory = [];
var inpHistoryPtr = -1;

var Logo = ` ,_ ,_\n \\/ ==\n /\\ []\n`;
const MODULE_LIBRARY_NAME = "藏書樓";
const DEFAULT_INSCRIPTION_ACK_PHRASE = "我确认这不是真实故事，只是探索游戏";
const INSCRIPTION_ACK_PHRASE =
  process.env.WENYAN_INSCRIPTION_ACK_PHRASE?.trim() ||
  DEFAULT_INSCRIPTION_ACK_PHRASE;

const program = new commander.Command();
program
  .version(version, "-v, --version", "Output the version")
  .name("wenyan")
  .arguments("[files...]")
  .action((files) => {
    if (!files) {
      program.files = [];
    } else if (!Array.isArray(files)) {
      program.files = [files];
    } else {
      program.files = files;
    }
  })
  .option(
    "-l, --lang <lang>",
    'Target language, can be "js", "py" or "rb"',
    "js"
  )
  .option("-c, --compile", "Output the compiled code instead of executing it")
  .option("-e, --eval <code>", "Evaluate script")
  .option("-i, --interactive", "Interactive REPL")
  .option(
    "-o, --output [file]",
    "Output compiled code or executing result to file"
  )
  .option("-r, --render", "Outputs renderings")
  .option(
    "--roman [method]",
    'Romanize identifiers. The method can be "pinyin", "baxter" or "unicode"'
  )
  .option("--strict", "Enable static typechecking", false)
  .option("--allowHttp", "Allow to import from http", false)
  .option("--dir <path>", "Directory to importing from, seprates with comma(,)")
  .option("--no-outputHanzi", "Don't convert output to hanzi", false)
  .option("--log <file>", "Save log to file")
  .option("--title <title>", "Override title in rendering")
  .option(
    "--inscription",
    "Run inscription exploration pipeline instead of compiling Wenyan source",
    false
  )
  .option(
    "--ack-experiment",
    "Acknowledge that inscription output is an exploration game, not a real story",
    false
  )
  .option(
    "--inscription-ack-text <text>",
    "Exact acknowledgement phrase for inscription mode"
  )
  .option(
    "--inscription-ack-from-file <path>",
    "Read inscription acknowledgement phrase from a file"
  )
  .option(
    "--print-inscription-ack-phrase",
    "Print the current inscription acknowledgement phrase and exit",
    false
  )
  .option(
    "--inscription-output <mode>",
    'Inscription output mode: "pretty" or "compact"',
    "pretty"
  )
  .option(
    "--inscription-steps <n>",
    "Inscription pipeline iteration steps",
    "3"
  )
  .option(
    "--inscription-profile <name>",
    'Inscription profile preset: "seed", "oracle", or "strict"',
    "seed"
  )
  .option(
    "--inscription-min-gain <n>",
    "Inscription optimizer minimum gain threshold",
    "0.005"
  )
  .option(
    "--inscription-damping <n>",
    "Inscription optimizer damping factor in [0, 1]",
    "0.85"
  )
  .helpOption("-h, --help", "Display help");

const emptyCall = process.argv.length <= 2;
const showHelp = process.argv.includes("-h") || process.argv.includes("--help");

if (emptyCall || showHelp) {
  program.outputHelp((help) => {
    if (!help) return "";
    let text = "\n";
    text += Logo;
    text += `\nWENYAN LANG 文言 Compiler v${version}\n\n`;
    text += help;
    text += "\n";
    text += "Inscription Experiment:\n";
    text += "  - This mode is an exploration game, not a real story.\n";
    text += "  - You must pass --ack-experiment to run it.\n";
    text += `  - Or pass --inscription-ack-text ${shellDoubleQuote(
      INSCRIPTION_ACK_PHRASE
    )}.\n`;
    text += "  - Or pass --inscription-ack-from-file <path>.\n";
    text += "  - Example:\n";
    text +=
      "    wenyan --inscription --ack-experiment --inscription-profile oracle --inscription-steps 3 --eval '隹三年五月丁巳，王在宗周。'\n\n";
    return text;
  });
  process.exit();
}

program.parse(process.argv);

(async () => {
  if (program.printInscriptionAckPhrase) {
    console.log(INSCRIPTION_ACK_PHRASE);
    return;
  }

  preprocess();

  if (program.compile) {
    output(getCompiled());
  } else if (program.render) {
    doRender();
  } else if (program.interactive) {
    await interactive();
  } else if (program.inscription) {
    await execInscription();
  } else {
    await exec();
  }
})().catch((e) => {
  console.error(e);
});

// ====== Utils ======

function preprocess() {
  if (
    program.inscription &&
    (program.compile || program.render || program.interactive)
  ) {
    console.error(
      "--inscription cannot be combined with --compile, --render, or --interactive."
    );
    process.exit(1);
  }

  if (program.inscriptionAckText && program.inscriptionAckFromFile) {
    console.error(
      "--inscription-ack-text cannot be combined with --inscription-ack-from-file."
    );
    process.exit(1);
  }

  if (!program.output && program.render) {
    // render always outputs
    program.output = true;
  }

  if (program.output == true) {
    // only set --option but not the path
    if (!program.files.length) {
      console.error("Can not write to undefined path");
      process.exit(1);
    }
    let base = program.files[0].split(".").slice(0, -1).join(".");
    if (program.compile) program.output = `${base}.${program.lang}`;
    else if (program.render) program.output = `${base}.svg`;
    else if (program.inscription) program.output = `${base}.inscription.json`;
    else program.output = `${base}.log`;
  }

  if (program.roman == true) {
    program.roman = "pinyin";
  }
}

function getCompiled() {
  const source = getSource();

  return compile(source, {
    ...getCompileOptions(),
  });
}

function getImportPaths() {
  const pathes = [];
  if (program.dir) {
    pathes.push(...program.dir.split(","));
  }

  const moduleLib = findModuleLibrary();
  if (moduleLib) pathes.push(moduleLib);

  pathes.push(...program.files.map((file) => path.resolve(path.dirname(file))));
  pathes.push(path.resolve("."));
  return Array.from(new Set(pathes));
}

function findModuleLibrary() {
  return findUp.sync(MODULE_LIBRARY_NAME, { type: "directory" });
}

function getCompileOptions() {
  return {
    lang: program.lang,
    romanizeIdentifiers: program.roman,
    strict: !!program.strict,
    allowHttp: !!program.allowHttp,
    importPaths: getImportPaths(),
    logCallback: logHandler(program.log, "a"),
    errorCallback: function (x) {
      console.error(x);
      process.exit();
    },
  };
}

function resolvePath(x) {
  return path.resolve(x);
}

function getSource() {
  let scripts = program.files
    .map((x) =>
      x.endsWith(".svg")
        ? unrender([fs.readFileSync(resolvePath(x)).toString()])
        : fs.readFileSync(resolvePath(x)).toString()
    )
    .join("\n");

  if (program.eval) scripts += `\n${program.eval}`;

  return scripts;
}

function output(data) {
  if (program.output == undefined) return console.log(data);
  else fs.writeFileSync(resolvePath(program.output), data, "utf-8");
}

function getTitle() {
  var title = program.title;
  if (!title && typeof program.output === "string")
    title = program.output.split(".").slice(0, -1).join(".");
  if (!title && program.files.length)
    title = program.files[0].split(".").slice(0, -1).join(".");
  return title;
}

function doRender() {
  var svgs = render(getTitle(), getSource(), { plotResult: false });

  var outputEndsWithSvg = program.output.toLowerCase().endsWith(".svg");

  // only one page rendered
  if (svgs.length === 1) {
    if (!outputEndsWithSvg) program.output += ".svg";
    var filepath = resolvePath(program.output);
    fs.writeFileSync(filepath, svgs[0]);
    console.log(filepath); // Outputs generated filename
  }
  // multiple pages rendered, output file as `filename.001.svg` etc
  else {
    if (outputEndsWithSvg) program.output = program.output.slice(0, -4); // remove .svg suffix

    for (var i = 0; i < svgs.length; i++) {
      var filepath = resolvePath(
        `${program.output}.${i.toString().padStart(3, "0")}.svg`
      );
      fs.writeFileSync(filepath, svgs[i]);
      console.log(filepath); // Outputs generated filename
    }
  }
}

function interactive() {
  if (program.lang !== "js") {
    console.error(
      `Target language "${program.lang}" is not supported for interactive mode.`
    );
    process.exit(1);
  }
  replscope();
  repl(getCompiled());
}

function execInscription() {
  const source = getSource();
  const profile = String(program.inscriptionProfile || "seed");
  const allowedProfiles = ["seed", "oracle", "strict"];
  if (!allowedProfiles.includes(profile)) {
    console.error(
      `Unknown inscription profile "${profile}". Use one of: ${allowedProfiles.join(
        ", "
      )}.`
    );
    process.exit(1);
  }

  const outputMode = String(program.inscriptionOutput || "pretty");
  const allowedOutputModes = ["pretty", "compact"];
  if (!allowedOutputModes.includes(outputMode)) {
    console.error(
      `Unknown inscription output mode "${outputMode}". Use one of: ${allowedOutputModes.join(
        ", "
      )}.`
    );
    process.exit(1);
  }

  const steps = parsePositiveIntOrExit(
    program.inscriptionSteps,
    "--inscription-steps"
  );
  const minGain = parseUnitFloatOrExit(
    program.inscriptionMinGain,
    "--inscription-min-gain"
  );
  const damping = parseUnitFloatOrExit(
    program.inscriptionDamping,
    "--inscription-damping"
  );

  const ackByFlag = !!program.ackExperiment;
  const ackText = resolveAckTextInput();
  const ackByPhrase = isAckPhraseAccepted(ackText);
  const acknowledged = ackByFlag || ackByPhrase;

  const result = runInscriptionPipeline(source, {
    steps,
    optimizer: {
      minGain,
      damping,
    },
    target: {
      profilePreset: profile as "seed" | "oracle" | "strict",
    },
    safety: {
      requireAcknowledgement: true,
      acknowledged,
    },
  });

  if (result.blocked) {
    console.error(result.entryWarning);
    console.error(result.blockedReason);
    console.error("hint: rerun with --ack-experiment to continue.");
    console.error(
      `hint: or pass --inscription-ack-text ${shellDoubleQuote(
        INSCRIPTION_ACK_PHRASE
      )}.`
    );
    console.error("hint: or pass --inscription-ack-from-file <path>.");
    console.error(
      "example: wenyan --inscription --ack-experiment --eval '隹三年五月丁巳，王在宗周。'"
    );
    process.exit(1);
  }

  output(formatInscriptionOutput(result, outputMode));
}

function resolveAckTextInput() {
  if (program.inscriptionAckFromFile) {
    const filePath = resolvePath(String(program.inscriptionAckFromFile));
    try {
      const raw = fs.readFileSync(filePath, "utf-8");
      const normalized = stripUtf8Bom(raw);
      if (!normalized.trim()) {
        console.error(
          `Invalid --inscription-ack-from-file "${filePath}": file is empty or whitespace only.`
        );
        process.exit(1);
      }
      return normalized;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(
        `Failed to read --inscription-ack-from-file "${filePath}": ${msg}`
      );
      process.exit(1);
    }
  }
  return program.inscriptionAckText;
}

function stripUtf8Bom(s: string) {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

function shellDoubleQuote(s: string) {
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

function isAckPhraseAccepted(raw: any) {
  if (raw === undefined || raw === null) {
    return false;
  }
  return String(raw).trim() === INSCRIPTION_ACK_PHRASE;
}

function formatInscriptionOutput(data: unknown, mode: string) {
  return mode === "compact"
    ? JSON.stringify(data)
    : JSON.stringify(data, null, 2);
}

function parsePositiveIntOrExit(x: any, flagName: string) {
  const n = Number(x);
  if (!Number.isFinite(n) || !Number.isSafeInteger(n) || n < 1) {
    console.error(
      `Invalid ${flagName} value: "${x}". Expected a positive integer.`
    );
    process.exit(1);
  }
  return n;
}

function parseUnitFloatOrExit(x: any, flagName: string) {
  const n = Number(x);
  if (!Number.isFinite(n) || n < 0 || n > 1) {
    console.error(
      `Invalid ${flagName} value: "${x}". Expected a number in [0, 1].`
    );
    process.exit(1);
  }
  return n;
}

function exec() {
  if (program.lang !== "js") {
    console.error(
      `Target language "${program.lang}" is not supported for direct executing. Please use --compile option instead.`
    );
    process.exit(1);
  }
  evalCompiled(getCompiled(), {
    outputHanzi: program["outputHanzi"],
    lang: program.lang,
  });
}

function replscope() {
  function generate(depth) {
    var s0 = "global.__scope=new function(){\n";
    var s1 = "\n}";
    for (var i = 0; i < depth; i++) {
      var istr = "__" + ("" + i).padStart(8, "0");
      s0 += `this.evil=function(${istr}){global.__scope=this;var __r=eval(${istr});\n`;
      s1 = `;return __r}` + s1;
    }
    return eval(s0 + s1);
  }
  var stackCallSize = 1000;
  for (var i = stackCallSize; i > 0; i -= 200) {
    try {
      generate(i);
      stackCallSize = i;
      break;
    } catch (e) {
      //console.log(i+ " exceeds max stack size");
    }
  }
  // console.log("final stack size "+stackCallSize);
}

function repl(prescript?: string) {
  if (!readline) {
    readline = require("readline");
    process.stdin.setMaxListeners(100000000000000);
    process.stdin.on("data", function (e) {
      var esc = JSON.stringify(e.toString());
      if (esc == `"\\u001b[A"`) {
        if (inpHistoryPtr == -1) {
          inpHistoryPtr = inpHistory.length;
        }
        if (inpHistory.length) {
          inpHistoryPtr =
            (inpHistoryPtr - 1 + inpHistory.length) % inpHistory.length;
        }
        rl.write(null, { ctrl: true, name: "u" });
        rl.write(inpHistory[inpHistoryPtr]);
      } else if (esc == `"\\u001b[B"`) {
        if (inpHistoryPtr == -1) {
          inpHistoryPtr = inpHistory.length;
        }
        if (inpHistory.length) {
          inpHistoryPtr = (inpHistoryPtr + 1) % inpHistory.length;
        }
        rl.write(null, { ctrl: true, name: "u" });
        rl.write(inpHistory[inpHistoryPtr]);
      }
    });
  }
  // console.log(JSON.stringify(inpHistory))
  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  if (prescript) {
    var old_log = console.log;
    try {
      console.log = outputHanziWrapper(console.log, program.outputHanzi);
      // @ts-ignore
      global.__scope.evil(prescript);
      console.log = old_log;
    } catch (e) {
      console.log = old_log;
      console.log(e);
    }
  }

  // @ts-ignore
  global.haserr = false;
  rl.question("> ", (inp) => {
    // console.log(JSON.stringify(inp))
    var out = compile(inp, {
      lang: "js",
      romanizeIdentifiers: program.roman,
      logCallback: logHandler(null, "a"),
      errorCallback: function (x) {
        console.error(x);
        // @ts-ignore
        global.haserr = true;
      },
    });
    // @ts-ignore
    if (global.haserr) {
    }
    if (inp.length) {
      inpHistory.push(inp);
    }
    rl.close();
    repl(out);
    inpHistoryPtr = -1;
  });
}

function logHandler(f, mode) {
  if (!f) {
    return () => 0;
  }

  if (f == "/dev/stdout") {
    return (x) =>
      typeof x == "string"
        ? console.log(x)
        : console.dir(x, { depth: null, maxArrayLength: null });
  }

  if (f == "/dev/stderr") {
    return console.error;
  }

  if (mode == "a") {
    return (x) => {
      fs.appendFileSync(
        resolvePath(f),
        (typeof x == "object" ? JSON.stringify(x) : x.toString()) + "\n"
      );
    };
  }

  if (mode == "w") {
    return (x) => {
      fs.writeFileSync(
        resolvePath(f),
        (typeof x == "object" ? JSON.stringify(x) : x.toString()) + "\n"
      );
    };
  }
}
