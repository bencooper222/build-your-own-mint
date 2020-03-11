require('dotenv').config();
import * as openpgp from 'openpgp';
import { readFileSync, writeFileSync } from 'fs';

const { ACCOUNTS_PASSWORD } = process.env;
if (!ACCOUNTS_PASSWORD) throw new Error('No ACCOUNTS_PASSWORD available!');

const toReadPath = './accounts.secret.js';
const toWritePath = './accounts.public.txt';

const privateAccountContents = readFileSync(toReadPath, {
  encoding: 'utf8',
});

openpgp
  .encrypt({
    message: openpgp.message.fromText(privateAccountContents),
    passwords: [ACCOUNTS_PASSWORD],
    armor: true,
  })
  .then(ciphertext => {
    const encrypted = ciphertext.data; // get raw encrypted packets as Uint8Array
    writeFileSync(toWritePath, encrypted);
    console.log('Written encrypted to: ' + toWritePath);
  });
