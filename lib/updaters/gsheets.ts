import { google } from 'googleapis';
import moment = require('moment');

import oAuth2Client from './googleClient';
import { BalanceSheetUpdate, TransactionSheetUpdate } from '../transform';

oAuth2Client.setCredentials({
  access_token: process.env.SHEETS_ACCESS_TOKEN,
  expiry_date: Number(process.env.SHEETS_EXPIRY_DATE),
  refresh_token: process.env.SHEETS_REFRESH_TOKEN,
  token_type: process.env.SHEETS_TOKEN_TYPE,
});

const sheets = google.sheets({
  auth: oAuth2Client,
  version: 'v4',
});

export const updateTransactions = async (updates: TransactionSheetUpdate[]) => {
  try {
    const {
      data: { totalUpdatedCells },
    } = await sheets.spreadsheets.values.batchUpdate({
      requestBody: {
        data: updates.map(p => ({
          range: p.range,
          values: [[p.value]],
        })),
        valueInputOption: 'USER_ENTERED',
      },
      spreadsheetId: process.env.SHEETS_SHEET_ID,
    });

    console.log(`Success! ${totalUpdatedCells} transation cells updated.`);
  } catch (err) {
    console.error('Updating transactions in google sheets failed');
  }
};

export const updateBalances = async (updateObject: BalanceSheetUpdate) => {
  try {
    const { data } = await sheets.spreadsheets.values.append({
      range: updateObject.range,

      requestBody: {
        majorDimension: 'ROWS',
        ...updateObject,

        // data: updates.map(p => ({
        //   range: p.range,
        //   majorDimension: "ROWS",
        //   values: [[p.value]],
        // })),
      },
      spreadsheetId: process.env.SHEETS_SHEET_ID,
      valueInputOption: `USER_ENTERED`,
    });
    console.log(`Success! ${data.updates?.updatedCells} balances cells updated.`);
  } catch (err) {
    console.error('Updating balances in google sheets failed');
  }
};

export const getLastTransactionUpdateTime = async () => {
  const {
    data: { values },
  } = await sheets.spreadsheets.values.get({
    range: 'transactions!k2:k',
    spreadsheetId: process.env.SHEETS_SHEET_ID,
  });

  if (values == undefined) throw new Error('Transaction date column is empty');
  return moment.max(values.map(el => moment(el))).format('YYYY-M-DTH:m:sZ');
};
