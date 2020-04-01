/* eslint-disable */
require('dotenv').config();

const account = process.argv[2];
if (!account) {
  throw new Error('An account name must be provided.');
}
import {
  TransactionsResponse,
  IdentityResponse,
  AccountsResponse,
  AuthResponse,
  AssetReportCreateResponse,
  ItemResponse,
  Client as PlaidClient,
  AssetReportGetResponse,
  GetInstitutionByIdResponse,
  Institution,
} from 'plaid';
import { inspect } from 'util';
import { resolve } from 'path';
import moment = require('moment');

import express, { Response } from 'express';
import bodyParser from 'body-parser';

import client from '../lib/plaidClient';
const saveEnv = require('./saveEnv');

const app = express();
app.use(express.static(resolve(__dirname)));
app.set('view engine', 'ejs');
app.use(
  bodyParser.urlencoded({
    extended: false,
  }),
);
app.use(bodyParser.json());

app.get('/', (req, res, next) => {
  res.render(resolve(__dirname, 'plaid.ejs'), {
    PLAID_ACCOUNT: account,
    PLAID_PUBLIC_KEY: process.env.PLAID_PUBLIC_KEY,
  });
});

const APP_PORT = 8080;
let PUBLIC_TOKEN = null;
let ACCESS_TOKEN = '';
let ITEM_ID = null;

function saveAccessToken(token: string) {
  console.log();
  console.log(`Saving access token for account "${account}": ${token}`);
  saveEnv({
    [`PLAID_TOKEN_${account}`]: token,
  });
  console.log('Saved.');
  console.log();
}

// Exchange token flow - exchange a Link public_token for
// an API access_token
// https://plaid.com/docs/#exchange-token-flow
app.post('/get_access_token', function(request, response, next) {
  PUBLIC_TOKEN = request.body.public_token;
  client.exchangePublicToken(PUBLIC_TOKEN, function(error, tokenResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    ACCESS_TOKEN = tokenResponse.access_token;
    saveAccessToken(ACCESS_TOKEN);
    ITEM_ID = tokenResponse.item_id;
    prettyPrintResponse(tokenResponse);
    response.json({
      access_token: ACCESS_TOKEN,
      item_id: ITEM_ID,
      error: null,
    });
  });
});

// Retrieve Transactions for an Item
// https://plaid.com/docs/#transactions
app.get('/transactions', function(request, response, next) {
  // Pull transactions for the Item for the last 30 days
  const startDate = moment()
    .subtract(30, 'days')
    .format('YYYY-MM-DD');
  const endDate = moment().format('YYYY-MM-DD');
  client.getTransactions(
    ACCESS_TOKEN,
    startDate,
    endDate,
    {
      count: 250,
      offset: 0,
    },
    function(error: Error, transactionsResponse: TransactionsResponse) {
      if (error != null) {
        prettyPrintResponse(error);
        return response.json({
          error: error,
        });
      } else {
        prettyPrintResponse(transactionsResponse);
        response.json({ error: null, transactions: transactionsResponse });
      }
    },
  );
});

// Retrieve Identity for an Item
// https://plaid.com/docs/#identity
app.get('/identity', function(request, response, next) {
  client.getIdentity(ACCESS_TOKEN, function(
    error: Error,
    identityResponse: IdentityResponse,
  ) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(identityResponse);
    response.json({ error: null, identity: identityResponse });
  });
});

// Retrieve real-time Balances for each of an Item's accounts
// https://plaid.com/docs/#balance
app.get('/balance', function(request, response, next) {
  client.getBalance(ACCESS_TOKEN, function(
    error: Error,
    balanceResponse: AccountsResponse,
  ) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(balanceResponse);
    response.json({ error: null, balance: balanceResponse });
  });
});

// Retrieve an Item's accounts
// https://plaid.com/docs/#accounts
app.get('/accounts', function(request, response, next) {
  client.getAccounts(ACCESS_TOKEN, function(
    error: Error,
    accountsResponse: AccountsResponse,
  ) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(accountsResponse);
    response.json({ error: null, accounts: accountsResponse });
  });
});

// Retrieve ACH or ETF Auth data for an Item's accounts
// https://plaid.com/docs/#auth
app.get('/auth', function(request, response, next) {
  client.getAuth(ACCESS_TOKEN, function(error: Error, authResponse: AuthResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(authResponse);
    response.json({ error: null, auth: authResponse });
  });
});

