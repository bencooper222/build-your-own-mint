require('dotenv').config();
import * as openpgp from 'openpgp';
import { readFileSync, writeFileSync } from 'fs';
import { executable as toReadPath, encrypted as toWritePath } from './paths';

const { ACCOUNTS_PASSWORD } = process.env;
if (!ACCOUNTS_PASSWORD) throw new Error('No ACCOUNTS_PASSWORD available!');

const privateAccountContents = readFileSync(toReadPath, {
  encoding: 'utf8',
});

openpgp
  .encrypt({
    armor: true,
    message: openpgp.message.fromText(privateAccountContents),
    passwords: [ACCOUNTS_PASSWORD],
  })
  .then(ciphertext => {
    const encrypted = ciphertext.data; // get raw encrypted packets as Uint8Array
    writeFileSync(toWritePath, encrypted);
    console.log('Written encrypted to: ' + toWritePath);
  });
