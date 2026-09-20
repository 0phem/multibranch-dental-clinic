import { clinicDate } from './clock.js'

// Compatibility export for deferred modules; workflow code reads the live clinic clock.
export const TODAY = clinicDate()

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
  patient: { label: 'Patient', name: 'Maria Santos', subtitle: 'Patient Portal', patientId: 'p1', userId: 'u12' },
  staff: { label: 'Staff', name: 'Alyssa Cruz', subtitle: 'Receptionist / Patient Services', userId: 'u2', branchId: 'b1', branch: 'Branch A' },
  dentist: { label: 'Dentist', name: 'Dr. Miguel Reyes', subtitle: 'Clinical Services', userId: 'u3', dentistId: 'd1', branchId: 'b1', branch: 'Branch A' },
  owner: { label: 'Owner / Admin', name: 'Dr. Dana Roxas', subtitle: 'Clinic Owner / Administrator', userId: 'u1', branch: 'All Branches' },
}

export const NAV = {
  patient: [
    ['dashboard','Home'], ['book','Book Appointment'], ['appointments','Appointments'], ['queue','Live Queue'],
    ['hmo','HMO Coverage'], ['messages','Messages'], ['billing','Receipts & Payments'], ['prescriptions','Prescriptions'], ['followups','Follow-Up Care'], ['loyalty','Rewards • PE']
  ],
  staff: [
    ['dashboard','Operations'], ['appointments','Appointments'], ['checkin','Check-In'], ['queue','Live Queue'], ['capacity','Capacity'],
    ['patients','Patient Records'], ['billing','Billing & Payments'], ['hmo','HMO Cases'], ['inquiries','Social Inquiries'], ['messages','Messages'], ['followups','Follow-Up Tasks'], ['engagement','Engagement • PE']
  ],
  dentist: [
    ['dashboard','Clinical Home'], ['schedule','My Schedule'], ['queue','My Queue'], ['patients','Patient Records'], ['treatment','Treatment'],
    ['prescriptions','Prescriptions'], ['followups','Follow-Up Care'], ['messages','Messages']
  ],
  owner: [
    ['dashboard','Executive Dashboard'], ['analytics','Analytics & Reports'], ['branches','Branches'], ['team','People & Team'], ['capacity','Capacity & Workload'],
    ['hmo','HMO Overview'], ['users','Access & Roles'], ['automation','Automation Monitor'], ['engagement','Engagement • PE']
  ],
}

export const INITIAL_PERSONS = [
  { id:'per-owner', firstName:'Dana', middleName:'', lastName:'Roxas', email:'dana.roxas@dentalops.demo', phone:'0917 000 0001', dob:'1982-01-12', sex:'Female', address:'Bulacan' },
  { id:'per-s1', firstName:'Alyssa', middleName:'', lastName:'Cruz', email:'alyssa.cruz@dentalops.demo', phone:'0917 000 0002', dob:'1997-04-21', sex:'Female', address:'Bulacan' },
  { id:'per-d1', firstName:'Miguel', middleName:'', lastName:'Reyes', email:'miguel.reyes@dentalops.demo', phone:'0917 000 0101', dob:'1988-02-14', sex:'Male', address:'Bulacan' },
  { id:'per-s2', firstName:'Marco', middleName:'', lastName:'Villanueva', email:'marco.v@dentalops.demo', phone:'0917 000 0004', dob:'1994-06-18', sex:'Male', address:'Bulacan' },
  { id:'per-s4', firstName:'Lea', middleName:'', lastName:'Mendoza', email:'lea.mendoza@dentalops.demo', phone:'0917 000 0005', dob:'1995-03-08', sex:'Female', address:'Bulacan' },
  { id:'per-d2', firstName:'Patricia', middleName:'', lastName:'Lim', email:'patricia.lim@dentalops.demo', phone:'0917 000 0102', dob:'1989-09-20', sex:'Female', address:'Bulacan' },
  { id:'per-d3', firstName:'Carlo', middleName:'', lastName:'Mendoza', email:'carlo.mendoza@dentalops.demo', phone:'0917 000 0103', dob:'1986-12-03', sex:'Male', address:'Bulacan' },
  { id:'per-d4', firstName:'Andrea', middleName:'', lastName:'Flores', email:'andrea.flores@dentalops.demo', phone:'0917 000 0104', dob:'1990-07-17', sex:'Female', address:'Bulacan' },
  { id:'per-d5', firstName:'Luis', middleName:'', lastName:'Navarro', email:'luis.navarro@dentalops.demo', phone:'0917 000 0105', dob:'1987-05-09', sex:'Male', address:'Bulacan' },
  { id:'per-s3', firstName:'Nina', middleName:'', lastName:'Torres', email:'nina.torres@dentalops.demo', phone:'0917 000 0010', dob:'1998-08-11', sex:'Female', address:'Bulacan' },
  { id:'per-s5', firstName:'Mika', middleName:'', lastName:'Ramos', email:'mika.ramos@dentalops.demo', phone:'0917 000 0011', dob:'1996-10-25', sex:'Female', address:'Bulacan' },
  { id:'per-p1', firstName:'Maria', middleName:'', lastName:'Santos', email:'maria@example.com', phone:'0917 123 4567', dob:'1998-05-17', sex:'Female', address:'Meycauayan, Bulacan' },
  { id:'per-p2', firstName:'John', middleName:'', lastName:'Dela Cruz', email:'john@example.com', phone:'0918 221 9001', dob:'1994-11-02', sex:'Male', address:'Quezon City' },
  { id:'per-p3', firstName:'Bianca', middleName:'', lastName:'Ramos', email:'bianca@example.com', phone:'0920 883 2104', dob:'2001-03-20', sex:'Female', address:'Manila' },
  { id:'per-p4', firstName:'Paolo', middleName:'', lastName:'Garcia', email:'paolo@example.com', phone:'0916 444 0310', dob:'1988-08-09', sex:'Male', address:'Pasay City' },
]

