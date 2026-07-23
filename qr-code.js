/*
 * Dependency-free QR Code Model 2 encoder.
 *
 * The error-correction, placement, and mask-selection algorithms are based on
 * Project Nayuki's QR Code generator:
 * https://www.nayuki.io/page/qr-code-generator-library
 *
 * Copyright (c) Project Nayuki. (MIT License)
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

/**
 * Maximum byte-mode payload at Version 40 for each error-correction level.
 * A non-ASCII string is UTF-8 encoded and also carries a small ECI header, so
 * its practical maximum is a little lower.
 */
export const QR_BYTE_CAPACITY = Object.freeze({
  L: 2953,
  M: 2331,
  Q: 1663,
  H: 1273,
});

const LEVELS = Object.freeze({
  L: Object.freeze({ ordinal: 0, formatBits: 1 }),
  M: Object.freeze({ ordinal: 1, formatBits: 0 }),
  Q: Object.freeze({ ordinal: 2, formatBits: 3 }),
  H: Object.freeze({ ordinal: 3, formatBits: 2 }),
});

// Index 0 is deliberately invalid; indexes 1 to 40 are QR versions.
const ECC_CODEWORDS_PER_BLOCK = [
  [-1, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18, 20, 24, 26, 30, 22, 24, 28, 30, 28, 28, 28, 28, 30, 30, 26, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26, 30, 22, 22, 24, 24, 28, 28, 26, 26, 26, 26, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28, 28],
  [-1, 13, 22, 18, 26, 18, 24, 18, 22, 20, 24, 28, 26, 24, 20, 30, 24, 28, 28, 26, 30, 28, 30, 30, 30, 30, 28, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
  [-1, 17, 28, 22, 16, 22, 28, 26, 26, 24, 28, 24, 28, 22, 24, 24, 30, 28, 28, 26, 28, 30, 24, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30, 30],
];

const NUM_ERROR_CORRECTION_BLOCKS = [
  [-1, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4, 4, 4, 4, 4, 6, 6, 6, 6, 7, 8, 8, 9, 9, 10, 12, 12, 12, 13, 14, 15, 16, 17, 18, 19, 19, 20, 21, 22, 24, 25],
  [-1, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5, 5, 8, 9, 9, 10, 10, 11, 13, 14, 16, 17, 17, 18, 20, 21, 23, 25, 26, 28, 29, 31, 33, 35, 37, 38, 40, 43, 45, 47, 49],
  [-1, 1, 1, 2, 2, 4, 4, 6, 6, 8, 8, 8, 10, 12, 16, 12, 17, 16, 18, 21, 20, 23, 23, 25, 27, 29, 34, 34, 35, 38, 40, 43, 45, 48, 51, 53, 56, 59, 62, 65, 68],
  [-1, 1, 1, 2, 4, 4, 4, 5, 6, 8, 8, 11, 11, 16, 16, 18, 16, 19, 21, 25, 25, 25, 34, 30, 32, 35, 37, 40, 42, 45, 48, 51, 54, 57, 60, 63, 66, 70, 74, 77, 81],
];

const MODE_BYTE = 0x4;
const MODE_ECI = 0x7;
const UTF8_ECI_ASSIGNMENT = 26;

function appendBits(buffer, value, length) {
  if (!Number.isInteger(value) || !Number.isInteger(length) || length < 0 || length > 31 || value < 0 || value >= 2 ** length) {
    throw new RangeError("Cannot append out-of-range QR bits");
  }
  for (let bit = length - 1; bit >= 0; bit -= 1) {
    buffer.push((value >>> bit) & 1);
  }
}

function bit(value, index) {
  return ((value >>> index) & 1) !== 0;
}

function rawDataModuleCount(version) {
  let result = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const alignmentCount = Math.floor(version / 7) + 2;
    result -= (25 * alignmentCount - 10) * alignmentCount - 55;
    if (version >= 7) result -= 36;
  }
  return result;
}

function dataCodewordCount(version, level) {
  const blockCount = NUM_ERROR_CORRECTION_BLOCKS[level.ordinal][version];
  const eccLength = ECC_CODEWORDS_PER_BLOCK[level.ordinal][version];
  return Math.floor(rawDataModuleCount(version) / 8) - blockCount * eccLength;
}

function byteCountBits(version) {
  return version <= 9 ? 8 : 16;
}

