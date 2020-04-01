import moment = require('moment');
import client from './plaidClient';
import { Account } from 'plaid';

// start from beginning of last month...
const targetMonth = Math.max(1, moment().month() - 1);
const startDate = moment()
  .month(targetMonth - 60)
  .date(1)
  .format('YYYY-MM-DD');
// ends now.
// this ensures we always fully update last month,
// and keep current month up-to-date

const transactionFetchOptions = [
  {
    count: 250,
    offset: 0,
  },
];

const plaidAccountTokens = Object.entries(process.env)
  .filter(([key]) => key.startsWith(`PLAID_TOKEN`))
  // reduce is the general case of map
  .reduce((acc, [key, token]) => {
    if (!token) return acc;
    return acc.concat({
      account: key.replace(/^PLAID_TOKEN_/, ''),
      token,
    });
  }, [] as { account: string; token: string }[]);

export interface MyTransaction {
  name: string | null;
  date: string;
  amount: number;
  category: string[] | null;
  account: string | null;
  type: string | null;
}

// as of right now, transactions are all or nothing which I think I prefer
// consider making them not all or nothing if I can implement "getTransactionSince" functionality
export const fetchTransactions = async (isPrivate = true): Promise<MyTransaction[]> => {
  const rawTransactions = await Promise.all(
    plaidAccountTokens.map(({ account, token }) => {
      return client
        .getTransactions(
          token,
          startDate,
          moment().format('YYYY-MM-DD'), // transactions to date
          ...transactionFetchOptions,
        )
        .then(({ accounts, transactions }) => ({
          transactions: transactions.map(transaction => {
            let matchedAccount:
              | Account
              | { official_name: string; name: string }
              | undefined = accounts.find(
              account => account.account_id === transaction.account_id,
            );

            // when we fail to match accounts
            if (matchedAccount == undefined)
              matchedAccount = { name: 'unmatched', official_name: 'unmatched' };

            return {
              ...transaction,
              account:
                matchedAccount.official_name == undefined
                  ? matchedAccount.name
                  : matchedAccount.official_name,
            };
          }),
        }))
        .catch(err => {
          throw new Error(
            'Fetching transactions failed:\n' +
              JSON.stringify({ account: isPrivate ? account : 'PRIVATE', err }),
          );
        });
    }),
  );

  // concat all transactions

  return rawTransactions.flatMap(({ transactions }) =>
    transactions.map(({ name, date, amount, category, account, transaction_type }) => ({
      account,
      amount: -Number(amount),
      category,
      date,
      name,
      type: transaction_type,
    })),
  );
};

export interface MyBalance {
  name: string;
  balance: number | null;
  type: string | null;
  subtype: string | null;
}

export const fetchBalances = async (isPrivate = true): Promise<MyBalance[]> => {
  const rawBalances = [];
  const failures = [];
  for (const { account, token } of plaidAccountTokens) {
    try {
      rawBalances.push(await client.getBalance(token));
    } catch (err) {
      failures.push(account);
    }
  }

  if (isPrivate)
    console.error(`Could not fetching the following balances: ${failures.join(', ')}`);

  return rawBalances.flatMap(({ accounts }) =>
    accounts.map(({ balances, official_name, name, type, subtype }) => ({
      balance: balances.current,
      name: (official_name == null ? name : official_name) as string,
      subtype,
      type,
    })),
  );
};