export const INITIAL_SERVICES = [
  { id:'svc1', code:'CONSULT', name:'Dental Consultation', duration:30, baseFee:600, category:'General Dentistry', status:'Active' },
  { id:'svc2', code:'PROPHY', name:'Oral Prophylaxis', duration:45, baseFee:1200, category:'General Dentistry', status:'Active' },
  { id:'svc3', code:'RESTORE', name:'Composite Restoration', duration:60, baseFee:2500, category:'General Dentistry', status:'Active' },
  { id:'svc4', code:'EXTRACT', name:'Tooth Extraction', duration:60, baseFee:4500, category:'Oral Surgery', status:'Active' },
  { id:'svc5', code:'RCT', name:'Root Canal Treatment', duration:90, baseFee:8000, category:'General Dentistry', status:'Active' },
  { id:'svc6', code:'ORTHO-ADJ', name:'Orthodontic Adjustment', duration:45, baseFee:1500, category:'Orthodontics', status:'Active' },
  { id:'svc7', code:'PEDIA-CONSULT', name:'Pediatric Consultation', duration:30, baseFee:800, category:'Pediatric Dentistry', status:'Active' },
  { id:'svc8', code:'WHITEN', name:'Teeth Whitening', duration:75, baseFee:6500, category:'Teeth Whitening', status:'Active' },
  { id:'svc9', code:'IMPLANT-CONSULT', name:'Dental Implant Consultation', duration:45, baseFee:1000, category:'Dental Implant', status:'Active' },
  { id:'svc10', code:'TMD-CONSULT', name:'TMD / Orofacial Pain Consultation', duration:45, baseFee:1200, category:'TMD / Orofacial Pain', status:'Active' },
  { id:'svc11', code:'FOLLOWUP', name:'Follow-Up', duration:30, baseFee:600, category:'General Dentistry', status:'Active' },
]

// Compatibility alias for older UI imports; the canonical frontend source is state.services.
export const SERVICES = INITIAL_SERVICES

export const INITIAL_BRANCH_SERVICES = [
  ...['svc1','svc2','svc3','svc4','svc5','svc6','svc11'].map(serviceId=>({ id:`bs-b1-${serviceId}`, branchId:'b1', serviceId, active:true })),
  ...['svc1','svc2','svc3','svc5','svc7','svc8','svc11'].map(serviceId=>({ id:`bs-b2-${serviceId}`, branchId:'b2', serviceId, active:true })),
  ...['svc1','svc2','svc3','svc5','svc9','svc10','svc11'].map(serviceId=>({ id:`bs-b3-${serviceId}`, branchId:'b3', serviceId, active:true })),
]

