import { google } from 'googleapis';
import moment = require('moment');

import oAuth2Client from './googleClient';
import { BalanceSheetUpdate, TransactionSheetUpdate } from '../transform';

oAuth2Client.setCredentials({
  access_token: process.env.SHEETS_ACCESS_TOKEN,
  refresh_token: process.env.SHEETS_REFRESH_TOKEN,
  token_type: process.env.SHEETS_TOKEN_TYPE,
  expiry_date: Number(process.env.SHEETS_EXPIRY_DATE),
});

const sheets = google.sheets({
  version: 'v4',
  auth: oAuth2Client,
});

export const updateTransactions = async (updates: TransactionSheetUpdate[]) => {
  try {
    const {
      data: { totalUpdatedCells },
    } = await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: process.env.SHEETS_SHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates.map(p => ({
          range: p.range,
          values: [[p.value]],
        })),
      },
    });

    console.log(`Success! ${totalUpdatedCells} balance cells updated.`);
  } catch (err) {
    console.error('Updating transactions in google sheets failed');
  }
};

export const updateBalances = async (updateObject: BalanceSheetUpdate) => {
  try {
    const { data } = await sheets.spreadsheets.values.append({
      spreadsheetId: process.env.SHEETS_SHEET_ID,

      valueInputOption: `USER_ENTERED`,
      range: updateObject.range,
      requestBody: {
        range: updateObject.range,
        values: updateObject.values,
        majorDimension: 'ROWS',

        // data: updates.map(p => ({
        //   range: p.range,
        //   majorDimension: "ROWS",
        //   values: [[p.value]],
        // })),
      },
    });
    console.log(`Success! ${data.updates?.updatedCells} transaction cells updated.`);
  } catch (err) {
    console.error('Updating balances in google sheets failed');
  }
};

export const getLastTransactionUpdateTime = async () => {
  const {
    data: { values },
  } = await sheets.spreadsheets.values.get({
    spreadsheetId: process.env.SHEETS_SHEET_ID,
    range: 'transactions!k2:k',
  });

  if (values == undefined) throw new Error('Transaction date column is empty');
  return moment.max(values.map(el => moment(el))).format('YYYY-M-DTH:m:sZ');
};