// Create and then retrieve an Asset Report for one or more Items. Note that an
// Asset Report can contain up to 100 items, but for simplicity we're only
// including one Item here.
// https://plaid.com/docs/#assets
app.get('/assets', function(request, response, next) {
  // You can specify up to two years of transaction history for an Asset
  // Report.
  const daysRequested = 10;

  // The `options` object allows you to specify a webhook for Asset Report
  // generation, as well as information that you want included in the Asset
  // Report. All fields are optional.
  const options = {
    client_report_id: 'Custom Report ID #123',
    // webhook: 'https://your-domain.tld/plaid-webhook',
    user: {
      client_user_id: 'Custom User ID #456',
      first_name: 'Alice',
      middle_name: 'Bobcat',
      last_name: 'Cranberry',
      ssn: '123-45-6789',
      phone_number: '555-123-4567',
      email: 'alice@example.com',
    },
  };
  client.createAssetReport([ACCESS_TOKEN], daysRequested, options, function(
    error: Error,
    assetReportCreateResponse: AssetReportCreateResponse,
  ) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(assetReportCreateResponse);

    const assetReportToken = assetReportCreateResponse.asset_report_token;
    respondWithAssetReport(20, assetReportToken, client, response);
  });
});

// Retrieve information about an Item
// https://plaid.com/docs/#retrieve-item
app.get('/item', function(request, response, next) {
  // Pull the Item - this includes information about available products,
  // billed products, webhook information, and more.
  client.getItem(ACCESS_TOKEN, function(error: Error, itemResponse: ItemResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    // Also pull information about the institution
    client.getInstitutionById(itemResponse.item.institution_id, function(
      err: Error,
      instRes: GetInstitutionByIdResponse<Institution>,
    ) {
      if (err != null) {
        const msg = 'Unable to pull institution information from the Plaid API.';
        console.log(msg + '\n' + JSON.stringify(error));
        return response.json({
          error: msg,
        });
      } else {
        prettyPrintResponse(itemResponse);
        response.json({
          item: itemResponse.item,
          institution: instRes.institution,
        });
      }
    });
  });
});

app.listen(APP_PORT, function() {
  console.log(`Server started at http://localhost:${APP_PORT}`);
});

var prettyPrintResponse = (response: Record<string, any>) => {
  console.log(inspect(response, { colors: true, depth: 4 }));
};

// This is a helper function to poll for the completion of an Asset Report and
// then send it in the response to the client. Alternatively, you can provide a
// webhook in the `options` object in your `/asset_report/create` request to be
// notified when the Asset Report is finished being generated.
var respondWithAssetReport = (
  numRetriesRemaining: number,
  assetReportToken: string,
  client: PlaidClient,
  response: Response,
) => {
  if (numRetriesRemaining == 0) {
    return response.json({
      error: 'Timed out when polling for Asset Report',
    });
  }

  client.getAssetReport(assetReportToken, false, function(
    error: Error,
    assetReportGetResponse: AssetReportGetResponse,
  ) {
    if (error != null) {
      prettyPrintResponse(error);
      // have to ts ignore here because this code expects a PlaidError but the function signature wants a normal Error
      // @ts-ignore
      if (error.error_code == 'PRODUCT_NOT_READY') {
        setTimeout(
          () =>
            respondWithAssetReport(
              numRetriesRemaining,
              assetReportToken,
              client,
              response,
            ),
          1000,
        );
        return;
      }

      return response.json({
        error: error,
      });
    }

    client.getAssetReportPdf(assetReportToken, function(
      error,
      assetReportGetPdfResponse,
    ) {
      if (error != null) {
        return response.json({
          error: error,
        });
      }

      response.json({
        error: null,
        json: assetReportGetResponse.report,
        pdf: assetReportGetPdfResponse.buffer.toString('base64'),
      });
    });
  });
};

app.post('/set_access_token', function(request, response, next) {
  ACCESS_TOKEN = request.body.access_token;
  client.getItem(ACCESS_TOKEN, function(error: Error, itemResponse: ItemResponse) {
    response.json({
      item_id: itemResponse.item.item_id,
      error: false,
    });
  });
});