export const INITIAL_DENTIST_SERVICE_ASSIGNMENTS = [
  ...['svc1','svc2','svc3','svc4','svc5','svc11'].map(serviceId=>({ dentistId:'d1', serviceId })),
  ...['svc1','svc6','svc11'].map(serviceId=>({ dentistId:'d2', serviceId })),
  ...['svc1','svc7','svc11'].map(serviceId=>({ dentistId:'d3', serviceId })),
  ...['svc1','svc4','svc9','svc11'].map(serviceId=>({ dentistId:'d4', serviceId })),
  ...['svc1','svc2','svc3','svc5','svc11'].map(serviceId=>({ dentistId:'d5', serviceId })),
]

export const INITIAL_BRANCHES = [
  { id:'b1', branchCode:'BRC-A', name:'Branch A', city:'Bocaue', address:'Main clinic • Bocaue, Bulacan', open:'09:00', close:'18:00', status:'Open', threshold:80, services:['General Dentistry','Orthodontics','Oral Surgery'], phone:'(02) 8123 1001' },
  { id:'b2', branchCode:'BRC-B', name:'Branch B', city:'Bocaue', address:'North clinic • Bocaue, Bulacan', open:'09:00', close:'18:00', status:'Open', threshold:80, services:['General Dentistry','Pediatric Dentistry','Teeth Whitening'], phone:'(02) 8123 1002' },
  { id:'b3', branchCode:'BRC-C', name:'Branch C', city:'Guiguinto', address:'South clinic • Guiguinto, Bulacan', open:'10:00', close:'19:00', status:'Open', threshold:75, services:['General Dentistry','TMD / Orofacial Pain','Dental Implant'], phone:'(02) 8123 1003' },
]

export const INITIAL_DENTISTS = [
  { id:'d1', userId:'u3', personId:'per-d1', staffType:'Dentist', licenseNo:'PRC-D-1001', branches:['Branch A'], specialty:'General Dentistry', shiftStart:'09:00', shiftEnd:'18:00', available:true, assistantStaffId:'s3' },
  { id:'d2', userId:'u6', personId:'per-d2', staffType:'Dentist', licenseNo:'PRC-D-1002', branches:['Branch A'], specialty:'Orthodontics', shiftStart:'10:00', shiftEnd:'19:00', available:true, assistantStaffId:null },
  { id:'d3', userId:'u7', personId:'per-d3', staffType:'Dentist', licenseNo:'PRC-D-1003', branches:['Branch B'], specialty:'Pediatric Dentistry', shiftStart:'09:00', shiftEnd:'18:00', available:true, assistantStaffId:null },
  { id:'d4', userId:'u8', personId:'per-d4', staffType:'Dentist', licenseNo:'PRC-D-1004', branches:['Branch C'], specialty:'Dental Implant', shiftStart:'10:00', shiftEnd:'19:00', available:true, assistantStaffId:null },
  { id:'d5', userId:'u9', personId:'per-d5', staffType:'Dentist', licenseNo:'PRC-D-1005', branches:['Branch B','Branch C'], specialty:'General Dentistry', shiftStart:'11:00', shiftEnd:'19:00', available:true, assistantStaffId:null },
]

export const INITIAL_STAFF = [
  { id:'s1', userId:'u2', personId:'per-s1', staffType:'Receptionist', licenseNo:'—', specialization:'Patient Services', role:'Receptionist', branch:'Branch A', shiftStart:'09:00', shiftEnd:'18:00', available:true },
  { id:'s2', userId:'u4', personId:'per-s2', staffType:'HMO Coordinator', licenseNo:'—', specialization:'HMO Processing', role:'HMO Coordinator', branch:'Branch B', shiftStart:'09:00', shiftEnd:'18:00', available:true },
  { id:'s3', userId:'u10', personId:'per-s3', staffType:'Dental Assistant', licenseNo:'—', specialization:'Chairside Assistance', role:'Dental Assistant', branch:'Branch A', shiftStart:'09:00', shiftEnd:'18:00', available:true },
  { id:'s4', userId:'u5', personId:'per-s4', staffType:'Cashier', licenseNo:'—', specialization:'Billing', role:'Cashier', branch:'Branch C', shiftStart:'10:00', shiftEnd:'19:00', available:true },
  { id:'s5', userId:'u11', personId:'per-s5', staffType:'Patient Engagement Staff', licenseNo:'—', specialization:'Patient Engagement', role:'Patient Engagement Staff', branch:'All Branches', shiftStart:'09:00', shiftEnd:'18:00', available:true },
]

