import axios from "axios";
import Docker from "dockerode";
import * as fs from "fs/promises";
import * as nodefs from "fs";
import { dir as makeTempDir } from "tmp-promise";
import * as path from "path";

const docker = new Docker({ socketPath: "/var/run/docker.sock" });

/**
 * ========== CONFIG ==========
 * Put these in your env (recommended), or edit defaults below.
 */
const METADATA_URI =
  process.env.SIP_METADATA_URI ||
  "https://moccasin-broad-kiwi-732.mypinata.cloud/ipfs/bafkreidk36gurq7w7o7ndpc5kiqggs6l4o642t6tfogf2chwxrt7pehnwa";

const DATA_AGENT_URL =
  process.env.DATA_AGENT_URL || "https://agentrunner.onrender.com";
const DATA_AGENT_KEY =
  process.env.DATA_AGENT_KEY || "crypto-ohlcv-secret-key-2024";

const SYMBOL = process.env.SIP_SYMBOL || "btc";        // e.g. btc, eth, sol
const TIMEFRAME = process.env.SIP_TIMEFRAME || "1d";   // e.g. 5m, 1h, 1d

const PY_IMAGE = process.env.PY_IMAGE || "python:3.10-slim";

/**
 * Fetch OHLCV from your teammate’s API.
 * Expects: GET /ohlcv?symbol=btc&timeframe=1d with Bearer token.
 */
async function fetchOHLCV(symbol: string, timeframe: string) {
  const url = `${DATA_AGENT_URL}/ohlcv?symbol=${encodeURIComponent(
    symbol
  )}&timeframe=${encodeURIComponent(timeframe)}`;
  const r = await axios.get(url, {
    headers: { Authorization: `Bearer ${DATA_AGENT_KEY}` },
    timeout: 20_000,
  });
  // Expected shape: [{t,o,h,l,c,v}, ...]
  if (!Array.isArray(r.data)) {
    throw new Error("Data Agent did not return an array for OHLCV");
  }
  return r.data;
}

async function ensureImage(image: string) {
  const images = await docker.listImages();
  const have = images.some((img) => (img.RepoTags || []).includes(image));
  if (have) return;
  await new Promise<void>((resolve, reject) => {
    docker.pull(image, (err, stream) => {
      if (err) return reject(err);
      docker.modem.followProgress(stream, (e: any) => (e ? reject(e) : resolve()));
    });
  });
}

/**
 * Main runner:
 * - pulls metadata JSON -> meta.code (IPFS URL)
 * - downloads main.py
 * - fetches OHLCV
 * - writes /app/input.json into the mounted temp dir
 * - runs python container with INPUT_JSON
 * - captures logs, tries to parse {decision: "..."}
 */
export async function runPythonAgent() {
  const tmp = await makeTempDir({ unsafeCleanup: true });
  try {
    console.log("➡️  Fetching metadata:", METADATA_URI);
    const meta = (await axios.get(METADATA_URI, { timeout: 15_000 })).data;
    if (!meta?.code) throw new Error("metadata missing 'code' field (IPFS URL)");

    // 1) Download Python agent
    const codePath = path.join(tmp.path, "main.py");
    console.log("⬇️  Downloading agent code:", meta.code);
    const res = await axios.get(meta.code, { responseType: "stream", timeout: 30_000 });
    await new Promise<void>((resolve, reject) => {
      const writer = nodefs.createWriteStream(codePath);
      res.data.pipe(writer);
      writer.on("finish", () => resolve());
      writer.on("error", (e) => reject(e));
    });

    // 2) Get OHLCV from Data Agent
    console.log(`📡 Fetching OHLCV from Data Agent: ${SYMBOL}, ${TIMEFRAME}`);
    const ohlcv = [
      {"t": 1717209600000, "o": 68000, "h": 68500, "l": 67500, "c": 68250, "v": 1234},
      {"t": 1717296000000, "o": 68250, "h": 69000, "l": 68000, "c": 68880, "v": 1420}
    ];

    // 3) Write input.json that the Python code will read
    const inputPath = path.join(tmp.path, "input.json");
    await fs.writeFile(
      inputPath,
      JSON.stringify({ symbol: SYMBOL, timeframe: TIMEFRAME, ohlcv }, null, 0),
      "utf8"
    );
    console.log("📝 Wrote OHLCV to", inputPath);

    // 4) Ensure python image present
    await ensureImage(PY_IMAGE);

    // 5) Run Python in Docker (network disabled; input provided via file)
    console.log("🐳 Running python agent in Docker…");
    const container = await docker.createContainer({
      Image: PY_IMAGE,
      Cmd: ["python", "/app/main.py"],
      WorkingDir: "/app",
      Env: ["INPUT_JSON=/app/input.json"],
      HostConfig: {
        Binds: [`${tmp.path}:/app:ro`], // read-only in container
        NetworkMode: "none",
        Memory: 512 * 1024 * 1024,
        AutoRemove: true,
      },
      AttachStdout: true,
      AttachStderr: true,
    });

    const stream = await container.attach({ stream: true, stdout: true, stderr: true });
    let logs = "";
    stream.on("data", (chunk) => (logs += chunk.toString()));

    await container.start();
    const result = await container.wait();
    const exitCode = result.StatusCode;

    console.log("📤 Container exit code:", exitCode);
    console.log("──── AGENT LOGS ────\n" + logs + "\n────────────────────");

    // 6) Try to parse the last JSON line from stdout as the decision
    let decision: string | null = null;
    const lines = logs.trim().split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const obj = JSON.parse(lines[i]);
        if (obj && typeof obj === "object" && obj.decision) {
          decision = String(obj.decision);
          break;
        }
      } catch (_) {}
    }

    return {
      success: exitCode === 0,
      exitCode,
      decision,
      logs,
    };
  } catch (err: any) {
    console.error("❌ Error:", err.message);
    return { success: false, error: err.message };
  } finally {
    await tmp.cleanup();
  }
}

// Auto-run when called directly
(async () => {
  const result = await runPythonAgent();
  console.log("✅ Final Result:", result);
})();
