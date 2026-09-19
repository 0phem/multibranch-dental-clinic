export const TODAY = '2026-09-19'

export const MODULES = [
  { no: 1, name: 'User, Role & Access Management', owner: 'Licanda, Celin', area: 'Administration', roles: ['owner'] },
  { no: 2, name: 'Multi-Branch Clinic Management', owner: 'Licanda, Celin', area: 'Administration', roles: ['owner'] },
  { no: 3, name: 'Dentist & Staff Management', owner: 'Licanda, Celin', area: 'Administration', roles: ['owner'] },
  { no: 4, name: 'Patient Records Management', owner: 'Ecal, Richmon', area: 'Clinical', roles: ['staff','dentist'] },
  { no: 5, name: 'Treatment & Clinical Workflow Management', owner: 'Ecal, Richmon', area: 'Clinical', roles: ['dentist'] },
  { no: 6, name: 'Core Appointment Booking & Schedule Management', owner: 'Alejo, Hart Jaztin A.', area: 'Scheduling', roles: ['patient','staff'] },
  { no: 7, name: 'Smart Scheduling & Conflict Prevention', owner: 'Alejo, Hart Jaztin A.', area: 'Scheduling', roles: ['patient','staff','owner'] },
  { no: 8, name: 'Patient Check-In Management', owner: 'Alejo, Hart Jaztin A.', area: 'Patient Flow', roles: ['staff'] },
  { no: 9, name: 'Smart Patient Queue Management', owner: 'Alejo, Hart Jaztin A.', area: 'Patient Flow', roles: ['patient','staff','dentist'] },
  { no: 10, name: 'Waiting-Time & Patient Flow Capacity Management', owner: 'Alejo, Hart Jaztin A.', area: 'Patient Flow', roles: ['patient','staff','owner'] },
  { no: 11, name: 'Billing & Payment Management', owner: 'Ecal, Richmon', area: 'Finance', roles: ['patient','staff'] },
  { no: 12, name: 'HMO Verification & Documentation Management', owner: 'Delos Santos, Joevan', area: 'HMO', roles: ['staff','owner'] },
  { no: 13, name: 'HMO Request & Approval Management', owner: 'Delos Santos, Joevan', area: 'HMO', roles: ['staff','owner'] },
  { no: 14, name: 'HMO Follow-Up & Escalation Automation', owner: 'Delos Santos, Joevan', area: 'HMO', roles: ['staff','owner'] },
  { no: 15, name: 'Staff Workload & Cross-Branch Capacity Automation', owner: 'Licanda, Celin', area: 'Operations', roles: ['staff','owner'] },
  { no: 16, name: 'Social Media Inquiry Management', owner: 'Millar, John Yzhekiel', area: 'Communication', roles: ['staff'] },
  { no: 17, name: 'Unified Patient Messaging Management', owner: 'Millar, John Yzhekiel', area: 'Communication', roles: ['patient','staff','dentist'] },
  { no: 18, name: 'Real-Time Patient Notification Management', owner: 'Millar, John Yzhekiel', area: 'Communication', roles: ['patient','staff'] },
  { no: 19, name: 'Digital Prescription Management', owner: 'Ecal, Richmon', area: 'Clinical', roles: ['patient','dentist'] },
  { no: 20, name: 'Treatment Follow-Up Scheduling Management', owner: 'Ecal, Richmon', area: 'Clinical', roles: ['patient','staff','dentist'] },
  { no: 21, name: 'Operational Reporting & Analytics Management', owner: 'Delos Santos, Joevan', area: 'Analytics', roles: ['owner'] },
  { no: 22, name: 'Owner Executive Dashboard & Business Intelligence', owner: 'Licanda, Celin', area: 'Analytics', roles: ['owner'] },
  { no: 23, name: 'Integrated Workflow & Automation Control', owner: 'Delos Santos, Joevan', area: 'Automation', roles: ['owner'] },
  { no: 24, name: 'Referral & Loyalty Management', owner: 'Millar, John Yzhekiel', area: 'Engagement', roles: ['patient','staff','owner'], pe: true },
  { no: 25, name: 'Marketing, Reactivation & Patient Engagement Management', owner: 'Millar, John Yzhekiel', area: 'Engagement', roles: ['staff','owner'], pe: true },
]

