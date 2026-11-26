import {catalogue} from './catalogue.mjs';
import pg from 'pg';
import {readFile} from 'node:fs/promises';
export async function openStore(initial){
 if(!process.env.DATABASE_URL) throw Error('DATABASE_URL is required (Neon PostgreSQL)');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5});
 const transaction=async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const out=await fn(c);await c.query('COMMIT');return out}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}};
 const persist=async(c,s)=>{
  for(const p of s.patients||[]) await c.query('INSERT INTO patients(id,owner,name,dob,archived,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,name=excluded.name,dob=excluded.dob,archived=excluded.archived,payload=excluded.payload',[p.id,p.owner,p.name,p.dob,p.archived,JSON.stringify(p)]);
  for(const x of s.consultations||[]) await c.query('INSERT INTO consultations(id,owner,patient_id,appointment_at,status,payload) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(id) DO UPDATE SET owner=excluded.owner,patient_id=excluded.patient_id,appointment_at=excluded.appointment_at,status=excluded.status,payload=excluded.payload',[x.id,x.owner,x.patientId,x.at,x.status,JSON.stringify(x)]);
  for(const k of ['prescriptions','invoices','inventory','stock_movements','ai_reports']) for(const x of s[k]||[]) await c.query(`INSERT INTO ${k}(id,owner,payload) VALUES($1,$2,$3) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload`,[x.id,x.owner,JSON.stringify(x)]);
  const {patients,consultations,prescriptions,invoices,inventory,stock_movements,ai_reports,...rest}=s;await c.query('UPDATE state SET payload=$1 WHERE id=1',[JSON.stringify(rest)]);
 };
 await transaction(async c=>{
  await c.query('SELECT pg_advisory_xact_lock(724721)');
  await c.query('CREATE TABLE IF NOT EXISTS state (id integer PRIMARY KEY, payload jsonb NOT NULL)');
  await c.query('INSERT INTO state VALUES (1,$1) ON CONFLICT (id) DO NOTHING',[JSON.stringify(initial)]);
  await c.query('CREATE TABLE IF NOT EXISTS patients (id text PRIMARY KEY, owner text NOT NULL, name text NOT NULL, dob date NOT NULL, archived boolean NOT NULL, payload jsonb NOT NULL, UNIQUE(id,owner))');
  await c.query('CREATE INDEX IF NOT EXISTS patients_owner_idx ON patients(owner)');
  await c.query('CREATE TABLE IF NOT EXISTS consultations (id text PRIMARY KEY, owner text NOT NULL, patient_id text NOT NULL, appointment_at timestamptz NOT NULL, status text NOT NULL, payload jsonb NOT NULL, FOREIGN KEY(patient_id,owner) REFERENCES patients(id,owner))');
  await c.query('CREATE INDEX IF NOT EXISTS consultations_patient_idx ON consultations(patient_id,owner)');
  await c.query('CREATE TABLE IF NOT EXISTS icd10_codes (code text PRIMARY KEY, description text NOT NULL, primary_code boolean NOT NULL, not_in_use boolean NOT NULL, reference_version text NOT NULL, source_row jsonb NOT NULL)');
  await c.query('CREATE TABLE IF NOT EXISTS recordings (id text PRIMARY KEY, consultation text NOT NULL, mime text NOT NULL, audio bytea NOT NULL)');
  await c.query("CREATE TABLE IF NOT EXISTS icd10_submissions(id text PRIMARY KEY,code text NOT NULL,description text NOT NULL,reference text NOT NULL,reason text NOT NULL,actor text NOT NULL,status text NOT NULL DEFAULT 'pending',created_at timestamptz DEFAULT now(),reviewer text,reviewed_at timestamptz)");
  await c.query("CREATE UNIQUE INDEX IF NOT EXISTS icd10_pending_unique ON icd10_submissions(code) WHERE status='pending'");
  await c.query("CREATE TABLE IF NOT EXISTS icd10_audit(id bigserial PRIMARY KEY,actor text NOT NULL,code text NOT NULL,action text NOT NULL,detail jsonb NOT NULL,created_at timestamptz DEFAULT now())");
  for(const k of ['prescriptions','invoices','inventory','stock_movements','ai_reports']) {await c.query(`CREATE TABLE IF NOT EXISTS ${k}(id text PRIMARY KEY,owner text NOT NULL,payload jsonb NOT NULL)`);await c.query(`CREATE INDEX IF NOT EXISTS ${k}_owner_idx ON ${k}(owner)`);}
  const s=(await c.query('SELECT payload FROM state WHERE id=1 FOR UPDATE')).rows[0].payload;
  if(Object.hasOwn(s,'patients')||Object.hasOwn(s,'consultations'))await persist(c,s);
  const rows=JSON.parse(await readFile(new URL('../data/icd10-full-2014.json',import.meta.url),'utf8'));
  if(rows.length!==40546||new Set(rows.map(r=>r.ICD10_Code)).size!==rows.length)throw Error('Incomplete ICD-10 seed');
  await c.query(`INSERT INTO icd10_codes SELECT r->>'ICD10_Code',r->>'WHO_Full_Desc',r->>'PrimaryCode'='T',r->>'NotInUse'='T','July 2014',r FROM jsonb_array_elements($1::jsonb) r ON CONFLICT(code) DO NOTHING`,[JSON.stringify(rows)]);
 });
 const load=async(c,lock)=>{const s=(await c.query('SELECT payload FROM state WHERE id=1 '+(lock?'FOR UPDATE':'FOR SHARE'))).rows[0].payload;s.patients=(await c.query('SELECT payload FROM patients')).rows.map(r=>r.payload);s.consultations=(await c.query('SELECT payload FROM consultations')).rows.map(r=>r.payload);for(const k of ['prescriptions','invoices','inventory','stock_movements','ai_reports'])s[k]=(await c.query(`SELECT payload FROM ${k}`)).rows.map(r=>r.payload);return s};
 const read=()=>transaction(c=>load(c,false));
 const tx=fn=>transaction(async c=>{const s=await load(c,true);const out=await fn(s);await persist(c,s);return out});
 const searchCodes=async q=>(await pool.query("SELECT code,description FROM icd10_codes WHERE primary_code AND NOT not_in_use AND (strpos(lower(code),$1)>0 OR strpos(lower(description),$1)>0) ORDER BY (lower(code)=$1) DESC,code LIMIT 30",[q])).rows;
 const lookupCode=async code=>(await pool.query('SELECT code,description,reference_version FROM icd10_codes WHERE code=$1 AND primary_code AND NOT not_in_use',[code])).rows[0];
 const saveRecording=async(id,consultation,mime,audio)=>pool.query('INSERT INTO recordings VALUES ($1,$2,$3,$4)',[id,consultation,mime,audio]);
 const getRecording=async(id,consultation)=>(await pool.query('SELECT mime,audio FROM recordings WHERE id=$1 AND consultation=$2',[id,consultation])).rows[0];
 const deleteRecording=async(id)=>pool.query('DELETE FROM recordings WHERE id=$1',[id]);
 return {manageCatalogue:catalogue(pool,transaction),read,tx,searchCodes,lookupCode,saveRecording,getRecording,deleteRecording};
}
