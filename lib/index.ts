require('dotenv').config();

import open from 'open';
import { fetchTransactions, fetchBalances } from './fetch';
import {
  transformTransactionsToUpdates,
  transformBalancesToUpdates,
  transformBalancesToSMSData,
} from './transform';
import { updateTransactions, updateBalances } from './updaters/gsheets';
import { send } from './updaters/sms';

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
    console.info('Start fetching transactions!');
    const transactions = await fetchTransactions(isPrivate);
    const transactionUpdates = transformTransactionsToUpdates(transactions);
    await updateTransactions(transactionUpdates);
  } catch (err) {
    console.error(err);
  }

  try {
    console.info('Start fetching balances!');

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
