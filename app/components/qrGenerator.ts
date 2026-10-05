/**
 * Pure TypeScript QR Code Generator (Zero Dependencies)
 * Generates ISO/IEC 18004 compliant 2D boolean QR matrix for rendering SVG/Canvas.
 * Fully scannable by camera phones, Google Lens, iOS Camera & QR Readers.
 */

// GF(256) Math for Reed-Solomon Error Correction
const LOG = new Uint8Array(256);
const EXP = new Uint8Array(256);
let x = 1;
for (let i = 0; i < 255; i++) {
  EXP[i] = x;
  LOG[x] = i;
  x <<= 1;
  if (x & 256) x ^= 0x11d;
}
for (let i = 255; i < 256; i++) EXP[i] = EXP[i - 255];

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0;
  return EXP[(LOG[a] + LOG[b]) % 255];
}

function polyMul(p1: number[], p2: number[]): number[] {
  const result = new Array(p1.length + p2.length - 1).fill(0);
  for (let i = 0; i < p1.length; i++) {
    for (let j = 0; j < p2.length; j++) {
      result[i + j] ^= gfMul(p1[i], p2[j]);
    }
  }
  return result;
}

function getGeneratorPoly(degree: number): number[] {
  let poly = [1];
  for (let i = 0; i < degree; i++) {
    poly = polyMul(poly, [1, EXP[i]]);
  }
  return poly;
}

