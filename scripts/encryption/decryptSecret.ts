require('dotenv').config();

import * as openpgp from 'openpgp';
import { readFileSync, writeFileSync } from 'fs';
import { encrypted as toReadPath, executable as toWritePath } from './paths';

const { ACCOUNTS_PASSWORD } = process.env;
if (!ACCOUNTS_PASSWORD) throw new Error('No ACCOUNTS_PASSWORD available!');

const encryptedAccountContents = readFileSync(toReadPath, {
  encoding: 'utf8',
});

(async () => {
  openpgp
    .decrypt({
      message: await openpgp.message.readArmored(encryptedAccountContents),
      passwords: [ACCOUNTS_PASSWORD],
    })
    .then(plaintext => {
      const decrypted = plaintext.data;
      writeFileSync(toWritePath, decrypted);
      console.log('Wrote decrypted to: ' + toWritePath);
    });
})();