export const ROLE_INFO = {
  patient: { label: 'Patient', name: 'Maria Santos', subtitle: 'Patient Portal', patientId: 'p1' },
  staff: { label: 'Staff', name: 'Alyssa Cruz', subtitle: 'Receptionist / Patient Services', userId: 'u2', branch: 'Branch A' },
  dentist: { label: 'Dentist', name: 'Dr. Miguel Reyes', subtitle: 'Clinical Services', userId: 'u3', dentistId: 'd1', branch: 'Branch A' },
  owner: { label: 'Owner / Admin', name: 'Dr. Dana Roxas', subtitle: 'Clinic Owner / Administrator', userId: 'u1', branch: 'All Branches' },
}

export const NAV = {
  patient: [
    ['dashboard','Dashboard'], ['book','Book Appointment'], ['appointments','My Appointments'], ['queue','Queue & Wait'],
    ['messages','Messages & Updates'], ['billing','Bills & Receipts'], ['prescriptions','Prescriptions'], ['followups','Follow-Ups'], ['loyalty','Referral & Loyalty • PE']
  ],
  staff: [
    ['dashboard','Dashboard'], ['appointments','Appointments'], ['checkin','Check-In'], ['queue','Patient Queue'], ['capacity','Capacity & Workload'],
    ['patients','Patient Records'], ['billing','Billing'], ['hmo','HMO'], ['inquiries','Social Inquiries'], ['messages','Messages'], ['followups','Follow-Ups'], ['engagement','Engagement • PE']
  ],
  dentist: [
    ['dashboard','Dashboard'], ['schedule','My Schedule'], ['queue','My Queue'], ['patients','Patient Records'], ['treatment','Treatment'],
    ['prescriptions','Prescriptions'], ['followups','Follow-Ups'], ['messages','Messages']
  ],
  owner: [
    ['dashboard','Executive Dashboard'], ['branches','Branches'], ['team','Staff & Dentists'], ['capacity','Capacity & Workload'], ['analytics','Analytics & Reports'],
    ['users','Users & Access'], ['hmo','HMO Overview'], ['automation','Automation Control'], ['engagement','Engagement • PE'], ['modules','25-Module Coverage']
  ],
}

export const SERVICES = [
  { name:'Dental Consultation', duration:30, category:'General Dentistry' },
  { name:'Oral Prophylaxis', duration:45, category:'General Dentistry' },
  { name:'Composite Restoration', duration:60, category:'General Dentistry' },
  { name:'Tooth Extraction', duration:60, category:'Oral Surgery' },
  { name:'Root Canal Treatment', duration:90, category:'General Dentistry' },
  { name:'Orthodontic Adjustment', duration:45, category:'Orthodontics' },
  { name:'Pediatric Consultation', duration:30, category:'Pediatric Dentistry' },
  { name:'Teeth Whitening', duration:75, category:'Teeth Whitening' },
  { name:'Dental Implant Consultation', duration:45, category:'Dental Implant' },
  { name:'TMD / Orofacial Pain Consultation', duration:45, category:'TMD / Orofacial Pain' },
  { name:'Follow-Up', duration:30, category:'General Dentistry' },
]

export const INITIAL_BRANCHES = [
  { id:'b1', name:'Branch A', address:'Main clinic • Central district', open:'09:00', close:'18:00', status:'Open', threshold:80, services:['General Dentistry','Orthodontics','Oral Surgery'], phone:'(02) 8123 1001' },
  { id:'b2', name:'Branch B', address:'North clinic • Business district', open:'09:00', close:'18:00', status:'Open', threshold:80, services:['General Dentistry','Pediatric Dentistry','Teeth Whitening'], phone:'(02) 8123 1002' },
  { id:'b3', name:'Branch C', address:'South clinic • Medical complex', open:'10:00', close:'19:00', status:'Open', threshold:75, services:['General Dentistry','TMD / Orofacial Pain','Dental Implant'], phone:'(02) 8123 1003' },
]

