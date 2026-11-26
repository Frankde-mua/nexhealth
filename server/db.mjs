import pg from 'pg';
export async function openStore(initial){
 if(!process.env.DATABASE_URL) throw Error('DATABASE_URL is required (Neon PostgreSQL)');
 const pool=new pg.Pool({connectionString:process.env.DATABASE_URL,max:5});
 await pool.query('CREATE TABLE IF NOT EXISTS state (id integer PRIMARY KEY, payload jsonb NOT NULL)');
 await pool.query('INSERT INTO state VALUES (1,$1) ON CONFLICT (id) DO NOTHING',[JSON.stringify(initial)]);
 const read=async()=> (await pool.query('SELECT payload FROM state WHERE id=1')).rows[0].payload;
 const tx=async fn=>{const c=await pool.connect();try{await c.query('BEGIN');const s=(await c.query('SELECT payload FROM state WHERE id=1 FOR UPDATE')).rows[0].payload;const out=fn(s);await c.query('UPDATE state SET payload=$1 WHERE id=1',[JSON.stringify(s)]);await c.query('COMMIT');return out}catch(e){await c.query('ROLLBACK');throw e}finally{c.release()}};
 await pool.query('CREATE TABLE IF NOT EXISTS recordings (id text PRIMARY KEY, consultation text NOT NULL, mime text NOT NULL, audio bytea NOT NULL)');
 const saveRecording=async(id,consultation,mime,audio)=>pool.query('INSERT INTO recordings VALUES ($1,$2,$3,$4)',[id,consultation,mime,audio]);
 const getRecording=async(id,consultation)=>(await pool.query('SELECT mime,audio FROM recordings WHERE id=$1 AND consultation=$2',[id,consultation])).rows[0];
 const deleteRecording=async(id)=>pool.query('DELETE FROM recordings WHERE id=$1',[id]);
 return {read,tx,saveRecording,getRecording,deleteRecording};
}
