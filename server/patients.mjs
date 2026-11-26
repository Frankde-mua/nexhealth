import {randomUUID} from 'node:crypto';
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
const text=(v,max=160)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
const date=v=>typeof v==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v))&&new Date(v).toISOString().slice(0,10)===v;
export function patientView(s,u){return u.verified&&u.role==='practice'?(s.patients||[]).filter(p=>p.owner===u.id):[]}
export function patientAction(s,u,a,now=new Date().toISOString()){
 check(u.verified&&u.role==='practice','Verified practice required');s.patients??=[];
 const audit=(p,action)=>{p.history.push({time:now,actor:u.id,action})};
 if(a.type==='patient.create'){
 check(text(a.name)&&date(a.dob)&&a.dob<=now.slice(0,10),'Valid name and birth date required');
 const p={id:randomUUID(),owner:u.id,name:a.name.trim(),dob:a.dob,guardians:[],history:[],archived:false};s.patients.push(p);audit(p,'Patient registered');return;
 }
 const p=s.patients.find(p=>p.id===a.patientId&&p.owner===u.id);check(p,'Patient not found');
 if(a.type==='patient.archive'){p.archived=true;audit(p,'Patient archived');return}
 check(!p.archived,'Patient archived');
 if(a.type==='patient.guardian'){
 check(text(a.name)&&text(a.relationship)&&text(a.contact)&&['pending','verified'].includes(a.authority),'Invalid guardian details');
 check(a.authority!=='verified'||a.attested===true,'Authority verification attestation required');
 p.guardians.push({id:randomUUID(),name:a.name.trim(),relationship:a.relationship,contact:a.contact,authority:a.authority,recordedAt:now});audit(p,'Guardian relationship recorded');return;
 }
 if(a.type==='patient.revoke'){const g=p.guardians.find(g=>g.id===a.guardianId);check(g,'Guardian not found');g.authority='revoked';audit(p,'Guardian authority revoked');return}
 throw Error('Unknown patient action');
}
