import moment = require('moment');

import { hostname } from 'os';
import currency from 'currency.js';

import secretAccounts from './accounts.secret';
import { AccountMappingHolder } from './helpers';
import { MyTransaction, MyBalance } from './fetch';

const SHEET_NAMES = {
  BALANCES: 'balances',
  TRANSACTIONS: 'transactions',
};
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // column locations

const accountMapping = new AccountMappingHolder(secretAccounts); // THIS FILE SHOULD BE GITIGNORED

export interface TransactionSheetUpdate {
  range: string;
  value: string | number | null;
}

export const transformTransactionsToUpdates = (
  transactions: MyTransaction[],
): TransactionSheetUpdate[] => {
  const now = moment()
    .utc()
    .format();

  return transactions
    .sort((a, b) => moment(b.date) - moment(a.date))
    .flatMap(({ date, account, name, amount, type, category }, idx) => {
      if (category == null) category = [];
      const arrayTransaction = [date, account, name, amount, type]; // establish order of transaction properties

      return [
        ...arrayTransaction.map((value, i) => ({
          range: `${SHEET_NAMES.TRANSACTIONS}!${ALPHABET[i]}${idx + 2}`,
          value,
        })),
        // this statement will split up the category array and puts into consecutive cells
        ...category
          .sort((a, b) => a.localeCompare(b))
          .map((value, i) => ({
            range: `${SHEET_NAMES.TRANSACTIONS}!${['F', 'G', 'H', 'I'][i]}${idx + 2}`,
            value,
          })),
        {
          range: `${SHEET_NAMES.TRANSACTIONS}!J${idx + 2}`,
          value: `${hostname()}`,
        },
        { range: `${SHEET_NAMES.TRANSACTIONS}!K${idx + 2}`, value: `${now}` },
      ];
    });
};

export interface BalanceSheetUpdate {
  range: string;
  values: string[][];
}

export const transformBalancesToUpdates = (balances: MyBalance[]): BalanceSheetUpdate => {
  const rtn = {
    range: `${SHEET_NAMES.BALANCES}!A1:${ALPHABET[balances.length + 3]}1`,
    values: [
      [
        moment()
          .utc()
          .format('L LTS'),
        hostname(),
      ],
    ],
  };

  let have = 0,
    owed = 0;

  balances.forEach(account => {
    const idx = ALPHABET.indexOf(accountMapping.get(account.name));
    if (idx === -1) throw new Error('CANNOT FIND THIS ACCOUNT IN MAPPING');

    rtn.values[0][idx] =
      account.type === 'depository' ? Number(account.balance) : -Number(account.balance);

    if (rtn.values[0][idx] > 0) have += rtn.values[0][idx];
    else owed += rtn.values[0][idx];
  });

  // used to previously have unused accounts be marked as zero. Now just let the series fall off.

  rtn.values[0].push(have, owed, have + owed);
  return rtn;
};

export interface SMSUpdate {
  checking: string;
  saving: string;
  debt: string;
}

export const transformBalancesToSMSData = (balances: MyBalance[]): SMSUpdate => {
  const amounts = balances.reduce(
    (acc, { type, subtype, balance }) => {
      const numericBalance = Number(balance);
      if (type === 'credit') acc.debt = acc.debt.add(numericBalance);
      if (type === 'depository' && subtype !== 'checking')
        // cds, stocks, savings accounts (less liquid stuff)
        acc.saving = acc.saving.add(numericBalance);
      if (type === 'depository' && subtype === 'checking')
        acc.checking = acc.checking.add(numericBalance);
      return acc;
    },
    {
      checking: currency(0, { separator: '' }),
      debt: currency(0, { separator: '' }),
      saving: currency(0, { separator: '' }),
    },
  );

  return {
    checking: amounts.checking.format(),
    debt: amounts.debt.format(),
    saving: amounts.saving.format(),
  };
};

/**
 * {
 *   account: 'paypal',
 *   name: 'Payment from XXX',
 *   date: 2019-xx-xx,
 *   amount: 123
 * }
 *
 * Updates should be in the form of:
 * {
 *   range: 'A1',
 *   value: 123
 * }
 */
