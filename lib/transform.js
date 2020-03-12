// @ts-nocheck
const moment = require('moment');
const os = require('os');
const currency = require('currency.js');
const { AccountMappingHolder } = require('./helpers');

const SHEET_NAMES = {
  TRANSACTIONS: 'transactions',
  BALANCES: 'balances',
};
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'; // column locations

const accountMapping = new AccountMappingHolder(require('../accounts.secret')); // THIS FILE SHOULD BE GITIGNORED

exports.transformTransactionsToUpdates = transactions => {
  const now = moment()
    .utc()
    .format();

  return transactions
    .sort((a, b) => moment(b.date) - moment(a.date))
    .reduce((acc, { date, account, name, amount, type, category }, idx) => {
      if (category == null) category = [];
      const arrayTransaction = [date, account, name, amount, type]; // establish order of transaction properties

      return acc.concat([
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
          value: `${os.hostname()}`,
        },
        { range: `${SHEET_NAMES.TRANSACTIONS}!K${idx + 2}`, value: `${now}` },
      ]);
    }, []);
};

exports.transformBalancesToUpdates = accounts => {
  const rtn = {
    range: `${SHEET_NAMES.BALANCES}!A1:${ALPHABET[accounts.length + 3]}1`,
    values: [
      [
        moment()
          .utc()
          .format('L LTS'),
        os.hostname(),
      ],
    ],
  };

  let have = 0,
    owed = 0;

  accounts.forEach(account => {
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

exports.transformBalancesToSMSData = accounts => {
  const amounts = accounts.reduce(
    (acc, el) => {
      if (el.type === 'credit') acc.debt = acc.debt.add(el.balance);
      if (el.type === 'depository' && el.subtype !== 'checking')
        // cds, stocks, savings accounts (less liquid stuff)
        acc.saving = acc.saving.add(el.balance);
      if (el.type === 'depository' && el.subtype === 'checking')
        acc.checking = acc.checking.add(el.balance);
      return acc;
    },
    {
      checking: currency(0, { separator: '' }),
      saving: currency(0, { separator: '' }),
      debt: currency(0, { separator: '' }),
    },
  );

  return {
    checking: amounts.checking.format(),
    saving: amounts.saving.format(),
    debt: amounts.debt.format(),
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
