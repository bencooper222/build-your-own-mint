import plaid from 'plaid';

const { PLAID_CLIENT_ID, PLAID_SECRET, PLAID_PUBLIC_KEY } = process.env;

if (!PLAID_CLIENT_ID) throw new Error('PLAID_CLIENT_ID not set');
if (!PLAID_SECRET) throw new Error('PLAID_SECRET not set');
if (!PLAID_PUBLIC_KEY) throw new Error('PLAID_PUBLIC_KEY not set');

export default new plaid.Client(
  PLAID_CLIENT_ID,
  PLAID_SECRET,
  PLAID_PUBLIC_KEY,
  plaid.environments.development,
  {
    version: '2018-05-22',
  },
);
