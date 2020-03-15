import twilio from 'twilio';
import { SMSUpdate } from '../transform';

const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
const fetch = require('node-fetch');
const {
  CIRCLE_PROJECT_USERNAME,
  CIRCLE_PROJECT_REPONAME,
  CIRCLE_BUILD_NUM,
  CI,
  ENABLE_SMS,
  USER_PHONE_NUMBER,
  TWILIO_PHONE_NUMBER,
} = process.env;

// get workflow type
const getWorkflowType = async () => {
  if (CI !== 'true') return 'not-ci';

  const url = `https://circleci.com/api/v1.1/project/github/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}/${CIRCLE_BUILD_NUM}`;
  const json = await (await fetch(url)).json();

  return json.workflows.workflow_name;
};

export const send = async (updateObject: SMSUpdate) => {
  // only text if sms is enabled OR we're in a nightly CI job and it's not disabled
  let shouldRun;
  if (ENABLE_SMS === 'true') {
    shouldRun = true;
    console.info('SMS is explicitly enabled, texting under all circumstances');
  }

  if (ENABLE_SMS !== 'false' && (await getWorkflowType()) === 'nightly') {
    shouldRun = true;
    console.info(
      'SMS is not explicitly disabled and running in nighly CI job, will be texting',
    );
  }

  if (shouldRun) {
    if (!USER_PHONE_NUMBER) throw new Error("Can't text, to phone number doesn't exist");

    client.messages
      .create({
        body: `As of right now, you have $${Number(updateObject.checking) +
          Number(updateObject.saving)} in assets ($${
          updateObject.checking
        } of that is in checkings accounts) but $${updateObject.debt} in debt.`,
        to: USER_PHONE_NUMBER, // Text this number
        from: TWILIO_PHONE_NUMBER, // From a valid Twilio number
      })
      .then(message => console.log(`Texting successful: ${message.sid}`))
      .catch(err => {
        console.error('Texting has failed:\n' + JSON.stringify(err));
        process.exit(1);
      });
  } else
    console.warn(
      'Not texting! Only circumstances of texting are: enabled sms or not disabled sms AND nightly ci job.',
    );
};
