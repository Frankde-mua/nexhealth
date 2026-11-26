import React, { useState } from "react";
import type { Patient } from "./patients";
export type Consultation = {
  id: string;
  patientId: string;
  at: string;
  mode: string;
  reason: string;
  status: string;
  notes: { id: string; category: string; note: string; time: string }[];
  consents: { by: string; decision: string; scope: string; time: string }[];
  history: { time: string; action: string }[];
};
export function Clinical({
  patients,
  consultations,
  act,
  busy,
}: {
  patients: Patient[];
  consultations: Consultation[];
  act: (a: object) => void;
  busy: boolean;
}) {
  const [selected, setSelected] = useState("");
  const c = consultations.find((x) => x.id === selected);
  const p = patients.find((x) => x.id === c?.patientId);
  const fields = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  };
  const action = (type: string, extra: object) => {
    if (c)
      act({
        type: "clinical." + type,
        id: c.id,
        patientId: c.patientId,
        ...extra,
      });
  };
  const editable =
    c && p && !p.archived && ["scheduled", "in-progress"].includes(c.status);
  return (
    <section className="panel">
      <h2>Consultations</h2>
      <p>
        Practice-private records. Use fictional data only. Remote appointments
        do not include video calling.
      </p>
      <form
        className="form"
        onSubmit={(e) => {
          const f = fields(e);
          act({
            ...f,
            type: "clinical.schedule",
            at: new Date(String(f.at)).toISOString(),
          });
        }}
      >
        <label>
          Patient
          <select name="patientId" required>
            <option value="">Select patient</option>
            {patients
              .filter((p) => !p.archived)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </label>
        <label>
          Appointment (local time)
          <input name="at" type="datetime-local" required />
        </label>
        <label>
          Mode
          <select name="mode">
            <option value="in-person">In person</option>
            <option value="remote">Remote</option>
          </select>
        </label>
        <label>
          Reason
          <input name="reason" required maxLength={500} />
        </label>
        <button disabled={busy}>Schedule</button>
      </form>
      {consultations
        .slice()
        .sort((a, b) => a.at.localeCompare(b.at))
        .map((x) => (
          <article className="request" key={x.id}>
            <strong>
              {patients.find((p) => p.id === x.patientId)?.name || "Patient"} ·{" "}
              {new Date(x.at).toLocaleString()}
            </strong>
            <p>
              {x.mode} · {x.status} · {x.reason}
            </p>
            <button onClick={() => setSelected(x.id)}>Open consultation</button>
          </article>
        ))}
      {c && (
        <article className="request">
          <h3>
            {p?.name} — {c.status}
          </h3>
          {editable && (
            <>
              <form
                className="form"
                onSubmit={(e) => action("note", fields(e))}
              >
                <label>
                  Note category
                  <select name="category">
                    {[
                      "history",
                      "allergies",
                      "vitals",
                      "assessment",
                      "plan",
                    ].map((k) => (
                      <option key={k}>{k}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Clinical note
                  <textarea name="note" required maxLength={4000} />
                </label>
                <button disabled={busy}>Record note</button>
              </form>
              <form
                className="form"
                onSubmit={(e) => {
                  const f = fields(e);
                  action("consent", { ...f, attested: f.attested === "on" });
                }}
              >
                <label>
                  Consent source
                  <select name="by">
                    <option value="patient">Patient</option>
                    <option value="guardian">Guardian</option>
                  </select>
                </label>
                <label>
                  Guardian (if applicable)
                  <select name="guardianId">
                    <option value="">Select guardian</option>
                    {p?.guardians
                      .filter((g) => g.authority === "verified")
                      .map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                  </select>
                </label>
                <label>
                  Decision
                  <select name="decision">
                    <option>granted</option>
                    <option>declined</option>
                    <option>withdrawn</option>
                  </select>
                </label>
                <label>
                  Scope
                  <input name="scope" required maxLength={500} />
                </label>
                <label>
                  <input type="checkbox" name="attested" required /> I verified
                  capacity, authority and consent for this scope
                </label>
                <button disabled={busy}>Record consent</button>
              </form>
              {c.status === "scheduled" && (
                <button
                  disabled={busy}
                  onClick={() => action("status", { status: "in-progress" })}
                >
                  Start consultation
                </button>
              )}
              {c.status === "in-progress" && (
                <button
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Confirm practitioner review of assessment and plan?",
                      )
                    )
                      action("status", { status: "completed", attested: true });
                  }}
                >
                  Complete consultation
                </button>
              )}{" "}
              <button
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Cancel consultation?"))
                    action("status", { status: "cancelled" });
                }}
              >
                Cancel consultation
              </button>
            </>
          )}
          <h3>Clinical notes</h3>
          {c.notes.map((n) => (
            <p key={n.id}>
              {n.time} · {n.category}: {n.note}
            </p>
          ))}
          <h3>Consent history</h3>
          {c.consents.map((n, i) => (
            <p key={i}>
              {n.time} · {n.by} · {n.decision} · {n.scope}
            </p>
          ))}
          <h3>Activity</h3>
          {c.history.map((h, i) => (
            <p key={i}>
              {h.time} · {h.action}
            </p>
          ))}
        </article>
      )}
    </section>
  );
}
