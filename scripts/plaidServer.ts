import { config } from 'dotenv';
config();

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
  PlaidError,
} from 'plaid';
import { inspect } from 'util';
import { resolve } from 'path';
import moment = require('moment');
import express, { Response } from 'express';
import { log } from 'isomorphic-git';

import client from '../lib/plaidClient';
import saveEnv from './saveEnv';
import * as fs from 'fs';

// use current git commit as userId to uniquely identify req
let gitCommit: string;

log({ depth: 1, dir: './', fs }).then(res => {
  gitCommit = res[0].commit.tree;
});

const app = express();
app.use(express.static(resolve(__dirname)));
app.set('view engine', 'ejs');
app.use(
  express.urlencoded({
    extended: false,
  }),
);
app.use(express.json());

app.get('/', (req, res) => {
  res.render(resolve(__dirname, 'plaid.ejs'), {
    PLAID_ACCOUNT: account,
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
app.post('/get_access_token', function(request, response) {
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
      error: null,
      item_id: ITEM_ID,
    });
  });
});

// Retrieve Transactions for an Item
// https://plaid.com/docs/#transactions
app.get('/transactions', function(request, response) {
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
app.get('/identity', function(request, response) {
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
app.get('/balance', function(request, response) {
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
    response.json({ balance: balanceResponse, error: null });
  });
});

// Retrieve an Item's accounts
// https://plaid.com/docs/#accounts
app.get('/accounts', function(request, response) {
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
    response.json({ accounts: accountsResponse, error: null });
  });
});

// Retrieve ACH or ETF Auth data for an Item's accounts
// https://plaid.com/docs/#auth
app.get('/auth', function(request, response) {
  client.getAuth(ACCESS_TOKEN, function(error: Error, authResponse: AuthResponse) {
    if (error != null) {
      prettyPrintResponse(error);
      return response.json({
        error: error,
      });
    }
    prettyPrintResponse(authResponse);
    response.json({ auth: authResponse, error: null });
  });
});

// Create and then retrieve an Asset Report for one or more Items. Note that an
// Asset Report can contain up to 100 items, but for simplicity we're only
// including one Item here.
// https://plaid.com/docs/#assets
app.get('/assets', function(request, response) {
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
      client_user_id: gitCommit,
      email: 'alice@example.com',
      first_name: 'Alice',
      last_name: 'Cranberry',
      middle_name: 'Bobcat',
      phone_number: '555-123-4567',
      ssn: '123-45-6789',
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
app.get('/item', function(request, response) {
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
    client.getInstitutionById(itemResponse.item.institution_id, ['US'], {}, function(
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
          institution: instRes.institution,
          item: itemResponse.item,
        });
      }
    });
  });
});

app.post('/create_link_token', async (req, res) => {
  const linkRes = await client.createLinkToken({
    client_name: 'bencooper222/build-your-own-mint',
    country_codes: ['US'],
    language: 'en',
    products: ['transactions'],
    user: {
      client_user_id: gitCommit,
    },
  });

  const linkToken = linkRes.link_token;

  res.json({ linkToken });
});

app.listen(APP_PORT, function() {
  console.log(`Server started at http://localhost:${APP_PORT}`);
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prettyPrintResponse = (response: Record<string, any>) => {
  console.log(inspect(response, { colors: true, depth: 4 }));
};

// This is a helper function to poll for the completion of an Asset Report and
// then send it in the response to the client. Alternatively, you can provide a
// webhook in the `options` object in your `/asset_report/create` request to be
// notified when the Asset Report is finished being generated.
const respondWithAssetReport = (
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
      if ((error as PlaidError).error_code == 'PRODUCT_NOT_READY') {
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

app.post('/set_access_token', function(request, response) {
  ACCESS_TOKEN = request.body.access_token;
  client.getItem(ACCESS_TOKEN, function(error: Error, itemResponse: ItemResponse) {
    response.json({
      error: false,
      item_id: itemResponse.item.item_id,
    });
  });
});
