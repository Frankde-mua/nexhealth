import {randomUUID} from 'node:crypto';
import {apply} from './network.mjs';
const check=(v,m)=>{if(!v)throw Error(m)};
const same=(a,b)=>String(a).trim().toLowerCase()===String(b).trim().toLowerCase();
export function fulfilment(s,u,a,now=new Date().toISOString()){
 check(u?.verified&&u.role==='practice','Verified practice required');
 s.stock_movements??=[];s.inventory??=[];
 const p=(s.prescriptions||[]).find(x=>x.id===a.id&&x.owner===u.id);
 check(p&&p.status==='reviewed'&&(s.patients||[]).some(x=>x.id===p.patientId&&x.owner===u.id&&!x.archived),'Reviewed prescription and active patient required');
 const linked=s.requests.filter(r=>r.owner===u.id&&r.linkedPrescription===p.id);
 const direct=s.stock_movements.filter(m=>m.prescriptionId===p.id&&m.kind==='issue').reduce((n,m)=>n+m.quantity,0);
 const reserved=linked.reduce((n,r)=>n+r.required,0);
 const qty=a.quantity;check(Number.isSafeInteger(qty)&&qty>0&&qty<=p.quantity-direct-reserved,'Quantity exceeds uncommitted prescription balance');
 if(a.type==='ops.requestStock'){
  check(['donation','purchase'].includes(a.kind),'Invalid request kind');
  apply(s,u,{type:'create',name:p.medication,strength:p.strength,required:qty,location:a.location,urgency:a.urgency,kind:a.kind,prescriptionRef:p.id,authorized:a.attested},now);
  s.requests.at(-1).linkedPrescription=p.id;
 }else if(a.type==='ops.issueStock'){
  check(a.attested===true,'Actual handover attestation required');const b=s.inventory.find(x=>x.id===a.batchId&&x.owner===u.id);
  check(b&&same(b.medication,p.medication)&&same(b.strength,p.strength)&&b.expiry>now.slice(0,10)&&b.quantity>=qty,'Matching unexpired stock required');
  b.quantity-=qty;b.history.push({actor:u.id,time:now,action:`Actual handover: ${qty}`});
  s.stock_movements.push({id:randomUUID(),owner:u.id,prescriptionId:p.id,batchId:b.id,quantity:qty,kind:'issue',time:now,actor:u.id});
 }else throw Error('Unknown fulfilment action');
}
export function networkAdvance(s,u,a,now=new Date().toISOString()){
 const r=s.requests.find(x=>x.id===a.id),o=r?.offers.find(x=>x.id===a.offerId);
 if(a.type==='advance'&&r?.linkedPrescription&&o?.stage===5){
  const p=(s.prescriptions||[]).find(x=>x.id===r.linkedPrescription&&x.owner===r.owner);
  check(p?.status==='reviewed'&&(s.patients||[]).some(x=>x.id===p.patientId&&x.owner===r.owner&&!x.archived),'Active reviewed prescription required');
  check(a.expectedStage===5,'Stale transition');
  apply(s,u,a,now);s.stock_movements??=[];
  s.stock_movements.push({id:randomUUID(),owner:r.owner,prescriptionId:p.id,requestId:r.id,offerId:o.id,batch:o.batch,expiry:o.expiry,quantity:o.qty,kind:'external-handover',time:now,actor:u.id});return;
 }apply(s,u,a,now);
}