export const INITIAL_DENTISTS = [
  { id:'d1', name:'Dr. Miguel Reyes', branches:['Branch A'], specialty:'General Dentistry', shiftStart:'09:00', shiftEnd:'18:00', available:true, assistant:'Nina Torres' },
  { id:'d2', name:'Dr. Patricia Lim', branches:['Branch A'], specialty:'Orthodontics', shiftStart:'10:00', shiftEnd:'19:00', available:true, assistant:'Joel Ramos' },
  { id:'d3', name:'Dr. Carlo Mendoza', branches:['Branch B'], specialty:'Pediatric Dentistry', shiftStart:'09:00', shiftEnd:'18:00', available:true, assistant:'Mia Santos' },
  { id:'d4', name:'Dr. Andrea Flores', branches:['Branch C'], specialty:'Dental Implant', shiftStart:'10:00', shiftEnd:'19:00', available:true, assistant:'Ken Bautista' },
  { id:'d5', name:'Dr. Luis Navarro', branches:['Branch B','Branch C'], specialty:'General Dentistry', shiftStart:'11:00', shiftEnd:'19:00', available:true, assistant:'Grace Tan' },
]

export const INITIAL_STAFF = [
  { id:'s1', name:'Alyssa Cruz', role:'Receptionist', branch:'Branch A', shift:'09:00–18:00', status:'Active' },
  { id:'s2', name:'Marco Villanueva', role:'HMO Coordinator', branch:'Branch B', shift:'09:00–18:00', status:'Active' },
  { id:'s3', name:'Nina Torres', role:'Dental Assistant', branch:'Branch A', shift:'09:00–18:00', status:'Active' },
  { id:'s4', name:'Lea Mendoza', role:'Cashier', branch:'Branch C', shift:'10:00–19:00', status:'Active' },
  { id:'s5', name:'Mika Ramos', role:'Patient Engagement Staff', branch:'All Branches', shift:'09:00–18:00', status:'Active' },
]

export const INITIAL_PATIENTS = [
  { id:'p1', name:'Maria Santos', dob:'1998-05-17', sex:'Female', phone:'0917 123 4567', email:'maria@example.com', address:'Meycauayan, Bulacan', preferredBranch:'Branch A', hmo:'MediCare Plus', hmoMember:'MC-10082', allergies:'None', medicalHistory:'No significant medical history.', dentalHistory:'Routine prophylaxis; mild gingivitis noted previously.', emergencyContact:'Ana Santos • 0917 555 0909', consent:true },
  { id:'p2', name:'John Dela Cruz', dob:'1994-11-02', sex:'Male', phone:'0918 221 9001', email:'john@example.com', address:'Quezon City', preferredBranch:'Branch B', hmo:'HealthFirst', hmoMember:'HF-22015', allergies:'Penicillin', medicalHistory:'Controlled hypertension.', dentalHistory:'Composite restoration on #26.', emergencyContact:'Joy Dela Cruz • 0918 111 2222', consent:true },
  { id:'p3', name:'Bianca Ramos', dob:'2001-03-20', sex:'Female', phone:'0920 883 2104', email:'bianca@example.com', address:'Manila', preferredBranch:'Branch A', hmo:'None', hmoMember:'—', allergies:'None', medicalHistory:'None declared.', dentalHistory:'Active orthodontic treatment.', emergencyContact:'Lara Ramos • 0920 811 1919', consent:true },
  { id:'p4', name:'Paolo Garcia', dob:'1988-08-09', sex:'Male', phone:'0916 444 0310', email:'paolo@example.com', address:'Pasay City', preferredBranch:'Branch C', hmo:'MediCare Plus', hmoMember:'MC-88912', allergies:'Latex', medicalHistory:'Asthma, controlled.', dentalHistory:'Extraction of #48; follow-up required.', emergencyContact:'Mina Garcia • 0916 220 1000', consent:true },
]

export const INITIAL_APPOINTMENTS = [
  { id:'a1', patientId:'p1', branch:'Branch A', dentistId:'d1', service:'Oral Prophylaxis', date:'2026-09-19', start:'10:00', duration:45, status:'Confirmed', source:'Portal', notes:'Routine cleaning' },
  { id:'a2', patientId:'p2', branch:'Branch B', dentistId:'d3', service:'Dental Consultation', date:'2026-09-19', start:'11:00', duration:30, status:'Confirmed', source:'Front Desk', notes:'Tooth sensitivity' },
  { id:'a3', patientId:'p3', branch:'Branch A', dentistId:'d2', service:'Orthodontic Adjustment', date:'2026-09-19', start:'13:30', duration:45, status:'Confirmed', source:'Front Desk', notes:'Monthly adjustment' },
  { id:'a4', patientId:'p4', branch:'Branch C', dentistId:'d4', service:'Follow-Up', date:'2026-09-20', start:'10:30', duration:30, status:'Confirmed', source:'Follow-Up Task', notes:'Post-extraction review' },
  { id:'a5', patientId:'p2', branch:'Branch B', dentistId:'d3', service:'Composite Restoration', date:'2026-09-19', start:'14:00', duration:60, status:'Pending', source:'Front Desk', notes:'Pending patient confirmation' },
]