export const INITIAL_PATIENTS = [
  { id:'p1', personId:'per-p1', userId:'u12', patientCode:'PAT-0001', preferredBranch:'Branch A', hmo:'MediCare Plus', hmoMember:'MC-10082', allergies:'None', medicalHistory:'No significant medical history.', dentalHistory:'Routine prophylaxis; mild gingivitis noted previously.', emergencyContact:'Ana Santos • 0917 555 0909', consent:true },
  { id:'p2', personId:'per-p2', userId:null, patientCode:'PAT-0002', preferredBranch:'Branch B', hmo:'HealthFirst', hmoMember:'HF-22015', allergies:'Penicillin', medicalHistory:'Controlled hypertension.', dentalHistory:'Composite restoration on #26.', emergencyContact:'Joy Dela Cruz • 0918 111 2222', consent:true },
  { id:'p3', personId:'per-p3', userId:null, patientCode:'PAT-0003', preferredBranch:'Branch A', hmo:'None', hmoMember:'—', allergies:'None', medicalHistory:'None declared.', dentalHistory:'Active orthodontic treatment.', emergencyContact:'Lara Ramos • 0920 811 1919', consent:true },
  { id:'p4', personId:'per-p4', userId:null, patientCode:'PAT-0004', preferredBranch:'Branch C', hmo:'MediCare Plus', hmoMember:'MC-88912', allergies:'Latex', medicalHistory:'Asthma, controlled.', dentalHistory:'Extraction of #48; follow-up required.', emergencyContact:'Mina Garcia • 0916 220 1000', consent:true },
]

export const INITIAL_APPOINTMENTS = [
  { id:'a1', appointmentNo:'APT-2026-0001', patientId:'p1', branchId:'b1', branch:'Branch A', dentistId:'d1', serviceId:'svc2', date:'2026-09-19', start:'10:00', scheduledStart:'2026-09-19T10:00', duration:45, status:'Checked In', source:'Portal', notes:'Routine cleaning' },
  { id:'a2', appointmentNo:'APT-2026-0002', patientId:'p2', branchId:'b2', branch:'Branch B', dentistId:'d3', serviceId:'svc1', date:'2026-09-19', start:'11:00', scheduledStart:'2026-09-19T11:00', duration:30, status:'Checked In', source:'Front Desk', notes:'Tooth sensitivity' },
  { id:'a3', appointmentNo:'APT-2026-0003', patientId:'p3', branchId:'b1', branch:'Branch A', dentistId:'d2', serviceId:'svc6', date:'2026-09-19', start:'13:30', scheduledStart:'2026-09-19T13:30', duration:45, status:'Checked In', source:'Front Desk', notes:'Monthly adjustment' },
  { id:'a4', appointmentNo:'APT-2026-0004', patientId:'p4', branchId:'b3', branch:'Branch C', dentistId:'d4', serviceId:'svc11', date:'2026-09-20', start:'10:30', scheduledStart:'2026-09-20T10:30', duration:30, status:'Confirmed', source:'Follow-Up Task', notes:'Post-extraction review' },
  { id:'a5', appointmentNo:'APT-2026-0005', patientId:'p2', branchId:'b2', branch:'Branch B', dentistId:'d5', serviceId:'svc3', date:'2026-09-19', start:'14:00', scheduledStart:'2026-09-19T14:00', duration:60, status:'Pending', source:'Front Desk', notes:'Pending patient confirmation' },
]

