const twilio = require('twilio')(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN,
);
const fetch = require('node-fetch');
const {
  CIRCLE_PROJECT_USERNAME,
  CIRCLE_PROJECT_REPONAME,
  CIRCLE_BUILD_NUM,
  CI,
  ENABLE_SMS,
} = process.env;

// get workflow type
const getWorkflowType = async () => {
  if (CI !== 'true') return 'not-ci';

  const url = `https://circleci.com/api/v1.1/project/github/${CIRCLE_PROJECT_USERNAME}/${CIRCLE_PROJECT_REPONAME}/${CIRCLE_BUILD_NUM}`;
  const json = await (await fetch(url)).json();

  return json.workflows.workflow_name;
};

// log the reason we're texting or not texting
// passing variables as parameters for future extensiblity
// enable sms has to deal with true/false/other
// ci only has to deal with true/false
const logTextingReason = (enableSms, ci, workflowType) => {
  if (workflowType === 'test') {
    console.warn("Not texting because we're running in a CircleCI commit build.");
    return;
  }

  if (enableSms === 'true') console.info('Texting because SMS is explicitly enabled');
  if (enableSms !== 'false' && ci === 'true')
    console.info(
      "Texting because we're in nightly CI and texting isn't explicitly disabled",
    );
};

exports.send = async updateObject => {
  // only text if sms is enabled OR (we're in production AND sms is not disabled)
  // (there's definitely more options I want here but I gave up when I got to a 5 var k-map)
  let shouldRun;

  if (ENABLE_SMS === 'true') shouldRun = true;
  if (CI === 'true' && ENABLE_SMS !== 'false') shouldRun = true;

  // if circle is just building a commit, there's no need to spend money texting
  const workflowType = await getWorkflowType();
  if (workflowType === 'test') shouldRun = false;

  logTextingReason(ENABLE_SMS, CI === 'true', workflowType);

  if (shouldRun)
    twilio.messages
      .create({
        body: `As of right now, you have $${Number(updateObject.checking) +
          Number(updateObject.saving)} in assets ($${
          updateObject.checking
        } of that is in checkings accounts) but $${updateObject.debt} in debt.`,
        to: process.env.USER_PHONE_NUMBER, // Text this number
        from: process.env.TWILIO_PHONE_NUMBER, // From a valid Twilio number
      })
      .then(message => console.log(`Texting successful: ${message.sid}`))
      .catch(err => {
        console.error('Texting has failed:\n' + JSON.stringify(err));
        process.exit(1);
      });
  else console.warn('Not texting!');
};
