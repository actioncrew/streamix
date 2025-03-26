import { exec } from "child_process";
import { promisify } from "util";

const execPromise = promisify(exec);

// Interval in milliseconds (e.g., 10 minutes = 600000 ms)
const CHECK_INTERVAL = () => Math.random() * 20 * 60 * 1000;

async function checkNpmVersion() {
  try {
    await execPromise("rd /s /q node_modules");
  } catch {}
  try {
    await execPromise("del /f /q package-lock.json");
  } catch {}
  try {
    await execPromise("npm i");
  } catch {}
}

// Run immediately, then set an interval
async function scheduleCheck() {
  await checkNpmVersion();
  let interval = CHECK_INTERVAL();
  console.log(`pause for ${interval / (60 * 1000)} minutes...`, )
  setTimeout(scheduleCheck, interval);
}

// Start the loop
scheduleCheck();
