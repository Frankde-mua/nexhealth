import {randomUUID} from 'node:crypto';
const check=(ok,msg)=>{if(!ok)throw Error(msg)};
const text=(v,max=4000)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
export function clinicalView(s,u){return u.verified&&u.role==='practice'?(s.consultations||[]).filter(c=>c.owner===u.id):[]}
export function clinicalAction(s,u,a,now=new Date().toISOString()){
 check(u.verified&&u.role==='practice','Verified practice required');s.consultations??=[];
 const p=(s.patients||[]).find(p=>p.id===a.patientId&&p.owner===u.id&&!p.archived);check(p,'Active patient required');
 const audit=(c,action)=>c.history.push({time:now,actor:u.id,action});
 if(a.type==='clinical.schedule'){
 check(typeof a.at==='string'&&Number.isFinite(Date.parse(a.at))&&/Z$|[+-]\d\d:\d\d$/.test(a.at),'Appointment time with timezone required');check(['remote','in-person'].includes(a.mode)&&text(a.reason,500),'Valid appointment details required');
 const c={id:randomUUID(),owner:u.id,patientId:p.id,at:new Date(a.at).toISOString(),mode:a.mode,reason:a.reason,status:'scheduled',notes:[],consents:[],history:[]};s.consultations.push(c);audit(c,'Scheduled');return;
 }
 const c=s.consultations.find(c=>c.id===a.id&&c.owner===u.id&&c.patientId===p.id);check(c,'Consultation not found');
 if(a.type==='clinical.note'){
 check(c.status==='scheduled'||c.status==='in-progress','Consultation closed');check(['history','allergies','vitals','assessment','plan'].includes(a.category)&&text(a.note),'Valid clinical note required');c.notes.push({id:randomUUID(),category:a.category,note:a.note,actor:u.id,time:now});audit(c,'Note recorded');return;
 }
 if(a.type==='clinical.consent'){
 check(c.status==='scheduled'||c.status==='in-progress','Consultation closed');check(['patient','guardian'].includes(a.by)&&['granted','declined','withdrawn'].includes(a.decision)&&text(a.scope,500)&&a.attested===true,'Consent details and attestation required');
 if(a.by==='guardian')check(p.guardians.some(g=>g.id===a.guardianId&&g.authority==='verified'),'Verified guardian required');
 c.consents.push({by:a.by,guardianId:a.by==='guardian'?a.guardianId:null,decision:a.decision,scope:a.scope,time:now,actor:u.id});audit(c,'Consent recorded');return;
 }
 if(a.type==='clinical.status'){
 const allowed={scheduled:['in-progress','cancelled'], 'in-progress':['completed','cancelled']};check(allowed[c.status]?.includes(a.status),'Invalid status transition');if(a.status==='completed')check(c.notes.some(n=>n.category==='assessment')&&c.notes.some(n=>n.category==='plan')&&a.attested===true,'Assessment, plan and practitioner attestation required');c.status=a.status;audit(c,a.status);return;
 }
 throw Error('Unknown clinical action');
}