export const INITIAL_QUEUE = [
  { id:'q1', queueId:'dq1', clinicDate:'2026-09-19', checkInId:'ci1', queueNumber:1, appointmentId:'a1', patientId:'p1', branch:'Branch A', dentistId:'d1', checkedIn:'09:46', status:'Waiting', currentState:'Waiting', priority:'Normal', position:1, calledAt:null, readyAt:null, completedAt:null, skipCount:0 },
  { id:'q2', queueId:'dq2', clinicDate:'2026-09-19', checkInId:'ci2', queueNumber:1, appointmentId:'a3', patientId:'p3', branch:'Branch A', dentistId:'d2', checkedIn:'09:51', status:'Waiting', currentState:'Waiting', priority:'Normal', position:1, calledAt:null, readyAt:null, completedAt:null, skipCount:0 },
  { id:'q3', queueId:'dq3', clinicDate:'2026-09-19', checkInId:'ci3', queueNumber:1, appointmentId:'a2', patientId:'p2', branch:'Branch B', dentistId:'d3', checkedIn:'10:02', status:'Waiting', currentState:'Waiting', priority:'Priority', position:1, calledAt:null, readyAt:null, completedAt:null, skipCount:0 },
]

export const INITIAL_TREATMENTS = [
  { id:'t1', patientId:'p4', appointmentId:'old-a4', serviceId:'svc4', dentistId:'d4', assistant:'Ken Bautista', date:'2026-09-13', complaint:'Pain from impacted wisdom tooth', plan:'Extraction and post-op review', procedure:'Surgical extraction #48', status:'Completed', notes:'Procedure tolerated well. Hemostasis achieved.', startedAt:'14:05', completedAt:'15:10', followupRequired:true, prescriptionRequired:true },
  { id:'t2', patientId:'p1', appointmentId:'old-a1', serviceId:'svc2', dentistId:'d1', assistant:'Nina Torres', date:'2026-09-12', complaint:'Routine cleaning', plan:'Oral prophylaxis', procedure:'Oral prophylaxis', status:'Completed', notes:'Mild gingivitis. Oral hygiene instructions given.', startedAt:'10:03', completedAt:'10:42', followupRequired:true, prescriptionRequired:false },
]

export const INITIAL_INVOICES = [
  { id:'inv1', invoiceNo:'INV-2026-0001', treatmentId:'t2', patientId:'p1', branchId:'b1', visitDate:'2026-09-12', branch:'Branch A', items:[{serviceId:'svc1',name:'Dental Consultation',amount:600},{serviceId:'svc2',name:'Oral Prophylaxis',amount:1200}], total:1800, netAmount:1800, status:'Paid', paymentStatus:'Paid', method:'GCash', paidAt:'2026-09-12 10:50', receipt:'OR-2026-0912-001' },
  { id:'inv2', invoiceNo:'INV-2026-0002', treatmentId:null, patientId:'p2', branchId:'b2', visitDate:'2026-09-15', branch:'Branch B', items:[{serviceId:'svc3',name:'Composite Restoration',amount:2500}], total:2500, netAmount:2500, status:'Pending', paymentStatus:'Pending', method:'—', paidAt:null, receipt:null },
  { id:'inv3', invoiceNo:'INV-2026-0003', treatmentId:'t1', patientId:'p4', branchId:'b3', visitDate:'2026-09-13', branch:'Branch C', items:[{serviceId:'svc4',name:'Tooth Extraction',amount:4500}], total:4500, netAmount:4500, status:'Paid', paymentStatus:'Paid', method:'Card', paidAt:'2026-09-13 15:22', receipt:'OR-2026-0913-008' },
]

export const INITIAL_HMO = [
  { id:'h1', branchId:'b1', providerId:'hmo-medicare', patientId:'p1', provider:'MediCare Plus', memberId:'MC-10082', treatment:'Oral Prophylaxis', branch:'Branch A', eligibility:'Verified', documents:['ID','HMO Card','Treatment Request'], missing:[], status:'Pending', submittedAt:'2026-09-18 10:15', pendingHours:22, reference:'HMO-2026-0918-01', followUpCount:1, lastContact:'2026-09-19 08:10', providerOutcome:null },
  { id:'h2', branchId:'b2', providerId:'hmo-healthfirst', patientId:'p2', provider:'HealthFirst', memberId:'HF-22015', treatment:'Composite Restoration', branch:'Branch B', eligibility:'Verified', documents:['HMO Card'], missing:['Valid ID','Dentist treatment request'], status:'Missing Requirements', submittedAt:null, pendingHours:0, reference:null, followUpCount:0, lastContact:null, providerOutcome:null },
  { id:'h3', branchId:'b3', providerId:'hmo-medicare', patientId:'p4', provider:'MediCare Plus', memberId:'MC-88912', treatment:'Follow-Up', branch:'Branch C', eligibility:'Verified', documents:['ID','HMO Card','Treatment Request'], missing:[], status:'Approved', submittedAt:'2026-09-17 14:30', pendingHours:0, reference:'HMO-2026-0917-04', followUpCount:0, lastContact:'2026-09-18 09:00', providerOutcome:'Approved' },
]

