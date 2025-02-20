const { exec } = require('child_process');
const inquirer = require('inquirer');
const commitizen = require('commitizen');

// Function to execute a Git command
const runCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
      } else {
        resolve(stdout.trim());
      }
    });
  });
};

// Function to run Commitizen for rewording commit messages
const runCommitizen = () => {
  return new Promise((resolve, reject) => {
    commitizen.configLoader.load().then((config) => {
      const adapterConfig = require(config.path);
      adapterConfig.prompter(inquirer, resolve);
    }).catch(reject);
  });
};

// Function to rebase and rewrite commit messages
const rebaseAndProcessCommits = async () => {
  try {
    // Fetch all branches
    await runCommand('git fetch --all');

    // Checkout to the main branch
    await runCommand('git checkout main');

    // Start interactive rebase from root
    // await runCommand('git rebase -i --root');

    // Get the list of commits to rebase
    const commits = await runCommand('git log --reverse --format=%H');

    // Split commits into an array
    const commitArray = commits.split('\n');

    // Process each commit
    for (const commit of commitArray) {
      // Checkout the commit
      await runCommand(`git checkout ${commit}`);

      // Reword commit message using Commitizen
      await runCommitizen();

      // Amend the commit with the new message
      await runCommand('git commit --amend --no-edit');

      // Continue rebase
      await runCommand('git rebase --continue');
    }

    console.log('All commit messages have been processed using Commitizen!');
  } catch (error) {
    console.error('Error processing commit messages:', error.message);
    await runCommand('git rebase --abort');
  }
};

// Run the rebase and process commits function
rebaseAndProcessCommits();