export const INITIAL_QUEUE = [
  { id:'q1', appointmentId:'a1', patientId:'p1', branch:'Branch A', dentistId:'d1', checkedIn:'09:46', status:'Waiting', priority:'Normal', position:1, calledAt:null, readyAt:null, completedAt:null, skipCount:0 },
  { id:'q2', appointmentId:'a3', patientId:'p3', branch:'Branch A', dentistId:'d2', checkedIn:'09:51', status:'Waiting', priority:'Normal', position:1, calledAt:null, readyAt:null, completedAt:null, skipCount:0 },
  { id:'q3', appointmentId:'a2', patientId:'p2', branch:'Branch B', dentistId:'d3', checkedIn:'10:02', status:'Waiting', priority:'Priority', position:1, calledAt:null, readyAt:null, completedAt:null, skipCount:0 },
]

export const INITIAL_TREATMENTS = [
  { id:'t1', patientId:'p4', appointmentId:'old-a4', dentistId:'d4', assistant:'Ken Bautista', date:'2026-09-13', complaint:'Pain from impacted wisdom tooth', plan:'Extraction and post-op review', procedure:'Surgical extraction #48', status:'Completed', notes:'Procedure tolerated well. Hemostasis achieved.', startedAt:'14:05', completedAt:'15:10', followupRequired:true, prescriptionRequired:true },
  { id:'t2', patientId:'p1', appointmentId:'old-a1', dentistId:'d1', assistant:'Nina Torres', date:'2026-09-12', complaint:'Routine cleaning', plan:'Oral prophylaxis', procedure:'Oral prophylaxis', status:'Completed', notes:'Mild gingivitis. Oral hygiene instructions given.', startedAt:'10:03', completedAt:'10:42', followupRequired:true, prescriptionRequired:false },
]

export const INITIAL_INVOICES = [
  { id:'inv1', treatmentId:'t2', patientId:'p1', visitDate:'2026-09-12', branch:'Branch A', items:[{name:'Consultation',amount:600},{name:'Oral Prophylaxis',amount:1200}], total:1800, status:'Paid', method:'GCash', paidAt:'2026-09-12 10:50', receipt:'OR-2026-0912-001' },
  { id:'inv2', treatmentId:null, patientId:'p2', visitDate:'2026-09-15', branch:'Branch B', items:[{name:'Composite Restoration',amount:2500}], total:2500, status:'Pending', method:'—', paidAt:null, receipt:null },
  { id:'inv3', treatmentId:'t1', patientId:'p4', visitDate:'2026-09-13', branch:'Branch C', items:[{name:'Surgical Extraction',amount:4500}], total:4500, status:'Paid', method:'Card', paidAt:'2026-09-13 15:22', receipt:'OR-2026-0913-008' },
]

export const INITIAL_HMO = [
  { id:'h1', patientId:'p1', provider:'MediCare Plus', memberId:'MC-10082', treatment:'Oral Prophylaxis', branch:'Branch A', eligibility:'Verified', documents:['ID','HMO Card','Treatment Request'], missing:[], status:'Pending', submittedAt:'2026-09-18 10:15', pendingHours:22, reference:'HMO-2026-0918-01', followUpCount:1, lastContact:'2026-09-19 08:10', providerOutcome:null },
  { id:'h2', patientId:'p2', provider:'HealthFirst', memberId:'HF-22015', treatment:'Composite Restoration', branch:'Branch B', eligibility:'Verified', documents:['HMO Card'], missing:['Valid ID','Dentist treatment request'], status:'Missing Requirements', submittedAt:null, pendingHours:0, reference:null, followUpCount:0, lastContact:null, providerOutcome:null },
  { id:'h3', patientId:'p4', provider:'MediCare Plus', memberId:'MC-88912', treatment:'Follow-Up', branch:'Branch C', eligibility:'Verified', documents:['ID','HMO Card','Treatment Request'], missing:[], status:'Approved', submittedAt:'2026-09-17 14:30', pendingHours:0, reference:'HMO-2026-0917-04', followUpCount:0, lastContact:'2026-09-18 09:00', providerOutcome:'Approved' },
]

