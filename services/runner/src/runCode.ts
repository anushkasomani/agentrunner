// import axios from "axios";
// import Docker from "dockerode";
// import * as fs from "fs-extra";
// import { dir as makeTempDir } from "tmp-promise";
// import * as path from "path";
// import * as nodefs from "fs";

// const docker = new Docker();

// export async function runPythonAgent(metadataUri: string) {
//   const tmp = await makeTempDir({ unsafeCleanup: true });
//   try {
//     // 1) Fetch metadata
//     const meta = (await axios.get(metadataUri)).data;
//     if (!meta.code) throw new Error("metadata missing 'code' field");

//     // 2) Download code file from IPFS
//     const codePath = path.join(tmp.path, "main.py");
//     const res = await axios.get(meta.code, { responseType: "stream" });
//     const writer = fs.createWriteStream(codePath);
//     await new Promise((resolve, reject) => {
//       res.data.pipe(writer);
//       writer.on("finish", resolve);
//       writer.on("error", reject);
//     });

//     // 3) Run it inside Docker
//     const container = await docker.createContainer({
//       Image: "python:3.10-slim",
//       Cmd: ["python", "/app/main.py"],
//       WorkingDir: "/app",
//       HostConfig: {
//         Binds: [`${tmp.path}:/app:ro`],
//         NetworkMode: "none",
//         Memory: 512 * 1024 * 1024,
//         AutoRemove: true,
//       },
//       AttachStdout: true,
//       AttachStderr: true,
//     });

//     const stream = await container.attach({ stream: true, stdout: true, stderr: true });
//     let logs = "";
//     stream.on("data", (chunk) => (logs += chunk.toString()));

//     await container.start();
//     const exitData = await container.wait();

//     return {
//       success: exitData.StatusCode === 0,
//       logs,
//       exitCode: exitData.StatusCode,
//     };
//   } catch (err: any) {
//     return { success: false, error: err.message };
//   } finally {
//     await tmp.cleanup();
//   }
// }

// runPythonAgent("https://moccasin-broad-kiwi-732.mypinata.cloud/ipfs/bafkreid5nkjp2exxkka6qczc3aukwyldalsgpnij7gh4b3qh4rskh7h4tu").then((result) => {
//   console.log(result);
// });

import axios from "axios";
import Docker from "dockerode";
import fsExtra from "fs-extra";
import * as nodefs from "fs";
import { dir as makeTempDir } from "tmp-promise";
import * as path from "path";

const docker = new Docker();

// 👇 Put your metadata URI here
const METADATA_URI = "https://moccasin-broad-kiwi-732.mypinata.cloud/ipfs/bafkreidyzpalwd7r4xlnrdxqnye3zywao4ocuufnnkpyx3hdnobscitaxu";

export async function runPythonAgent() {
  const tmp = await makeTempDir({ unsafeCleanup: true });
  try {
    console.log("Fetching metadata from:", METADATA_URI);
    const meta = (await axios.get(METADATA_URI)).data;

    if (!meta.code) throw new Error("metadata missing 'code' field");

    // 1️⃣ Download the Python code file from IPFS
    const codePath = path.join(tmp.path, "main.py");
    console.log("Downloading code from:", meta.code);

    const res = await axios.get(meta.code, { responseType: "stream" });
    const writer = nodefs.createWriteStream(codePath);
    await new Promise((resolve, reject) => {
      res.data.pipe(writer);
      writer.on("finish", resolve);
      writer.on("error", reject);
    });

    // 2️⃣ Read and log the downloaded code
    // const codeContent = nodefs.readFileSync(codePath, "utf8");
    // console.log("\n📄 DOWNLOADED CODE TO RUN:");
    // console.log("=" .repeat(60));
    // console.log(codeContent);
    // console.log("=" .repeat(60) + "\n");

    // 3️⃣ Run the code inside a Python Docker container
    console.log("Running code in Docker sandbox...");

    const container = await docker.createContainer({
      Image: "python:3.10-slim",
      Cmd: ["python", "/app/main.py"],
      WorkingDir: "/app",
      HostConfig: {
        Binds: [`${tmp.path}:/app:ro`], // mount read-only
        NetworkMode: "none",
        Memory: 512 * 1024 * 1024, // 512 MB
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
    console.log("Execution finished with code:", exitCode);
    console.log("------ OUTPUT LOGS ------\n" + logs + "\n--------------------------");

    return {
      success: exitCode === 0,
      exitCode,
      logs,
    };
  } catch (err: any) {
    console.error("Error running agent:", err.message);
    return { success: false, error: err.message };
  } finally {
    await tmp.cleanup();
  }
}

// 🧩 Automatically run when file is executed
(async () => {
  const result = await runPythonAgent();
  console.log("Final Result:", result);
})();
