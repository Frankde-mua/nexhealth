import { test } from "node:test";
import assert from "node:assert/strict";
import { apply, seed, summary } from "./core.mjs";
test("partial donations, over-allocation, stale transitions and closure", () => {
  let s = structuredClone(seed);
  const id = s.requests[0].id;
  const accept = (qty) => {
    s = apply(s, { type: "accept", id, qty, provider: "Demo" });
  };
  accept(6);
  assert.throws(() => accept(5));
  const advance = () => {
    const d = s.requests[0].donations.at(-1);
    for (let i = 0; i < 6; i++)
      s = apply(s, { type: "advance", id, donationId: d.id, expectedStage: i });
    assert.throws(() =>
      apply(s, { type: "advance", id, donationId: d.id, expectedStage: 0 }),
    );
  };
  advance();
  assert.equal(summary(s)[0].dispensed, 6);
  accept(4);
  advance();
  assert.equal(summary(s)[0].dispensed, 10);
  assert.throws(() => accept(1));
  assert.match(s.events[0].message, /completed/);
});