export const INITIAL_INQUIRIES = [
  { id:'inq1', source:'Facebook', name:'Prospective Patient', contact:'Messenger', topic:'Braces price and schedule', status:'Open', assigned:'Alyssa Cruz', receivedAt:'2026-09-19 08:01', respondedAt:null, bookedAppointmentId:null },
  { id:'inq2', source:'Instagram', name:'Nicole Reyes', contact:'@nicole.reyes', topic:'Teeth whitening availability', status:'Responded', assigned:'Mika Ramos', receivedAt:'2026-09-18 16:30', respondedAt:'2026-09-18 16:41', bookedAppointmentId:null },
]

export const INITIAL_CONVERSATIONS = [
  { id:'c1', patientId:'p1', branchId:'b1', assignedUserId:'u2', participantUserIds:['u12','u2'], unreadUserIds:['u2'], context:'Appointment a1', assignedTo:'Alyssa Cruz', assignedRole:'Receptionist', status:'Open', unreadBy:['staff'], messages:[
    { id:'cm1', sender:'patient', text:'Can I move my appointment if needed?', at:'2026-09-19 07:55' },
    { id:'cm2', sender:'staff', text:'Yes. We can validate another available slot before confirming the change.', at:'2026-09-19 08:06' },
  ]},
  { id:'c2', patientId:'p2', branchId:'b1', assignedUserId:'u3', participantUserIds:['u3'], unreadUserIds:['u3'], context:'Clinical clarification', assignedTo:'Dr. Miguel Reyes', assignedRole:'Dentist', status:'Open', unreadBy:['dentist'], messages:[
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
  { id:'u1', personId:'per-owner', username:'dana.roxas', login:'dana.roxas', roleName:'Owner / Admin', role:'Owner / Admin', branchId:null, branch:'All Branches', accountStatus:'Active', status:'Active', permissions:['all'], lastLogin:'2026-09-19 07:40' },
  { id:'u2', personId:'per-s1', username:'alyssa.cruz', login:'alyssa.cruz', roleName:'Receptionist', role:'Receptionist', branchId:'b1', branch:'Branch A', accountStatus:'Active', status:'Active', permissions:['appointments','checkin','queue','patient-demographics','billing','hmo','messages','followups'], lastLogin:'2026-09-19 08:00' },
  { id:'u3', personId:'per-d1', username:'miguel.reyes', login:'miguel.reyes', roleName:'Dentist', role:'Dentist', branchId:'b1', branch:'Branch A', accountStatus:'Active', status:'Active', permissions:['schedule','queue','clinical-records','treatment','prescriptions','followups','messages'], lastLogin:'2026-09-19 08:02' },
  { id:'u4', personId:'per-s2', username:'marco.v', login:'marco.v', roleName:'HMO Coordinator', role:'HMO Coordinator', branchId:'b2', branch:'Branch B', accountStatus:'Active', status:'Active', permissions:['hmo','patient-demographics','messages'], lastLogin:'2026-09-19 07:58' },
  { id:'u5', personId:'per-s4', username:'lea.mendoza', login:'lea.mendoza', roleName:'Cashier', role:'Cashier', branchId:'b3', branch:'Branch C', accountStatus:'Active', status:'Active', permissions:['billing','patient-demographics'], lastLogin:'2026-09-18 17:55' },
  { id:'u6', personId:'per-d2', username:'patricia.lim', login:'patricia.lim', roleName:'Dentist', role:'Dentist', branchId:'b1', branch:'Branch A', accountStatus:'Active', status:'Active', permissions:['schedule','queue','clinical-records','treatment','prescriptions','followups','messages'], lastLogin:'2026-09-19 07:52' },
  { id:'u7', personId:'per-d3', username:'carlo.mendoza', login:'carlo.mendoza', roleName:'Dentist', role:'Dentist', branchId:'b2', branch:'Branch B', accountStatus:'Active', status:'Active', permissions:['schedule','queue','clinical-records','treatment','prescriptions','followups','messages'], lastLogin:'2026-09-19 07:49' },
  { id:'u8', personId:'per-d4', username:'andrea.flores', login:'andrea.flores', roleName:'Dentist', role:'Dentist', branchId:'b3', branch:'Branch C', accountStatus:'Active', status:'Active', permissions:['schedule','queue','clinical-records','treatment','prescriptions','followups','messages'], lastLogin:'2026-09-19 07:45' },
  { id:'u9', personId:'per-d5', username:'luis.navarro', login:'luis.navarro', roleName:'Dentist', role:'Dentist', branchId:'b2', branch:'Branch B', accountStatus:'Active', status:'Active', permissions:['schedule','queue','clinical-records','treatment','prescriptions','followups','messages'], lastLogin:'2026-09-19 07:42' },
  { id:'u10', personId:'per-s3', username:'nina.torres', login:'nina.torres', roleName:'Dental Assistant', role:'Dental Assistant', branchId:'b1', branch:'Branch A', accountStatus:'Active', status:'Active', permissions:['queue','clinical-records'], lastLogin:'2026-09-19 07:54' },
  { id:'u11', personId:'per-s5', username:'mika.ramos', login:'mika.ramos', roleName:'Patient Engagement Staff', role:'Patient Engagement Staff', branchId:null, branch:'All Branches', accountStatus:'Active', status:'Active', permissions:['inquiries','messages','engagement'], lastLogin:'2026-09-19 08:04' },
  { id:'u12', personId:'per-p1', username:'maria.santos', login:'maria.santos', roleName:'Patient', role:'Patient', branchId:null, branch:'All Branches', accountStatus:'Active', status:'Active', permissions:['patient-portal'], lastLogin:'2026-09-19 08:11' },
]

export const INITIAL_AUTOMATIONS = [
  { id:'r1', event:'Appointment created / moved / cancelled', triggerEvent:'appointment.lifecycle.changed', targetModule:'M6 / M7 / M18', condition:'Valid appointment lifecycle change', action:'Reserve or release slot; update calendar; notify patient', owner:'Scheduling', enabled:true, isActive:true, lastResult:'Success' },
  { id:'r2', event:'HMO pending timer updated', triggerEvent:'hmo.pending.timer.updated', targetModule:'M14', condition:'Pending > 12 hours', action:'Create follow-up task and notify HMO coordinator', owner:'HMO', enabled:true, isActive:true, lastResult:'Success' },
  { id:'r3', event:'Queue or capacity updated', triggerEvent:'patientflow.capacity.updated', targetModule:'M10 / M15', condition:'Estimated wait > 35 min OR branch load > threshold', action:'Alert front desk/owner and show cross-branch capacity', owner:'Patient Flow', enabled:true, isActive:true, lastResult:'Success' },
  { id:'r4', event:'Treatment completed', triggerEvent:'clinical.treatment.completed', targetModule:'M11 / M19 / M20', condition:'Dentist marks prescription/follow-up required', action:'Create billing, prescription, or follow-up task as applicable', owner:'Clinical', enabled:true, isActive:true, lastResult:'Success' },
  { id:'r5', event:'New patient message', triggerEvent:'communication.message.received', targetModule:'M17', condition:'Patient or inquiry matched', action:'Route to responsible staff queue', owner:'Communication', enabled:true, isActive:true, lastResult:'Success' },
  { id:'r6', event:'User account created / role updated', triggerEvent:'access.user.changed', targetModule:'M3', condition:'Role is Dentist or clinic Staff', action:'Create or synchronize linked STAFF_PROFILES record', owner:'Administration', enabled:true, isActive:true, lastResult:'Success' },
]

export const INITIAL_WORKFLOW_LOG = [
  { id:'log0', at:'2026-09-19 10:16', module:'M1→M3', event:'User account created / role synchronized', result:'STAFF_PROFILES link confirmed for u10', status:'Success' },
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
