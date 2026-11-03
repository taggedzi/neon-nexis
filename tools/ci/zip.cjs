'use strict';

const { crc32, deflateRawSync } = require('node:zlib');

// Small, deterministic ZIPs for the public allowlist. No ZIP64, links, or
// directory entries: nested file names create directories during extraction.
function createZip(entries) {
  if (entries.length > 65535) {
    throw Error('ZIP64 is not supported.');
  }
  const names = new Set();
  const local = [], central = [];
  let offset = 0;
  for (const { name, data } of entries) {
    if (!name || name.includes('\\') || name.includes(':') || name.includes('\0') ||
        name.split('/').some(part => !part || part === '.' || part === '..') || names.has(name)) {
      throw Error('ZIP entries must have unique relative file names.');
    }
    names.add(name);
    if (!Buffer.isBuffer(data)) {
      throw Error('ZIP entry data must be a Buffer.');
    }
    const filename = Buffer.from(name, 'utf8');
    const packed = deflateRawSync(data, { level: 9 });
    if (filename.length > 65535 || data.length > 0xffffffff || packed.length > 0xffffffff) {
      throw Error('ZIP entry is too large.');
    }
    const checksum = crc32(data);
    const header = Buffer.alloc(30);
    header.writeUInt32LE(0x04034b50, 0);
    header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x800, 6);
    header.writeUInt16LE(8, 8);
    header.writeUInt16LE(33, 12); // 1980-01-01, stable across builds.
    header.writeUInt32LE(checksum, 14);
    header.writeUInt32LE(packed.length, 18);
    header.writeUInt32LE(data.length, 22);
    header.writeUInt16LE(filename.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(0x314, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt16LE(0x800, 8);
    directory.writeUInt16LE(8, 10);
    directory.writeUInt16LE(33, 14);
    directory.writeUInt32LE(checksum, 16);
    directory.writeUInt32LE(packed.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE((0o100644 << 16) >>> 0, 38);
    directory.writeUInt32LE(offset, 42);
    local.push(header, filename, packed);
    central.push(directory, filename);
    offset += header.length + filename.length + packed.length;
    if (offset > 0xffffffff) {
      throw Error('ZIP64 is not supported.');
    }
  }
  const directory = Buffer.concat(central);
  if (offset + directory.length > 0xffffffff) {
    throw Error('ZIP64 is not supported.');
  }
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
}

module.exports = { createZip };
