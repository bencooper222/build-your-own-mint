import { config as dotenvConfig, parse as dotenvParse } from 'dotenv';
import { readFileSync } from 'fs';
import { resolve as pathResolve } from 'path';
import fetch from 'node-fetch';

dotenvConfig();
const { GITHUB_USERNAME, GITHUB_PROJECT, CIRCLE_CI_TOKEN } = process.env;
if (!GITHUB_USERNAME) throw new Error('No GITHUB_USERNAME available!');
if (!GITHUB_PROJECT) throw new Error('No GITHUB_PROJECT available!');
if (!CIRCLE_CI_TOKEN) throw new Error('No CIRCLE_CI_TOKEN available!');

// variables that shouldn't be synced
const filteredVariables = [
  'CIRCLE_CI_TOKEN',
  'ENABLE_SMS', // sms is typically different for debugging and otherwise
  'GITHUB_USERNAME',
  'GITHUB_PROJECT',
];

interface NameValPair {
  name: string;
  value: string;
}

const deleteCurrentEnvironmentVariables = async () => {
  const envVars = await (
    await fetch(
      `https://circleci.com/api/v1.1/project/github/${GITHUB_USERNAME}/${GITHUB_PROJECT}/envvar?circle-token=${CIRCLE_CI_TOKEN}`,
      { method: 'GET' },
    )
  ).json();

  for (let { name, value } of envVars) {
    try {
      await fetch(
        `https://circleci.com/api/v1.1/project/github/${GITHUB_USERNAME}/${GITHUB_PROJECT}/envvar/${name}?circle-token=${CIRCLE_CI_TOKEN}`,
        { method: 'DELETE' },
      );
      console.log(`Successfully deleted ${name}: ${value}`);
    } catch (err) {
      console.log(`Failed to delete ${name}: ${value}`);
    }
  }

  console.log('Finished deleting env vars');
};

const updateSingleToken = async (nameValToken: NameValPair) => {
  console.log(
    'Updated this pair: ' +
      JSON.stringify(
        await fetch(
          `https://circleci.com/api/v1.1/project/github/${GITHUB_USERNAME}/${GITHUB_PROJECT}/envvar?circle-token=${CIRCLE_CI_TOKEN}`,
          {
            method: 'post',
            body: JSON.stringify(nameValToken),
            headers: { 'Content-Type': 'application/json' },
          },
        ).then(res => res.json()),
      ),
  );
};

const syncAllVariables = async () => {
  await deleteCurrentEnvironmentVariables(); // clear out current env vars

  const envPath = pathResolve(__dirname, '../.env');
  const envVars = dotenvParse(readFileSync(envPath));

  // don't sync certain variables
  for (let key in envVars) if (filteredVariables.includes(key)) delete envVars[key];

  // converts to an array of name-value pairs that we can send to circleci
  const arrayOfNameValPairs: NameValPair[] = Object.entries(
    envVars,
  ).map(([name, value]) => ({ name, value }));

  for (let pair of arrayOfNameValPairs) {
    await updateSingleToken(pair);
  }
};

syncAllVariables();
