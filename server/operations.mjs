import {fulfilment} from './fulfilment.mjs';
import {randomUUID} from 'node:crypto';
const check=(v,m)=>{if(!v)throw Error(m)};
const text=(v,n=200)=>typeof v==='string'&&v.trim()&&v.length<=n;
const integer=(v,min=1,max=1000000)=>Number.isSafeInteger(v)&&v>=min&&v<=max;
const keys=['prescriptions','invoices','inventory','stock_movements'];
export function operationsView(s,u){return Object.fromEntries(keys.map(k=>[k,u.verified&&u.role==='practice'?(s[k]||[]).filter(x=>x.owner===u.id):[]]))}
export function operationsAction(s,u,a,now=new Date().toISOString()){
 check(u.verified&&u.role==='practice','Verified practice required');for(const k of keys)s[k]??=[];
 const create=(k,data)=>{const x={id:randomUUID(),owner:u.id,...data,history:[{actor:u.id,time:now,action:'Created'}]};s[k].push(x);return x};
 const own=k=>{const x=s[k].find(x=>x.id===a.id&&x.owner===u.id);check(x,'Record not found');return x};
 const audit=(x,action)=>x.history.push({actor:u.id,time:now,action});
 const patient=()=>{const p=(s.patients||[]).find(p=>p.id===a.patientId&&p.owner===u.id&&!p.archived);check(p,'Active patient required');return p};
 switch(a.type){
 case 'ops.requestStock': case 'ops.issueStock': return fulfilment(s,u,a,now);
 case 'ops.prescription': {patient();const c=(s.consultations||[]).find(c=>c.id===a.consultationId&&c.owner===u.id&&c.patientId===a.patientId&&['in-progress','completed'].includes(c.status));check(c,'Eligible consultation required');check(['medication','strength','directions','prescriber'].every(k=>text(a[k],500))&&integer(a.quantity),'Medication, directions, quantity and prescriber required');return create('prescriptions',{patientId:a.patientId,consultationId:c.id,medication:a.medication,strength:a.strength,directions:a.directions,quantity:a.quantity,prescriber:a.prescriber,status:'draft'});}
 case 'ops.review': {const x=own('prescriptions');check(x.status==='draft'&&a.attested===true,'Draft and clinician attestation required');x.status='reviewed';audit(x,'Clinical review recorded (not legal signature)');return;}
 case 'ops.cancel': {const x=own('prescriptions');check(!(s.requests||[]).some(r=>r.linkedPrescription===x.id)&&!(s.stock_movements||[]).some(m=>m.prescriptionId===x.id),'Linked fulfilment requires manual reconciliation before cancellation');check(x.status!=='cancelled'&&text(a.reason),'Cancellation reason required');x.status='cancelled';audit(x,'Cancelled: '+a.reason);return;}
 case 'ops.invoice': {patient();check(text(a.description)&&integer(a.amountCents,1,100000000),'Valid description and ZAR amount required');return create('invoices',{patientId:a.patientId,description:a.description,amountCents:a.amountCents,paidCents:0,status:'open',payments:[]});}
 case 'ops.payment': {const x=own('invoices');check(x.status==='open'&&integer(a.amountCents,1,x.amountCents-x.paidCents)&&text(a.reference),'Valid payment amount and reference required');check(!x.payments.some(p=>p.reference===a.reference),'Duplicate payment reference');x.paidCents+=a.amountCents;x.payments.push({amountCents:a.amountCents,reference:a.reference,time:now,actor:u.id});if(x.paidCents===x.amountCents)x.status='paid';audit(x,'Manual payment recorded');return;}
 case 'ops.stock': {check(['medication','strength','batch'].every(k=>text(a[k]))&&integer(a.quantity)&&typeof a.expiry==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(a.expiry)&&Number.isFinite(Date.parse(a.expiry))&&new Date(a.expiry).toISOString().slice(0,10)===a.expiry&&a.expiry>now.slice(0,10),'Valid batch, future expiry and quantity required');check(!s.inventory.some(x=>x.owner===u.id&&['medication','strength','batch'].every(k=>x[k].toLowerCase()===a[k].toLowerCase())),'Batch already exists');return create('inventory',{medication:a.medication,strength:a.strength,batch:a.batch,expiry:a.expiry,quantity:a.quantity});}
 case 'ops.adjust': {const x=own('inventory');check(Number.isSafeInteger(a.delta)&&a.delta!==0&&integer(x.quantity+a.delta,0)&&text(a.reason),'Valid stock adjustment and reason required');check(a.delta<0||x.expiry>now.slice(0,10),'Expired stock cannot be increased');x.quantity+=a.delta;audit(x,`Adjustment ${a.delta}: ${a.reason}`);return;}
 default:throw Error('Unknown operations action');
 }
}
