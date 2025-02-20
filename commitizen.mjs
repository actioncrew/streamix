import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

async function runCommand(command, options = {}) { // Added options
  try {
    const { stdout, stderr } = await execAsync(command, options); // Pass options to execAsync
    if (stderr && !stderr.includes('Switched to branch') && !stderr.includes('already exists')) { // Ignore "branch exists"
      console.error('Command stderr:', stderr);
    }
    return stdout.trim();
  } catch (error) {
    console.error(`Error executing command: ${command}`, error);
    throw error;
  }
}

async function getFirstCommit() {
  const firstCommit = await runCommand('git log --reverse --format="%H" HEAD | tail -n 1');
  return firstCommit;
}

async function copyCommitsToNewBranch(endCommit, newBranch) {
  const originalBranch = await runCommand('git rev-parse --abbrev-ref HEAD');

  try {
    const firstCommit = await getFirstCommit();
    const commits = await runCommand(`git rev-list --reverse ${firstCommit}..${endCommit}`);
    const commitArray = [firstCommit, ...commits.split('\n').filter(c => c)]; // Filter out empty strings

    // Create and checkout new branch
    await runCommand(`git branch -D ${newBranch}`, { force: true }); // Force delete if it exists
    await runCommand(`git checkout --orphan ${newBranch}`);
    await runCommand('git reset --hard');

    for (const commit of commitArray) {
      try {
        await runCommand(`git cherry-pick ${commit}`);

        const gitMessage = await runCommand(`git show -s --format=%B ${commit}`);
        const newMessage = `Refactored: ${gitMessage}`;
        const sanitizedMessage = newMessage.replace(/"/g, '\\"').replace(/`/g, '\\`');

        await runCommand(`git commit --amend -m "${sanitizedMessage}" --no-verify`);

      } catch (cherryPickError) { // Handle conflicts
        console.error(`Conflict during cherry-pick of ${commit}:`, cherryPickError);

        // Resolve conflicts manually or automatically (example: using 'ours')
        // await runCommand('git checkout --ours .'); // Keep our changes
        // or
        // await runCommand('git checkout --theirs .'); // Keep their changes
        // or edit the files manually

        // After resolving conflicts, stage the changes
        await runCommand('git add .');

        // Continue the cherry-pick after resolving the conflicts
        await runCommand('git cherry-pick --continue');

        // Amend the commit message (now that conflict is resolved)
        const gitMessage = await runCommand(`git show -s --format=%B ${commit}`);
        const newMessage = `Refactored: ${gitMessage}`;
        const sanitizedMessage = newMessage.replace(/"/g, '\\"').replace(/`/g, '\\`');
        await runCommand(`git commit --amend -m "${sanitizedMessage}" --no-verify`);
      }
    }

    console.log(`Successfully copied commits to ${newBranch}`);
    await runCommand(`git checkout ${originalBranch}`);

  } catch (error) {
    console.error('Error during commit copying:', error);
    await runCommand(`git checkout ${originalBranch}`); // Ensure we switch back
    throw error;
  }
}

copyCommitsToNewBranch('HEAD', 'rebase-automated');
