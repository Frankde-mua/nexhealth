import { randomUUID } from "node:crypto";
export const stages = [
  "Accepted",
  "Preparing",
  "Ready for collection",
  "In transit",
  "Received",
  "Verified",
  "Dispensed",
];
export const seed = {
  requests: [
    {
      id: "NH-00124",
      name: "Amoxicillin",
      strength: "250 mg/5 ml - Oral suspension",
      required: 10,
      urgency: "Urgent",
      location: "Cape Town",
      donations: [],
    },
  ],
  events: [],
};
export function apply(state, action) {
  const s = structuredClone(state);
  const fail = (m) => {
    throw Error(m);
  };
  const log = (message) =>
    s.events.unshift({ time: new Date().toISOString(), message });
  const a = action;
  let r = s.requests.find((x) => x.id === a.id);
  if (a.type === "create") {
    for (const k of ["name", "strength", "location"])
      if (typeof a[k] !== "string" || !a[k].trim() || a[k].length > 200)
        fail("Invalid " + k);
    if (
      !Number.isSafeInteger(a.required) ||
      a.required < 1 ||
      a.required > 100000 ||
      !["Routine", "Urgent", "Critical"].includes(a.urgency)
    )
      fail("Invalid request");
    r = {
      id: "NH-" + randomUUID(),
      name: a.name,
      strength: a.strength,
      location: a.location,
      required: a.required,
      urgency: a.urgency,
      donations: [],
    };
    s.requests.push(r);
    log(r.id + ": request created");
  } else {
    if (!r) fail("Unknown request");
    if (a.type === "accept") {
      const remaining = r.required - r.donations.reduce((n, d) => n + d.qty, 0);
      if (
        !Number.isSafeInteger(a.qty) ||
        a.qty < 1 ||
        a.qty > remaining ||
        typeof a.provider !== "string" ||
        !a.provider.trim() ||
        a.provider.length > 200
      )
        fail("Invalid offer");
      r.donations.push({
        id: randomUUID(),
        qty: a.qty,
        provider: a.provider,
        stage: 0,
      });
      log(r.id + ": " + a.qty + " units accepted");
    } else if (a.type === "advance") {
      const d = r.donations.find((x) => x.id === a.donationId);
      if (!d || d.stage >= 6 || a.expectedStage !== d.stage)
        fail("Invalid or stale transition");
      d.stage++;
      log(r.id + ": " + d.qty + " units " + stages[d.stage]);
      if (
        r.donations
          .filter((x) => x.stage === 6)
          .reduce((n, x) => n + x.qty, 0) === r.required
      )
        log(r.id + ": completed");
    } else fail("Unknown action");
  }
  return s;
}
export function summary(s) {
  return s.requests.map((r) => ({
    reference: r.id,
    urgency: r.urgency,
    required: r.required,
    allocated: r.donations.reduce((n, d) => n + d.qty, 0),
    verified: r.donations
      .filter((d) => d.stage >= 5)
      .reduce((n, d) => n + d.qty, 0),
    dispensed: r.donations
      .filter((d) => d.stage === 6)
      .reduce((n, d) => n + d.qty, 0),
    stages: r.donations.map((d) => ({
      quantity: d.qty,
      status: stages[d.stage],
    })),
  }));
}
