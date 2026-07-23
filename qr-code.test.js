import test from "node:test";
import assert from "node:assert/strict";

import {
  QR_BYTE_CAPACITY,
  createQrSvg,
  encodeQr,
  qrToSvg,
} from "./qr-code.js";

function finderCornersArePresent(qr) {
  const lastFinderStart = qr.size - 7;
  for (const [offsetX, offsetY] of [[0, 0], [lastFinderStart, 0], [0, lastFinderStart]]) {
    for (let y = 0; y < 7; y += 1) {
      for (let x = 0; x < 7; x += 1) {
        const expected = x === 0 || x === 6 || y === 0 || y === 6
          || (x >= 2 && x <= 4 && y >= 2 && y <= 4);
        if (qr.getModule(offsetX + x, offsetY + y) !== expected) return false;
      }
    }
  }
  return true;
}

test("QR encoder creates an immutable square Model 2 matrix with finder patterns", () => {
  const qr = encodeQr("HELLO WORLD");
  assert.equal(qr.version, 1);
  assert.equal(qr.size, 21);
  assert.match(qr.errorCorrection, /^[LMQH]$/);
  assert.ok(Number.isInteger(qr.mask) && qr.mask >= 0 && qr.mask <= 7);
  assert.equal(qr.modules.length, qr.size);
  assert.ok(qr.modules.every((row) => row.length === qr.size && row.every((cell) => typeof cell === "boolean")));
  assert.ok(finderCornersArePresent(qr));
  assert.ok(Object.isFrozen(qr));
  assert.ok(Object.isFrozen(qr.modules));
  assert.ok(Object.isFrozen(qr.modules[0]));
});

test("Version 1-L byte capacity is enforced at 17 ASCII bytes", () => {
  const full = encodeQr("x".repeat(17), { errorCorrection: "L", maxVersion: 1 });
  assert.equal(full.version, 1);
  assert.throws(
    () => encodeQr("x".repeat(18), { errorCorrection: "L", maxVersion: 1 }),
    /do not fit/i,
  );
});

test("automatic version selection reaches the declared Version 40-L capacity", () => {
  assert.equal(QR_BYTE_CAPACITY.L, 2953);
  const full = encodeQr("x".repeat(QR_BYTE_CAPACITY.L), { errorCorrection: "L" });
  assert.equal(full.version, 40);
  assert.equal(full.size, 177);
  assert.throws(
    () => encodeQr("x".repeat(QR_BYTE_CAPACITY.L + 1), { errorCorrection: "L" }),
    /do not fit/i,
  );
});

test("UTF-8 content is counted in bytes and remains deterministic", () => {
  const first = encodeQr("Fíanna 🛡️");
  const second = encodeQr("Fíanna 🛡️");
  assert.ok(first.byteLength > "Fíanna 🛡️".length);
  assert.deepEqual(first.modules, second.modules);
  assert.equal(first.mask, second.mask);
});

test("all error-correction levels and explicit masks produce valid-sized matrices", () => {
  for (const errorCorrection of ["L", "M", "Q", "H"]) {
    for (let mask = 0; mask < 8; mask += 1) {
      const qr = encodeQr("Fantastic Battles", { errorCorrection, mask });
      assert.equal(qr.size, 17 + qr.version * 4);
      assert.equal(qr.mask, mask);
      assert.equal(qr.errorCorrection, errorCorrection);
      assert.ok(finderCornersArePresent(qr));
    }
  }
});

test("SVG renderer includes a quiet zone, accessible title, and escaped colours", () => {
  const qr = encodeQr("https://example.test/battle.html#army=fb1.raw.example");
  const svg = qrToSvg(qr, {
    border: 4,
    scale: 2,
    title: 'Battle cards <"phone">',
    dark: "#18231f",
    light: "#fffdf8",
  });
  const viewSize = qr.size + 8;
  assert.match(svg, new RegExp(`viewBox="0 0 ${viewSize} ${viewSize}"`));
  assert.match(svg, /role="img"/);
  assert.ok(svg.includes("<title>Battle cards &lt;&quot;phone&quot;&gt;</title>"));
  assert.ok(svg.includes('fill="#18231f"'));
  assert.ok(svg.includes('fill="#fffdf8"'));
  assert.ok(svg.includes("<path d="));

  const direct = createQrSvg("Send this army", { border: 3, scale: 3 });
  assert.match(direct, /^<svg /);
  assert.match(direct, /shape-rendering="crispEdges"/);
});

test("invalid QR options and non-string content are rejected", () => {
  assert.throws(() => encodeQr(42), /string/i);
  assert.throws(() => encodeQr("x", { errorCorrection: "Z" }), /errorCorrection/i);
  assert.throws(() => encodeQr("x", { minVersion: 0 }), /versions/i);
  assert.throws(() => encodeQr("x", { minVersion: 4, maxVersion: 3 }), /versions/i);
  assert.throws(() => encodeQr("x", { mask: 8 }), /mask/i);
  assert.throws(() => qrToSvg([[true, false], [true]]), /square/i);
});