function encodedBitLength(byteLength, version, includeEci) {
  const countBits = byteCountBits(version);
  if (byteLength >= 2 ** countBits) return Infinity;
  return (includeEci ? 12 : 0) + 4 + countBits + byteLength * 8;
}

function makeDataCodewords(bytes, version, level, includeEci) {
  const capacityBits = dataCodewordCount(version, level) * 8;
  const bits = [];

  if (includeEci) {
    appendBits(bits, MODE_ECI, 4);
    appendBits(bits, UTF8_ECI_ASSIGNMENT, 8);
  }

  appendBits(bits, MODE_BYTE, 4);
  appendBits(bits, bytes.length, byteCountBits(version));
  for (const byte of bytes) appendBits(bits, byte, 8);

  appendBits(bits, 0, Math.min(4, capacityBits - bits.length));
  appendBits(bits, 0, (8 - (bits.length % 8)) % 8);

  for (let pad = 0xEC; bits.length < capacityBits; pad ^= 0xEC ^ 0x11) {
    appendBits(bits, pad, 8);
  }

  const codewords = new Array(bits.length / 8).fill(0);
  bits.forEach((value, index) => {
    codewords[index >>> 3] |= value << (7 - (index & 7));
  });
  return codewords;
}

function reedSolomonMultiply(left, right) {
  let result = 0;
  for (let index = 7; index >= 0; index -= 1) {
    result = (result << 1) ^ ((result >>> 7) * 0x11D);
    result ^= ((right >>> index) & 1) * left;
  }
  return result;
}

function reedSolomonDivisor(degree) {
  const result = new Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;

  for (let index = 0; index < degree; index += 1) {
    for (let coefficient = 0; coefficient < result.length; coefficient += 1) {
      result[coefficient] = reedSolomonMultiply(result[coefficient], root);
      if (coefficient + 1 < result.length) result[coefficient] ^= result[coefficient + 1];
    }
    root = reedSolomonMultiply(root, 0x02);
  }
  return result;
}

function reedSolomonRemainder(data, divisor) {
  const result = new Array(divisor.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= reedSolomonMultiply(coefficient, factor);
    });
  }
  return result;
}

function addErrorCorrection(data, version, level) {
  const blockCount = NUM_ERROR_CORRECTION_BLOCKS[level.ordinal][version];
  const eccLength = ECC_CODEWORDS_PER_BLOCK[level.ordinal][version];
  const rawCodewords = Math.floor(rawDataModuleCount(version) / 8);
  const shortBlockCount = blockCount - (rawCodewords % blockCount);
  const shortBlockLength = Math.floor(rawCodewords / blockCount);
  const divisor = reedSolomonDivisor(eccLength);
  const blocks = [];
  let offset = 0;

  for (let index = 0; index < blockCount; index += 1) {
    const dataLength = shortBlockLength - eccLength + (index < shortBlockCount ? 0 : 1);
    const blockData = data.slice(offset, offset + dataLength);
    offset += dataLength;
    blocks.push({
      data: blockData,
      ecc: reedSolomonRemainder(blockData, divisor),
    });
  }

  const result = [];
  const longestDataBlock = Math.max(...blocks.map((block) => block.data.length));
  for (let index = 0; index < longestDataBlock; index += 1) {
    for (const block of blocks) {
      if (index < block.data.length) result.push(block.data[index]);
    }
  }
  for (let index = 0; index < eccLength; index += 1) {
    for (const block of blocks) result.push(block.ecc[index]);
  }

  if (offset !== data.length || result.length !== rawCodewords) {
    throw new Error("QR error-correction block construction failed");
  }
  return result;
}

