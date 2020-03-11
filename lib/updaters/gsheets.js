const { google } = require('googleapis');
const moment = require('moment');
const oAuth2Client = new google.auth.OAuth2(
  process.env.SHEETS_CLIENT_ID,
  process.env.SHEETS_CLIENT_SECRET,
  process.env.SHEETS_REDIRECT_URI,
);

oAuth2Client.setCredentials({
  access_token: process.env.SHEETS_ACCESS_TOKEN,
  refresh_token: process.env.SHEETS_REFRESH_TOKEN,
  scope: process.env.SHEETS_SCOPE,
  token_type: process.env.SHEETS_TOKEN_TYPE,
  expiry_date: process.env.SHEETS_EXPIRY_DATE,
});

const sheets = google.sheets({
  version: 'v4',
  auth: oAuth2Client,
});

exports.updateTransactions = async updates => {
  sheets.spreadsheets.values.batchUpdate(
    {
      spreadsheetId: process.env.SHEETS_SHEET_ID,
      requestBody: {
        valueInputOption: 'USER_ENTERED',
        data: updates.map(p => ({
          range: p.range,
          values: [[p.value]],
        })),
      },
    },
    (err, res) => {
      if (err) {
        return console.log('Update failed: ', err);
      }
      console.log(`Success! ${res.data.totalUpdatedCells} transaction cells updated.`);
    },
  );
};

exports.updateBalances = async updateObject => {
  sheets.spreadsheets.values.append(
    {
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
    },
    (err, res) => {
      if (err) return console.log('Update failed: ', err);

      console.log(`Success! ${res.data.updates.updatedCells} balance cells updated.`);
    },
  );

  // // TODO: I don't think this is doing anything....
  // let totalOwned = currency(0),
  //   totalOwed = currency(0);
  // updateObject.values[0].slice(2).forEach(el => {
  //   el = Number(el);
  //   // console.log(el);
  //   if (el < 0) totalOwed = totalOwed.subtract(el);
  //   else totalOwned = totalOwned.add(el);
  // });
};

exports.getLastTransactionUpdateTime = async () => {
  return (
    await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.SHEETS_SHEET_ID,
      range: 'transactions!k2:k',
    })
  ).data.values
    .map(datestring => moment(datestring, 'YYYY-M-DTH:m:sZ'))
    .reduce((acc, date) => (acc == null || acc.isBefore(date) ? date : acc), null);
};
