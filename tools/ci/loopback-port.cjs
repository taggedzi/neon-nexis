'use strict';

const { randomInt } = require('node:crypto');
const { createServer } = require('node:net');

function probePort(port) {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => {
      server.close(error => error ? reject(error) : resolve(port));
    });
  });
}

async function freeLoopbackPort() {
  // OS-assigned ports can include ports blocked by fetch and browsers, such as 5060.
  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      return await probePort(randomInt(49152, 65536));
    } catch (error) {
      if (error.code !== 'EADDRINUSE' && error.code !== 'EACCES') {
        throw error;
      }
      if (attempt === 19) {
        throw new Error('Could not find a free loopback port in the dynamic range', { cause: error });
      }
    }
  }
}

module.exports = { freeLoopbackPort };
