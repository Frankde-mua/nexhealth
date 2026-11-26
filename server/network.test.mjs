import test from "node:test";
import assert from "node:assert/strict";
import { apply, view, hashPassword, checkPassword } from "./network.mjs";
test("roles, offers, expiry, partial allocation, transitions and privacy", () => {
  const p = { id: "p", role: "practice", verified: true },
    q = { id: "q", role: "pharmacy", verified: true },
    other = { id: "x", role: "practice", verified: true };
  const s = { users: [p, q, other], requests: [], events: [] };
  const now = "2026-11-26T10:00:00Z";
  const create = {
    type: "create",
    name: "Demo",
    strength: "Demo",
    location: "Cape Town",
    prescriptionRef: "private",
    required: 10,
    urgency: "Routine",
    authorized: true,
  };
  assert.throws(() => apply(s, q, create, now));
  apply(s, p, create, now);
  const id = s.requests[0].id;
  const offer = {
    type: "offer",
    id,
    qty: 6,
    batch: "A",
    expiry: "2027-01-01",
    eligible: true,
  };
  assert.throws(() => apply(s, q, { ...offer, expiry: "2026-01-01" }, now));
  apply(s, q, offer, now);
  const offerId = s.requests[0].offers[0].id;
  assert.throws(() => apply(s, other, { type: "approve", id, offerId }, now));
  apply(s, p, { type: "approve", id, offerId }, now);
  assert.throws(() => apply(s, q, offer, now));
  assert.equal(view(s, q).requests[0].prescriptionRef, undefined);
  assert.equal(view(s, other).requests.length, 0);
  for (let i = 0; i < 6; i++) {
    const a = { type: "advance", id, offerId, expectedStage: i };
    assert.throws(() => apply(s, i < 3 ? p : q, a, now));
    apply(s, i < 3 ? q : p, a, now);
  }
  assert.equal(view(s, p).requests[0].dispensed, 6);
  apply(s, q, { ...offer, qty: 4 }, now);
  const second = s.requests[0].offers[1].id;
  apply(s, p, { type: "approve", id, offerId: second }, now);
  for (let i = 0; i < 6; i++)
    apply(
      s,
      i < 3 ? q : p,
      { type: "advance", id, offerId: second, expectedStage: i },
      now,
    );
  assert.equal(view(s, p).requests[0].dispensed, 10);
  assert.throws(() => apply(s, q, { ...offer, qty: 1 }, now));
});
test("password hashing", () => {
  const h = hashPassword("long-password");
  assert(checkPassword("long-password", h));
  assert(!checkPassword("wrong", h));
});
test("purchase quotes and restricted pharmacy feed", () => {
  const p = { id: "p", role: "practice", verified: true },
    q = { id: "q", role: "pharmacy", verified: true },
    x = { id: "x", role: "pharmacy", verified: true };
  const s = { users: [p, q, x], requests: [], events: [] };
  const now = "2026-11-26T10:00:00Z";
  apply(
    s,
    p,
    {
      type: "create",
      kind: "purchase",
      name: "Demo",
      strength: "Demo",
      location: "Cape Town",
      prescriptionRef: "private",
      required: 2,
      urgency: "Routine",
      authorized: true,
    },
    now,
  );
  const id = s.requests[0].id;
  const a = {
    type: "offer",
    id,
    qty: 2,
    batch: "A",
    expiry: "2027-01-01",
    eligible: true,
  };
  assert.throws(() => apply(s, q, a, now));
  apply(s, q, { ...a, unitPriceCents: 1250 }, now);
  assert.equal(view(s, x).requests[0].offers.length, 0);
  assert.equal(view(s, q).requests[0].owner, undefined);
  assert.equal(view(s, q).events.length, 0);
  assert.equal(view(s, p).requests[0].offers[0].unitPriceCents, 1250);
  apply(
    s,
    p,
    { type: "approve", id, offerId: s.requests[0].offers[0].id },
    now,
  );
  assert.equal(view(s, x).requests.length, 0);
  assert.equal(view(s, q).requests.length, 1);
});
