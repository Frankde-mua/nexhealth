import React, { useState } from "react";
export type Patient = {
  id: string;
  name: string;
  dob: string;
  archived: boolean;
  guardians: {
    id: string;
    name: string;
    relationship: string;
    contact: string;
    authority: string;
  }[];
  history: { time: string; action: string }[];
};
export function Patients({
  patients,
  act,
  busy,
}: {
  patients: Patient[];
  act: (a: object) => void;
  busy: boolean;
}) {
  const [query, setQuery] = useState(""),
    [selected, setSelected] = useState(""),
    [archived, setArchived] = useState(false);
  const p = patients.find((p) => p.id === selected);
  const fields = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    return Object.fromEntries(new FormData(e.currentTarget));
  };
  return (
    <section className="panel">
      <h2>Patient register</h2>
      <p>
        Practice-private records. Guardian authority is not treatment consent.
      </p>
      <form
        className="form"
        onSubmit={(e) => act({ ...fields(e), type: "patient.create" })}
      >
        <label>
          Patient name
          <input name="name" required maxLength={160} />
        </label>
        <label>
          Date of birth
          <input
            name="dob"
            type="date"
            required
            max={new Date().toISOString().slice(0, 10)}
          />
        </label>
        <button disabled={busy}>Register patient</button>
      </form>
      <label>
        Search patients
        <input value={query} onChange={(e) => setQuery(e.target.value)} />
      </label>
      <label>
        <input
          type="checkbox"
          checked={archived}
          onChange={(e) => setArchived(e.target.checked)}
        />{" "}
        Show archived
      </label>
      {patients
        .filter(
          (p) =>
            (archived || !p.archived) &&
            p.name.toLowerCase().includes(query.toLowerCase()),
        )
        .map((p) => (
          <article className="request" key={p.id}>
            <strong>{p.name}</strong>
            <p>
              {p.dob} · {p.archived ? "Archived" : "Active"} ·{" "}
              {p.guardians.length} guardians
            </p>
            <button onClick={() => setSelected(p.id)}>Open record</button>
          </article>
        ))}
      {p && (
        <article className="request">
          <h2>{p.name}</h2>
          <p>Patient reference: {p.id}</p>
          <h3>Guardians</h3>
          {p.guardians.map((g) => (
            <div className="event" key={g.id}>
              {g.name} · {g.relationship} · {g.contact} · {g.authority}
              {!p.archived && g.authority !== "revoked" && (
                <button
                  disabled={busy}
                  onClick={() =>
                    act({
                      type: "patient.revoke",
                      patientId: p.id,
                      guardianId: g.id,
                    })
                  }
                >
                  Revoke authority
                </button>
              )}
            </div>
          ))}
          {!p.archived && (
            <>
              <form
                className="form"
                onSubmit={(e) => {
                  const f = fields(e);
                  act({
                    ...f,
                    type: "patient.guardian",
                    patientId: p.id,
                    attested: f.attested === "on",
                  });
                }}
              >
                <label>
                  Guardian name
                  <input name="name" required />
                </label>
                <label>
                  Relationship
                  <input name="relationship" required />
                </label>
                <label>
                  Contact
                  <input name="contact" required />
                </label>
                <label>
                  Authority status
                  <select name="authority">
                    <option value="pending">Pending review</option>
                    <option value="verified">Verified by practice</option>
                  </select>
                </label>
                <label>
                  <input name="attested" type="checkbox" /> I checked evidence
                  of authority
                </label>
                <button disabled={busy}>Record guardian</button>
              </form>
              <button
                disabled={busy}
                onClick={() => {
                  if (window.confirm("Archive this patient record?"))
                    act({ type: "patient.archive", patientId: p.id });
                }}
              >
                Archive patient
              </button>
            </>
          )}
          <h3>Record history</h3>
          {p.history.map((h, i) => (
            <p key={i}>
              {h.time} · {h.action}
            </p>
          ))}
        </article>
      )}
    </section>
  );
}