export const INITIAL_INQUIRIES = [
  { id:'inq1', source:'Facebook', name:'Prospective Patient', contact:'Messenger', topic:'Braces price and schedule', status:'Open', assigned:'Alyssa Cruz', receivedAt:'2026-09-19 08:01', respondedAt:null, bookedAppointmentId:null },
  { id:'inq2', source:'Instagram', name:'Nicole Reyes', contact:'@nicole.reyes', topic:'Teeth whitening availability', status:'Responded', assigned:'Mika Ramos', receivedAt:'2026-09-18 16:30', respondedAt:'2026-09-18 16:41', bookedAppointmentId:null },
]

export const INITIAL_CONVERSATIONS = [
  { id:'c1', patientId:'p1', context:'Appointment a1', assignedTo:'Alyssa Cruz', assignedRole:'Receptionist', status:'Open', unreadBy:['staff'], messages:[
    { id:'cm1', sender:'patient', text:'Can I move my appointment if needed?', at:'2026-09-19 07:55' },
    { id:'cm2', sender:'staff', text:'Yes. We can validate another available slot before confirming the change.', at:'2026-09-19 08:06' },
  ]},
  { id:'c2', patientId:'p2', context:'Clinical clarification', assignedTo:'Dr. Miguel Reyes', assignedRole:'Dentist', status:'Open', unreadBy:['dentist'], messages:[
    { id:'cm3', sender:'patient', text:'The tooth is still sensitive to cold. Is that expected?', at:'2026-09-18 19:20' },
  ]},
]

export const INITIAL_NOTIFICATIONS = [
  { id:'n1', patientId:'p1', type:'Appointment Confirmation', channel:'SMS', text:'Your appointment on Sep 19 at 10:00 AM is confirmed.', status:'Delivered', createdAt:'2026-09-18 09:01', read:true },
  { id:'n2', patientId:'p1', type:'Queue Update', channel:'Portal', text:'You are checked in and currently #1 in Dr. Miguel Reyes’ queue.', status:'Delivered', createdAt:'2026-09-19 09:46', read:false },
  { id:'n3', patientId:'p2', type:'HMO Alert', channel:'SMS', text:'Additional HMO documents are required before submission.', status:'Delivered', createdAt:'2026-09-18 15:40', read:false },
  { id:'n4', patientId:'p4', type:'Follow-Up Reminder', channel:'SMS', text:'Reminder: your post-extraction review is scheduled for Sep 20.', status:'Failed', createdAt:'2026-09-19 08:30', read:false },
]

export const INITIAL_PRESCRIPTIONS = [
  { id:'rx1', patientId:'p4', treatmentId:'t1', dentistId:'d4', medication:'Ibuprofen 400 mg', dosage:'1 tablet', instructions:'Take after meals every 8 hours as needed for pain for up to 3 days.', authorizedAt:'2026-09-13 15:12', status:'Authorized', version:1 },
]

export const INITIAL_FOLLOWUPS = [
  { id:'f1', patientId:'p4', treatmentId:'t1', dentistId:'d4', reason:'Post-extraction review', recommendedDate:'2026-09-20', interval:'7 days', status:'Scheduled', appointmentId:'a4', taskCreatedAt:'2026-09-13 15:11' },
  { id:'f2', patientId:'p1', treatmentId:'t2', dentistId:'d1', reason:'Routine recall', recommendedDate:'2027-03-12', interval:'6 months', status:'Open', appointmentId:null, taskCreatedAt:'2026-09-12 10:43' },
]

