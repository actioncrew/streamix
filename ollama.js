import axios from 'axios';
import { execSync } from 'child_process';
import fs from 'fs';

const OLLAMA_URL = "http://localhost:11434/api/generate";
const MODEL_NAME = "deepseek-r1:7b";

// Fetch all commits from the main branch
async function getMainBranchCommits() {
    try {
        const commitOutput = execSync('git log --pretty=format:"%H|%an|%s" main', { encoding: 'utf-8' });
        return commitOutput.trim().split('\n').map(line => {
            const [hash, author, message] = line.split('|');
            return { hash, author, message };
        });
    } catch (error) {
        console.error("Error getting main branch commits:", error);
        return [];
    }
}

// Fetch local tags and their associated commits
async function getLocalTags() {
    try {
        const tagOutput = execSync('git show-ref --tags', { encoding: 'utf-8' });
        const tags = tagOutput.trim().split('\n').map(line => {
            const [hash, ref] = line.split(' ');
            const tagName = ref.replace('refs/tags/', '');
            return { hash, tagName };
        });
        return tags;
    } catch (error) {
        console.error("Error getting local tags:", error);
        return [];
    }
}

// Get Git log and diff for a specific commit
async function getGitLog(commit) {
    try {
        const logOutput = execSync(`git log --pretty=format:"%H|%an|%s" -n 1 ${commit}`, { encoding: 'utf-8' });
        const [hash, author, message] = logOutput.trim().split('|');

        try {
            const diff = await getGitDiff(`${commit}~1`, commit);
            return { hash, author, message, diff };
        } catch (err) {
            return { hash, author, message };
        }
    } catch (error) {
        console.error(`Error getting git log for commit ${commit}:`, error);
        return {};
    }
}

// Get Git diff between two commits
async function getGitDiff(commit1, commit2) {
    try {
        return execSync(`git diff ${commit1} ${commit2}`, { encoding: 'utf-8' });
    } catch (error) {
        console.error(`Error getting git diff between ${commit1} and ${commit2}:`, error);
        return "";
    }
}

// Generate a changelog entry for a commit using the LLM
async function generateChangelog(gitLogs) {
    const prompt = `
        The project is a reactive stream library written in TypeScript. Analyze the following git log and diff.
        Return structured JSON with keys: "hash", "brief", and "summary".

        Git Log:
        Hash: ${gitLogs.hash}
        Message: ${gitLogs.message}
        ${gitLogs.diff ? `Diff: ${gitLogs.diff}\n` : ''}

        Respond with valid JSON only. For "brief", use conventional commit format (e.g., "feat: add new feature", "fix: resolve bug").
        Example:
        {
            "hash": "<commit_hash>",
            "brief": "<max 100 symbols>",
            "summary": "<detailed summary>"
        }
    `;

    const data = {
        model: MODEL_NAME,
        prompt: prompt,
        stream: false,
    };

    try {
        const response = await axios.post(OLLAMA_URL, data);
        const responseText = response.data.response;

        // Validate and parse the JSON response
        try {
            const jsonResponse = JSON.parse(responseText);
            if (!jsonResponse.hash || !jsonResponse.brief || !jsonResponse.summary) {
                throw new Error("Invalid JSON structure");
            }
            return jsonResponse;
        } catch (parseError) {
            console.error("Error parsing LLM response as JSON:", parseError);
            return {
                hash: gitLogs.hash,
                brief: "Invalid response format",
                summary: "Failed to parse LLM response.",
            };
        }
    } catch (error) {
        console.error("Error communicating with Ollama:", error.message);
        return {
            hash: gitLogs.hash,
            brief: "Error generating summary",
            summary: "Failed to communicate with Ollama.",
        };
    }
}