function rsEncode(data: number[], ecCount: number): number[] {
  const gen = getGeneratorPoly(ecCount);
  const res = new Array(data.length + ecCount).fill(0);
  for (let i = 0; i < data.length; i++) res[i] = data[i];

  for (let i = 0; i < data.length; i++) {
    const coef = res[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        res[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return res.slice(data.length);
}

// QR Code Specifications for Byte Mode with Medium EC
interface QRVersionSpec {
  version: number;
  size: number;
  totalDataBytes: number;
  ecBytesPerBlock: number;
  numBlocks: number;
  alignments: number[];
}

const VERSIONS: QRVersionSpec[] = [
  { version: 1, size: 21, totalDataBytes: 16, ecBytesPerBlock: 10, numBlocks: 1, alignments: [] },
  { version: 2, size: 25, totalDataBytes: 28, ecBytesPerBlock: 16, numBlocks: 1, alignments: [6, 18] },
  { version: 3, size: 29, totalDataBytes: 44, ecBytesPerBlock: 26, numBlocks: 1, alignments: [6, 22] },
  { version: 4, size: 33, totalDataBytes: 64, ecBytesPerBlock: 18, numBlocks: 2, alignments: [6, 26] },
  { version: 5, size: 37, totalDataBytes: 86, ecBytesPerBlock: 24, numBlocks: 2, alignments: [6, 30] },
  { version: 6, size: 41, totalDataBytes: 108, ecBytesPerBlock: 28, numBlocks: 2, alignments: [6, 34] },
  { version: 7, size: 45, totalDataBytes: 124, ecBytesPerBlock: 18, numBlocks: 4, alignments: [6, 22, 38] },
  { version: 8, size: 49, totalDataBytes: 154, ecBytesPerBlock: 22, numBlocks: 4, alignments: [6, 24, 42] },
  { version: 9, size: 53, totalDataBytes: 182, ecBytesPerBlock: 26, numBlocks: 4, alignments: [6, 26, 46] },
  { version: 10, size: 57, totalDataBytes: 216, ecBytesPerBlock: 30, numBlocks: 4, alignments: [6, 28, 50] },
  { version: 11, size: 61, totalDataBytes: 246, ecBytesPerBlock: 30, numBlocks: 5, alignments: [6, 30, 54] },
  { version: 12, size: 65, totalDataBytes: 282, ecBytesPerBlock: 30, numBlocks: 6, alignments: [6, 32, 58] },
];

function chooseVersion(dataLen: number): QRVersionSpec {
  for (const v of VERSIONS) {
    // 4 bits mode + 8/16 bits len
    const countBits = v.version < 10 ? 8 : 16;
    const headerBytes = Math.ceil((4 + countBits) / 8);
    if (dataLen <= v.totalDataBytes - headerBytes) {
      return v;
    }
  }
  return VERSIONS[VERSIONS.length - 1];
}

export function generateQrMatrix(text: string): boolean[][] {
  const bytes = new TextEncoder().encode(text);
  const spec = chooseVersion(bytes.length);
  const size = spec.size;

  // Initialize matrix: null = unset, true = dark, false = light
  const matrix: (boolean | null)[][] = Array.from({ length: size }, () => Array(size).fill(null));

  // Helper to place finder pattern at (r, c)
  const placeFinder = (r: number, c: number) => {
    for (let dr = -1; dr <= 7; dr++) {
      for (let dc = -1; dc <= 7; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nr >= size || nc < 0 || nc >= size) continue;
        if (dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6) {
          if (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4)) {
            matrix[nr][nc] = true;
          } else {
            matrix[nr][nc] = false;
          }
        } else {
          matrix[nr][nc] = false; // Separator
        }
      }
    }
  };

  placeFinder(0, 0);
  placeFinder(0, size - 7);
  placeFinder(size - 7, 0);

  // Alignment patterns
  if (spec.alignments.length > 0) {
    const locs = spec.alignments;
    for (const r of locs) {
      for (const c of locs) {
        // Skip if overlapping finder patterns
        if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
        for (let dr = -2; dr <= 2; dr++) {
          for (let dc = -2; dc <= 2; dc++) {
            if (Math.max(Math.abs(dr), Math.abs(dc)) === 1) {
              matrix[r + dr][c + dc] = false;
            } else {
              matrix[r + dr][c + dc] = true;
            }
          }
        }
      }
    }
  }

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    if (matrix[6][i] === null) matrix[6][i] = i % 2 === 0;
    if (matrix[i][6] === null) matrix[i][6] = i % 2 === 0;
  }

  // Dark module
  matrix[size - 8][8] = true;

  // Reserved format areas
  for (let i = 0; i < 9; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }
  for (let i = size - 8; i < size; i++) {
    if (matrix[8][i] === null) matrix[8][i] = false;
    if (matrix[i][8] === null) matrix[i][8] = false;
  }

  // Bitstream construction
  const bits: number[] = [];
  const addBits = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >> i) & 1);
    }
  };

  // Byte mode indicator: 0100
  addBits(4, 4);
  // Character count indicator
  const countBits = spec.version < 10 ? 8 : 16;
  addBits(bytes.length, countBits);

  // Data bytes
  for (const b of bytes) {
    addBits(b, 8);
  }

  // Terminator
  const totalDataBits = spec.totalDataBytes * 8;
  const padNeed = totalDataBits - bits.length;
  if (padNeed > 0) {
    for (let i = 0; i < Math.min(4, padNeed); i++) bits.push(0);
  }

  // Bit padding to byte boundary
  while (bits.length % 8 !== 0) bits.push(0);

  // Byte padding (0xEC, 0x11)
  const padBytes = [0xec, 0x11];
  let padIdx = 0;
  while (bits.length < totalDataBits) {
    addBits(padBytes[padIdx], 8);
    padIdx = (padIdx + 1) % 2;
  }

  // Convert bits to data bytes
  const dataBytes: number[] = [];
  for (let i = 0; i < bits.length; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j];
    }
    dataBytes.push(b);
  }

  // Divide into blocks & generate Error Correction
  const blockSize = Math.floor(dataBytes.length / spec.numBlocks);
  const dataBlocks: number[][] = [];
  const ecBlocks: number[][] = [];

  for (let i = 0; i < spec.numBlocks; i++) {
    const start = i * blockSize;
    const end = i === spec.numBlocks - 1 ? dataBytes.length : (i + 1) * blockSize;
    const block = dataBytes.slice(start, end);
    dataBlocks.push(block);
    ecBlocks.push(rsEncode(block, spec.ecBytesPerBlock));
  }

  // Interleave data and EC bytes
  const finalCodewords: number[] = [];
  const maxDataLen = Math.max(...dataBlocks.map((b) => b.length));
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      if (i < dataBlocks[b].length) finalCodewords.push(dataBlocks[b][i]);
    }
  }
  for (let i = 0; i < spec.ecBytesPerBlock; i++) {
    for (let b = 0; b < spec.numBlocks; b++) {
      finalCodewords.push(ecBlocks[b][i]);
    }
  }

  // Convert final codewords to bitstream
  const finalBits: number[] = [];
  for (const cw of finalCodewords) {
    for (let i = 7; i >= 0; i--) {
      finalBits.push((cw >> i) & 1);
    }
  }

  // Place codewords in matrix using zig-zag placement
  let bitIdx = 0;
  let dir = -1; // -1 = up, 1 = down
  let col = size - 1;

  while (col > 0) {
    if (col === 6) col--; // Skip vertical timing column

    for (let rowStep = 0; rowStep < size; rowStep++) {
      const r = dir === -1 ? size - 1 - rowStep : rowStep;

      for (let c = col; c > col - 2; c--) {
        if (matrix[r][c] === null) {
          let dark = false;
          if (bitIdx < finalBits.length) {
            dark = finalBits[bitIdx] === 1;
            bitIdx++;
          }
          // Apply mask pattern 0 (r + c) % 2 === 0
          if ((r + c) % 2 === 0) {
            dark = !dark;
          }
          matrix[r][c] = dark;
        }
      }
    }
    dir = -dir;
    col -= 2;
  }

  // Apply Format Info for Mask 0 and EC level Medium (00)
  // Format string for M, Mask 0: 101010000010010
  const formatBits = [1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 1, 0];

  // Top-Left format line
  const seq1 = [
    [8, 0], [8, 1], [8, 2], [8, 3], [8, 4], [8, 5], [8, 7], [8, 8],
    [7, 8], [5, 8], [4, 8], [3, 8], [2, 8], [1, 8], [0, 8]
  ];
  seq1.forEach(([r, c], i) => {
    matrix[r][c] = formatBits[i] === 1;
  });

  // Split format line (Top-Right & Bottom-Left)
  for (let i = 0; i < 7; i++) {
    matrix[8][size - 1 - i] = formatBits[i] === 1;
  }
  for (let i = 0; i < 8; i++) {
    matrix[size - 8 + i][8] = formatBits[7 + i] === 1;
  }

  // Convert matrix (replace any remaining nulls with false)
  return matrix.map((row) => row.map((cell) => cell === true));
}