class QrMatrixBuilder {
  constructor(version, level, dataCodewords, requestedMask) {
    this.version = version;
    this.level = level;
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));
    this.functionModules = Array.from({ length: this.size }, () => new Array(this.size).fill(false));

    this.drawFunctionPatterns();
    this.drawCodewords(addErrorCorrection(dataCodewords, version, level));

    if (requestedMask === -1) {
      let bestPenalty = Infinity;
      let bestMask = 0;
      for (let mask = 0; mask < 8; mask += 1) {
        this.applyMask(mask);
        this.drawFormatBits(mask);
        const penalty = this.penaltyScore();
        if (penalty < bestPenalty) {
          bestPenalty = penalty;
          bestMask = mask;
        }
        this.applyMask(mask);
      }
      this.mask = bestMask;
    } else {
      this.mask = requestedMask;
    }

    this.applyMask(this.mask);
    this.drawFormatBits(this.mask);
  }

  setFunctionModule(x, y, dark) {
    this.modules[y][x] = dark;
    this.functionModules[y][x] = true;
  }

  drawFunctionPatterns() {
    for (let index = 0; index < this.size; index += 1) {
      this.setFunctionModule(6, index, index % 2 === 0);
      this.setFunctionModule(index, 6, index % 2 === 0);
    }

    this.drawFinderPattern(3, 3);
    this.drawFinderPattern(this.size - 4, 3);
    this.drawFinderPattern(3, this.size - 4);

    const positions = this.alignmentPatternPositions();
    for (let xIndex = 0; xIndex < positions.length; xIndex += 1) {
      for (let yIndex = 0; yIndex < positions.length; yIndex += 1) {
        const overlapsFinder =
          (xIndex === 0 && yIndex === 0) ||
          (xIndex === 0 && yIndex === positions.length - 1) ||
          (xIndex === positions.length - 1 && yIndex === 0);
        if (!overlapsFinder) this.drawAlignmentPattern(positions[xIndex], positions[yIndex]);
      }
    }

    this.drawFormatBits(0);
    this.drawVersionBits();
  }

  drawFinderPattern(centerX, centerY) {
    for (let deltaY = -4; deltaY <= 4; deltaY += 1) {
      for (let deltaX = -4; deltaX <= 4; deltaX += 1) {
        const x = centerX + deltaX;
        const y = centerY + deltaY;
        if (x < 0 || y < 0 || x >= this.size || y >= this.size) continue;
        const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
        this.setFunctionModule(x, y, distance !== 2 && distance !== 4);
      }
    }
  }

  drawAlignmentPattern(centerX, centerY) {
    for (let deltaY = -2; deltaY <= 2; deltaY += 1) {
      for (let deltaX = -2; deltaX <= 2; deltaX += 1) {
        const distance = Math.max(Math.abs(deltaX), Math.abs(deltaY));
        this.setFunctionModule(centerX + deltaX, centerY + deltaY, distance !== 1);
      }
    }
  }

  alignmentPatternPositions() {
    if (this.version === 1) return [];
    const count = Math.floor(this.version / 7) + 2;
    const step = Math.floor((this.version * 8 + count * 3 + 5) / (count * 4 - 4)) * 2;
    const positions = [6];
    for (let position = this.size - 7; positions.length < count; position -= step) {
      positions.splice(1, 0, position);
    }
    return positions;
  }

  drawFormatBits(mask) {
    const data = (this.level.formatBits << 3) | mask;
    let remainder = data;
    for (let index = 0; index < 10; index += 1) {
      remainder = (remainder << 1) ^ ((remainder >>> 9) * 0x537);
    }
    const format = ((data << 10) | remainder) ^ 0x5412;

    for (let index = 0; index <= 5; index += 1) this.setFunctionModule(8, index, bit(format, index));
    this.setFunctionModule(8, 7, bit(format, 6));
    this.setFunctionModule(8, 8, bit(format, 7));
    this.setFunctionModule(7, 8, bit(format, 8));
    for (let index = 9; index < 15; index += 1) {
      this.setFunctionModule(14 - index, 8, bit(format, index));
    }

    for (let index = 0; index < 8; index += 1) {
      this.setFunctionModule(this.size - 1 - index, 8, bit(format, index));
    }
    for (let index = 8; index < 15; index += 1) {
      this.setFunctionModule(8, this.size - 15 + index, bit(format, index));
    }
    this.setFunctionModule(8, this.size - 8, true);
  }

  drawVersionBits() {
    if (this.version < 7) return;
    let remainder = this.version;
    for (let index = 0; index < 12; index += 1) {
      remainder = (remainder << 1) ^ ((remainder >>> 11) * 0x1F25);
    }
    const versionBits = (this.version << 12) | remainder;
    for (let index = 0; index < 18; index += 1) {
      const x = this.size - 11 + (index % 3);
      const y = Math.floor(index / 3);
      this.setFunctionModule(x, y, bit(versionBits, index));
      this.setFunctionModule(y, x, bit(versionBits, index));
    }
  }

  drawCodewords(codewords) {
    let bitIndex = 0;
    for (let right = this.size - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vertical = 0; vertical < this.size; vertical += 1) {
        for (let column = 0; column < 2; column += 1) {
          const x = right - column;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? this.size - 1 - vertical : vertical;
          if (!this.functionModules[y][x] && bitIndex < codewords.length * 8) {
            this.modules[y][x] = bit(codewords[bitIndex >>> 3], 7 - (bitIndex & 7));
            bitIndex += 1;
          }
        }
      }
    }
    if (bitIndex !== codewords.length * 8) throw new Error("QR data placement failed");
  }

  applyMask(mask) {
    for (let y = 0; y < this.size; y += 1) {
      for (let x = 0; x < this.size; x += 1) {
        let invert;
        switch (mask) {
          case 0: invert = (x + y) % 2 === 0; break;
          case 1: invert = y % 2 === 0; break;
          case 2: invert = x % 3 === 0; break;
          case 3: invert = (x + y) % 3 === 0; break;
          case 4: invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0; break;
          case 5: invert = ((x * y) % 2) + ((x * y) % 3) === 0; break;
          case 6: invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          case 7: invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0; break;
          default: throw new RangeError("QR mask must be -1 (automatic) or 0 to 7");
        }
        if (!this.functionModules[y][x] && invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  addRunHistory(runLength, history) {
    if (history[0] === 0) runLength += this.size;
    history.pop();
    history.unshift(runLength);
  }

  finderPatternCount(history) {
    const unit = history[1];
    const hasCore =
      unit > 0 &&
      history[2] === unit &&
      history[3] === unit * 3 &&
      history[4] === unit &&
      history[5] === unit;
    if (!hasCore) return 0;
    return Number(history[0] >= unit * 4 && history[6] >= unit) +
      Number(history[6] >= unit * 4 && history[0] >= unit);
  }

  terminateFinderRuns(currentDark, runLength, history) {
    if (currentDark) {
      this.addRunHistory(runLength, history);
      runLength = 0;
    }
    runLength += this.size;
    this.addRunHistory(runLength, history);
    return this.finderPatternCount(history);
  }

  linePenalty(line) {
    let score = 0;
    let currentDark = false;
    let runLength = 0;
    const history = [0, 0, 0, 0, 0, 0, 0];

    for (const dark of line) {
      if (dark === currentDark) {
        runLength += 1;
        if (runLength === 5) score += 3;
        else if (runLength > 5) score += 1;
      } else {
        this.addRunHistory(runLength, history);
        if (!currentDark) score += this.finderPatternCount(history) * 40;
        currentDark = dark;
        runLength = 1;
      }
    }
    return score + this.terminateFinderRuns(currentDark, runLength, history) * 40;
  }

  penaltyScore() {
    let score = 0;
    for (const row of this.modules) score += this.linePenalty(row);
    for (let x = 0; x < this.size; x += 1) {
      score += this.linePenalty(this.modules.map((row) => row[x]));
    }

    for (let y = 0; y < this.size - 1; y += 1) {
      for (let x = 0; x < this.size - 1; x += 1) {
        const color = this.modules[y][x];
        if (
          this.modules[y][x + 1] === color &&
          this.modules[y + 1][x] === color &&
          this.modules[y + 1][x + 1] === color
        ) {
          score += 3;
        }
      }
    }

    let darkCount = 0;
    for (const row of this.modules) {
      for (const dark of row) darkCount += Number(dark);
    }
    const total = this.size * this.size;
    const balance = Math.ceil(Math.abs(darkCount * 20 - total * 10) / total) - 1;
    return score + balance * 10;
  }
}

function normalizeEncodingOptions(options) {
  const {
    errorCorrection = "L",
    minVersion = 1,
    maxVersion = 40,
    mask = -1,
  } = options;
  const levelName = String(errorCorrection).toUpperCase();
  const level = LEVELS[levelName];

  if (!level) throw new RangeError("errorCorrection must be L, M, Q, or H");
  if (
    !Number.isInteger(minVersion) ||
    !Number.isInteger(maxVersion) ||
    minVersion < 1 ||
    maxVersion > 40 ||
    minVersion > maxVersion
  ) {
    throw new RangeError("QR versions must satisfy 1 <= minVersion <= maxVersion <= 40");
  }
  if (!Number.isInteger(mask) || mask < -1 || mask > 7) {
    throw new RangeError("mask must be -1 (automatic) or an integer from 0 to 7");
  }
  return { levelName, level, minVersion, maxVersion, mask };
}

/**
 * Encodes a string as one UTF-8 byte-mode QR Code.
 *
 * Returns an immutable object containing `modules`, `size`, `version`, `mask`,
 * `errorCorrection`, and `byteLength`. `modules[y][x]` is true for dark.
 */
export function encodeQr(text, options = {}) {
  if (typeof text !== "string") throw new TypeError("QR content must be a string");
  const normalized = normalizeEncodingOptions(options);
  const bytes = Array.from(new TextEncoder().encode(text));
  const includeEci = /[^\x00-\x7F]/u.test(text);
  let version = normalized.minVersion;

  for (; version <= normalized.maxVersion; version += 1) {
    const usedBits = encodedBitLength(bytes.length, version, includeEci);
    if (usedBits <= dataCodewordCount(version, normalized.level) * 8) break;
  }
  if (version > normalized.maxVersion) {
    throw new RangeError(
      `${bytes.length} UTF-8 bytes do not fit a Version ${normalized.maxVersion}-${normalized.levelName} QR code`,
    );
  }

  const data = makeDataCodewords(bytes, version, normalized.level, includeEci);
  const builder = new QrMatrixBuilder(version, normalized.level, data, normalized.mask);
  const modules = builder.modules.map((row) => Object.freeze(row.slice()));
  Object.freeze(modules);

  return Object.freeze({
    modules,
    size: builder.size,
    version,
    mask: builder.mask,
    errorCorrection: normalized.levelName,
    byteLength: bytes.length,
    getModule(x, y) {
      return Number.isInteger(x) && Number.isInteger(y) &&
        x >= 0 && y >= 0 && x < builder.size && y < builder.size
        ? modules[y][x]
        : false;
    },
  });
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll('"', "&quot;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function normalizeMatrix(qr) {
  const modules = Array.isArray(qr) ? qr : qr?.modules;
  if (
    !Array.isArray(modules) ||
    modules.length === 0 ||
    modules.some((row) => !Array.isArray(row) || row.length !== modules.length)
  ) {
    throw new TypeError("Expected a square QR module matrix or encodeQr() result");
  }
  return modules;
}

/**
 * Renders an encodeQr() result (or square Boolean matrix) as standalone SVG.
 * The default four-module quiet zone is required by the QR standard.
 */
export function qrToSvg(qr, options = {}) {
  const modules = normalizeMatrix(qr);
  const {
    border = 4,
    scale = 4,
    dark = "#000",
    light = "#fff",
    title = "QR code",
  } = options;
  if (!Number.isInteger(border) || border < 0) throw new RangeError("border must be a non-negative integer");
  if (!Number.isFinite(scale) || scale <= 0) throw new RangeError("scale must be greater than zero");

  const viewSize = modules.length + border * 2;
  const displaySize = viewSize * scale;
  const path = [];
  for (let y = 0; y < modules.length; y += 1) {
    for (let x = 0; x < modules.length;) {
      if (!modules[y][x]) {
        x += 1;
        continue;
      }
      const start = x;
      while (x < modules.length && modules[y][x]) x += 1;
      const length = x - start;
      path.push(`M${start + border} ${y + border}h${length}v1h-${length}z`);
    }
  }

  const accessibleTitle = title == null ? "QR code" : String(title);
  const titleMarkup = title == null ? "" : `<title>${escapeXml(title)}</title>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${viewSize} ${viewSize}" width="${displaySize}" height="${displaySize}" role="img" aria-label="${escapeXml(accessibleTitle)}" preserveAspectRatio="xMidYMid meet" shape-rendering="crispEdges">${titleMarkup}<rect width="100%" height="100%" fill="${escapeXml(light)}"/><path d="${path.join("")}" fill="${escapeXml(dark)}"/></svg>`;
}

/**
 * Convenience helper that encodes `text` and immediately returns SVG markup.
 * Encoding and SVG options can be supplied in the same object.
 */
export function createQrSvg(text, options = {}) {
  const {
    border,
    scale,
    dark,
    light,
    title,
    ...encodingOptions
  } = options;
  return qrToSvg(encodeQr(text, encodingOptions), { border, scale, dark, light, title });
}
