'use strict';

function readPort(name, fallback) {
  const raw = process.env[name] ?? String(fallback);
  const port = Number(raw);
  if (!/^\d+$/.test(raw) || port < 1024 || port > 65535) {
    throw Error(name + ' must be a TCP port from 1024 to 65535');
  }
  return port;
}

const enabledPort = readPort('NEON_TEST_ENABLED_PORT', 4173);
const samplePort = readPort('NEON_TEST_SAMPLE_PORT', 4174);
if (enabledPort === samplePort) throw Error('Browser test servers require distinct ports');

module.exports = {
  enabledPort,
  samplePort,
  enabledUrl: 'http://127.0.0.1:' + enabledPort,
  sampleUrl: 'http://127.0.0.1:' + samplePort
};
