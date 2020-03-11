require('dotenv').config();
const open = require('open');
const { fetchTransactions, fetchBalances } = require('./lib/fetch');

const {
  transformTransactionsToUpdates,
  transformBalancesToUpdates,
  transformBalancesToSMSData,
} = require('./lib/transform');

const {
  updateTransactions,
  updateBalances,
  getLastTransactionUpdateTime,
} = require('./lib/updaters/gsheets');

const { send } = require('./lib/updaters/sms');

(async () => {
  console.log('Starting Plaid retrieval and writing process');
  const isPrivate = process.argv[2] !== '--public'; // not public -> private

  // since this is often run in circleci free, it's probably wise to not log private stuff
  if (!isPrivate)
    console.log(
      'Running in public mode, suppressing logs with potentially private information.',
    );

  // fetch, transform, and update transactions
  try {
    const transactions = await fetchTransactions(isPrivate);
    const transactionUpdates = transformTransactionsToUpdates(transactions);
    await updateTransactions(transactionUpdates);
  } catch (err) {
    console.error(err);
  }

  try {
    // fetch and log balances
    const balances = await fetchBalances(isPrivate);
    if (isPrivate) console.table(balances, ['name']);

    // transform and update with balances
    const balanceUpdates = transformBalancesToUpdates(balances);
    const smsUpdates = transformBalancesToSMSData(balances);
    await updateBalances(balanceUpdates);
    await send(smsUpdates);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }

  if (isPrivate)
    open(`https://docs.google.com/spreadsheets/d/${process.env.SHEETS_SHEET_ID}`);
})();
