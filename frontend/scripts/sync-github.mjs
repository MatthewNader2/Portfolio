#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const GITHUB_USERNAME = 'MatthewNader2';
const GITHUB_API_URL = `https://api.github.com/users/${GITHUB_USERNAME}/repos?per_page=100&sort=updated`;

console.log(`\x1b[1;34m[GitHub Sync]\x1b[0m Fetching public repositories for \x1b[1;32m${GITHUB_USERNAME}\x1b[0m...`);

async function main() {
  try {
    const response = await fetch(GITHUB_API_URL, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'WASM-Portfolio-Sync',
      },
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    const repos = await response.json();
    console.log(`\x1b[1;34m[GitHub Sync]\x1b[0m Discovered \x1b[1;32m${repos.length}\x1b[0m repositories.`);

    const formattedProjects = [];

    for (const repo of repos) {
      if (repo.fork && repo.stargazers_count === 0 && !repo.description) {
        continue;
      }

      const rawName = repo.name;
      const title = rawName
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());

      const lang = repo.language || (repo.topics?.length ? repo.topics[0] : 'Software');
      const starsStr = repo.stargazers_count > 0 ? ` | ${repo.stargazers_count} ★` : '';
      const subtitle = `${lang}${starsStr}`;
      const description = repo.description || `Open-source ${lang} project by Matthew Nader.`;

      formattedProjects.push({
        repo: repo.name,
        title,
        subtitle,
        description,
        github: repo.html_url,
        stars: repo.stargazers_count,
        language: repo.language,
        topics: repo.topics || [],
        updated_at: repo.updated_at,
      });
    }

    console.log(`\n\x1b[1;32m[Extracted ${formattedProjects.length} Portfolio Projects]:\x1b[0m`);
    formattedProjects.forEach((p, idx) => {
      console.log(`  ${idx + 1}. \x1b[1;36m${p.title}\x1b[0m (${p.subtitle}) -> \x1b[90m${p.github}\x1b[0m`);
    });

    const outputPath = path.resolve(__dirname, '../src/projects.autogen.json');
    fs.writeFileSync(outputPath, JSON.stringify(formattedProjects, null, 2));
    console.log(`\n\x1b[1;32m[Success]\x1b[0m Written to \x1b[1;34m${outputPath}\x1b[0m\n`);

  } catch (err) {
    console.error(`\x1b[1;31m[Sync Error]\x1b[0m:`, err.message);
    process.exit(1);
  }
}

main();