export const INITIAL_USERS = [
  { id:'u1', name:'Dr. Dana Roxas', login:'dana.roxas', role:'Owner / Admin', branch:'All Branches', status:'Active', permissions:['all'], lastLogin:'2026-09-19 07:40' },
  { id:'u2', name:'Alyssa Cruz', login:'alyssa.cruz', role:'Receptionist', branch:'Branch A', status:'Active', permissions:['appointments','checkin','queue','patient-demographics','billing','hmo','messages','followups'], lastLogin:'2026-09-19 08:00' },
  { id:'u3', name:'Dr. Miguel Reyes', login:'miguel.reyes', role:'Dentist', branch:'Branch A', status:'Active', permissions:['schedule','queue','clinical-records','treatment','prescriptions','followups','messages'], lastLogin:'2026-09-19 08:02' },
  { id:'u4', name:'Marco Villanueva', login:'marco.v', role:'HMO Coordinator', branch:'Branch B', status:'Active', permissions:['hmo','patient-demographics','messages'], lastLogin:'2026-09-19 07:58' },
  { id:'u5', name:'Lea Mendoza', login:'lea.mendoza', role:'Cashier', branch:'Branch C', status:'Active', permissions:['billing','patient-demographics'], lastLogin:'2026-09-18 17:55' },
]

export const INITIAL_AUTOMATIONS = [
  { id:'r1', event:'Appointment created / moved / cancelled', condition:'Valid appointment lifecycle change', action:'Reserve or release slot; update calendar; notify patient', owner:'Scheduling', enabled:true, lastResult:'Success' },
  { id:'r2', event:'HMO pending timer updated', condition:'Pending > 12 hours', action:'Create follow-up task and notify HMO coordinator', owner:'HMO', enabled:true, lastResult:'Success' },
  { id:'r3', event:'Queue or capacity updated', condition:'Estimated wait > 35 min OR branch load > threshold', action:'Alert front desk/owner and show cross-branch capacity', owner:'Patient Flow', enabled:true, lastResult:'Success' },
  { id:'r4', event:'Treatment completed', condition:'Dentist marks prescription/follow-up required', action:'Create prescription/follow-up task', owner:'Clinical', enabled:true, lastResult:'Success' },
  { id:'r5', event:'New patient message', condition:'Patient or inquiry matched', action:'Route to responsible staff queue', owner:'Communication', enabled:true, lastResult:'Success' },
]

export const INITIAL_WORKFLOW_LOG = [
  { id:'log1', at:'2026-09-19 09:46', module:'M8→M9', event:'Patient checked in', result:'Queue entry q1 created', status:'Success' },
  { id:'log2', at:'2026-09-19 08:10', module:'M14', event:'HMO threshold reached', result:'Follow-up task generated for h1', status:'Success' },
  { id:'log3', at:'2026-09-18 16:41', module:'M16', event:'Inquiry responded', result:'Response history updated', status:'Success' },
  { id:'log4', at:'2026-09-18 14:12', module:'M23', event:'Notification trigger', result:'SMS provider unavailable; responsible staff alerted for retry', status:'Failed' },
]

export const INITIAL_CAMPAIGNS = [
  { id:'camp1', name:'6-Month Recall Pilot', type:'Reactivation', audience:'Patients overdue for routine recall', channel:'SMS', scheduled:'2026-09-25 09:00', status:'Draft', responses:0, reactivated:0 },
  { id:'camp2', name:'Post-Visit Feedback Pilot', type:'Feedback', audience:'Completed visits this week', channel:'Portal', scheduled:'2026-09-20 18:00', status:'Scheduled', responses:4, reactivated:0 },
]

export const INITIAL_LOYALTY = [
  { id:'loy1', patientId:'p1', referralCode:'DANA-MARIA-01', points:120, history:[
    { at:'2026-09-12', type:'Qualified Visit', detail:'Oral prophylaxis', points:20 },
    { at:'2026-08-01', type:'Referral Reward', detail:'Qualified referral', points:100 },
  ]},
]

export const INITIAL_AUDIT = [
  { id:'aud1', at:'2026-09-19 08:06', actor:'Alyssa Cruz', action:'Replied to patient conversation c1', module:'M17' },
  { id:'aud2', at:'2026-09-19 08:10', actor:'System', action:'Generated HMO follow-up for h1', module:'M14' },
  { id:'aud3', at:'2026-09-19 09:46', actor:'Alyssa Cruz', action:'Checked in Maria Santos', module:'M8' },
]
