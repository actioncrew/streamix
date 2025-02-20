import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runCommand(command) {
  try {
    const { stdout, stderr } = await execAsync(command);
    if (stderr && !stderr.includes('Switched to branch')) console.error('Command stderr:', stderr);
    return stdout.trim();
  } catch (error) {
    console.error(`Error executing command: ${command}`, error);
    throw error;
  }
}

async function getFirstCommit() {
  // This gets the very first commit in the repository
  const firstCommit = await runCommand('git rev-list --max-parents=0 HEAD');
  return firstCommit;
}

async function copyCommitsToNewBranch(endCommit, newBranch) {
  const originalBranch = await runCommand('git rev-parse --abbrev-ref HEAD');

  try {
    // Get the first commit
    const firstCommit = await getFirstCommit();

    // Get list of all commits from first to end commit
    const commits = await runCommand(
      `git rev-list --reverse ${firstCommit}..${endCommit}`
    );
    // Add the first commit to the beginning of our array
    const commitArray = [firstCommit, ...commits.split('\n')];

    // Create and checkout new branch from the initial state
    await runCommand(`git branch -D ${newBranch}`);
    await runCommand(`git checkout --orphan ${newBranch}`);
    await runCommand('git reset --hard'); // Clear the working directory

    for (const commit of commitArray) {
      // Cherry-pick the commit
      await runCommand(`git cherry-pick ${commit}`);

      // Get the original commit message
      const gitMessage = await runCommand(`git show -s --format=%B ${commit}`);

      // Generate and apply new commit message
      const newMessage = `Refactored: ${gitMessage}`; // Replace with your message logic
      const sanitizedMessage = newMessage.replace(/"/g, '\\"').replace(/`/g, '\\`');

      await runCommand(`git commit --amend -m "${sanitizedMessage}" --no-verify`);
    }

    console.log(`Successfully copied commits to ${newBranch}`);

    // Switch back to original branch
    await runCommand(`git checkout ${originalBranch}`);

  } catch (error) {
    console.error('Error during commit copying:', error);
    await runCommand(`git checkout ${originalBranch}`);
    throw error;
  }
}

copyCommitsToNewBranch('HEAD', 'rebase-automated')