// Generate a description for a tag using the LLM
async function generateTagDescription(tagName, commits) {
  const prompt = `
    You are an expert software engineer summarizing changes for a release of a reactive library Streamix written in TypeScript.
    Streamix is a **lightweight alternative to RxJS**, offering a streamlined approach to reactive programming
    through a simplified concept of streams and emissions. Built for modern, performance-driven applications,
    Streamix strikes a balance between simplicity and efficiency, boasting an ultra-light footprint of
    just **6 KB (zipped)**. For added convenience, a compact HTTP client is included as a separate package, weighing approximately **3 KB (zipped)**.

    Analyze the following list of commit messages for the release tag "${tagName}". Focus on the key changes and improvements made in this release.

    Commit messages:
    ${commits.map(commit => `- ${commit.message}`).join('\n')}

    Based on these commit messages, provide a concise and informative summary of the changes included in this release.

    Respond with valid JSON only. Example:
    {
      "tagName": "${tagName}",
      "description": "A short summary of the changes in this release."
    }`;

    const data = {
        model: MODEL_NAME,
        prompt: prompt,
        stream: false,
        "format": {
          "type": "object",
          "properties": {
            "tagName": {
              "type": "string"
            },
            "description": {
              "type": "string"
            }
          },
          "required": [
            "tagName",
            "description"
          ]
        }
    };

    try {
        const response = await axios.post(OLLAMA_URL, data);
        const responseText = response.data.response.trim();

        // Validate and parse the JSON response
        try {
            return JSON.parse(responseText);
        } catch (parseError) {
            console.error("Error parsing LLM response as JSON:", parseError);
            return {
                tagName: tagName,
                description: "Failed to generate tag description.",
            };
        }
    } catch (error) {
        console.error("Error communicating with Ollama:", error.message);
        return {
            tagName: tagName,
            description: "Failed to communicate with Ollama.",
        };
    }
}

// Get commits between two tags (or from the beginning if no previous tag)
async function getCommitsBetweenTags(prevTagHash, currentTagHash) {
  try {
      let logCommand = `git log --pretty=format:"%H|%an|%s" ${currentTagHash}`;
      if (prevTagHash) {
          logCommand += `...${prevTagHash}`;
      }
      const commitOutput = execSync(logCommand, { encoding: 'utf-8' });
      return commitOutput.trim().split('\n').map(line => {
          const [hash, author, message] = line.split('|');
          return { hash, author, message };
      }).reverse();
  } catch (error) {
      console.error(`Error getting commits between tags:`, error);
      return [];
  }
}

// Get commit time for tag
function getTagCommitTime(tagName) {
  try {
      const output = execSync(`git log -1 --pretty="%ct" ${tagName}`).toString().trim();
      const time = parseInt(output);
      return time;
  } catch (error) {
      console.error(`Error getting commit time for tag ${tagName}:`, error);
      return null;
  }
}

// Main function to generate the changelog
async function main() {
  const commits = (await getMainBranchCommits()).reverse();
  if (commits.length === 0) {
      console.log("No commits found or error occurred.");
      return;
  }

  const tags = await getLocalTags();
  const changelog = { versions: [] };

  // Sort tags by commit date (newest to oldest)
  const sortedTags = tags.filter(tag => getTagCommitTime(tag.tagName) !== null).sort((a, b) => {
      const timeA = getTagCommitTime(a.tagName);
      const timeB = getTagCommitTime(b.tagName);
      return timeA - timeB;
  });

  let previousTagHash = null;
  for (const tag of sortedTags) {
    const tagCommits = await getCommitsBetweenTags(previousTagHash, tag.hash);

    const tagDescription = await generateTagDescription(tag.tagName, tagCommits);
    const versionEntry = {
        tag: tag.tagName,
        description: tagDescription.description,
        commits: tagCommits.reverse().map(commit => commit.message),
    };

    changelog.versions.push(versionEntry);
    previousTagHash = tag.hash;
  }

  changelog.versions.reverse();
  // Save the changelog to a file
  fs.writeFileSync('summary_changelog.json', JSON.stringify(changelog, null, 2), { encoding: 'utf-8' });

  console.log("Changelog generated successfully. Saved to summary_changelog.json.");

  generateChangelogFromSummary();
  fs.rmSync('summary_changelog.json');
}

function generateChangelogFromSummary(summaryFilePath = 'summary_changelog.json', outputFilePath = './projects/libraries/streamix/CHANGELOG.md') {
  try {
    const summaryData = fs.readFileSync(summaryFilePath, 'utf-8');
    const summary = JSON.parse(summaryData);

    let changelogContent = '# Changelog\n\n';

    if (summary && summary.versions && Array.isArray(summary.versions)) {
      summary.versions.forEach(version => {
        changelogContent += `## ${version.tag}\n\n`;
        changelogContent += `${version.description}\n\n`;
      });
    } else {
      changelogContent += 'Invalid summary_changelog.json format.\n';
    }

    fs.writeFileSync(outputFilePath, changelogContent, 'utf-8');
    console.log(`Changelog generated successfully. Saved to ${outputFilePath}.`);
  } catch (error) {
    console.error('Error generating changelog:', error.message);
  }
}

main();
