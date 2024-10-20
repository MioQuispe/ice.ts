import { exec } from 'child_process';
import { promises as fs } from 'fs';

type GitBugIssue = {
  id: string;
  title: string;
  state: string;
  author: string;
  description: string;
  comments?: Array<{
    author: string;
    content: string;
  }>;
};

/**
 * Executes a shell command and returns the output.
 * @param command - The command to execute.
 * @returns A promise that resolves with the command output.
 */
const runCommand = async (command: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`Command execution error: ${error.message}`));
        return;
      }
      if (stderr) {
        reject(new Error(`Command stderr: ${stderr}`));
        return;
      }
      resolve(stdout.trim());
    });
  });
};

/**
 * Converts the git-bug JSON output to Markdown format.
 * @param jsonFile - Path to the JSON file.
 * @param mdFile - Path to the output Markdown file.
 */
const convertJsonToMd = async (jsonFile: string, mdFile: string): Promise<void> => {
  const data = await fs.readFile(jsonFile, 'utf-8');
  const issues: ReadonlyArray<GitBugIssue> = JSON.parse(data);

  let markdown = '# Git-Bug Issues\n\n';

  issues.forEach((issue) => {
    markdown += `## ${issue.title}\n`;
    markdown += `**ID**: ${issue.id}\n`;
    markdown += `**State**: ${issue.state}\n`;
    markdown += `**Author**: ${issue.author}\n`;
    markdown += `**Description**: ${issue.description}\n\n`;

    if (issue.comments && issue.comments.length > 0) {
      markdown += '### Comments:\n';
      issue.comments.forEach((comment) => {
        markdown += `- ${comment.author}: ${comment.content}\n`;
      });
      markdown += '\n';
    }
  });

  await fs.writeFile(mdFile, markdown, 'utf-8');
};

/**
 * Exports git-bug issues, converts them to Markdown, and commits the changes.
 */
const exportAndConvertIssues = async (): Promise<void> => {
  try {
    console.log('Exporting git-bug issues...');
    await runCommand('git bug issue export --json issues.json');

    console.log('Converting JSON to Markdown...');
    await convertJsonToMd('issues.json', 'issues.md');

    console.log('Committing the updated issues.md...');
    await runCommand('git add issues.md');
    await runCommand('git commit -m "Update issues.md with latest git-bug issues"');
    await runCommand('git push');

    console.log('Issues successfully exported, converted, and committed.');
  } catch (error) {
    console.error('An error occurred:', error);
  }
};

exportAndConvertIssues();