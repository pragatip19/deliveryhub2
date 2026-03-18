// templates.js — Default templates for new projects

// ============================================================
// APPLICATIONS
// ============================================================
export const APPLICATIONS = [
  'MES', 'Logbooks', 'CLEEN', 'DMS', 'AI Investigator', 'LMS', 'AI Agents'
];

// ============================================================
// SOW TEMPLATE (same for all applications)
// ============================================================
export const SOW_SECTIONS = [
  'Agreement',
  'Application',
  'Cloud Infrastructure',
  'Facilities',
  'Process Configuration - Go Live',
  'Process Configuration - Scale-up',
  'Integrations',
  'Additional Languages',
  'Professional Services',
  'Payment Milestones',
];

export const SOW_TEMPLATE = [
  // Agreement
  { section: 'Agreement', work_item: 'MSA', specification: '', notes: '' },
  { section: 'Agreement', work_item: 'NDA', specification: '', notes: '' },
  // Application
  { section: 'Application', work_item: 'Application', specification: '', notes: '' },
  { section: 'Application', work_item: 'Version', specification: '', notes: '' },
  { section: 'Application', work_item: 'Go Live Requirements', specification: '', notes: '' },
  // Cloud Infrastructure
  { section: 'Cloud Infrastructure', work_item: 'Cloud Management', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'Cloud Service', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'Data Region', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'Data Backup frequency', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'Daily Backup at', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'Storage Account (S3)', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'High Availability (HA)', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'Disaster Recovery', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'RPO (Minutes)', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'RTO (Minutes)', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'Firewall', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'APM on Grafana (+Alerts)', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'Sentry Monitoring (+Alerts)', specification: '', notes: '' },
  { section: 'Cloud Infrastructure', work_item: 'Synthetic Monitoring on New Relic (+Alerts)', specification: '', notes: '' },
  // Facilities
  { section: 'Facilities', work_item: '', specification: '', notes: '' },
  // Process Configuration - Go Live
  { section: 'Process Configuration - Go Live', work_item: 'Templates - BMRs/BPRs', specification: '', notes: '' },
  { section: 'Process Configuration - Go Live', work_item: 'Templates - Logbooks', specification: '', notes: '' },
  // Process Configuration - Scale-up
  { section: 'Process Configuration - Scale-up', work_item: 'Templates - BMRs/BPRs', specification: '', notes: 'Scale up Tracker' },
  { section: 'Process Configuration - Scale-up', work_item: 'Templates - Logbooks', specification: '', notes: '' },
  // Integrations
  { section: 'Integrations', work_item: 'SSO', specification: '', notes: '' },
  { section: 'Integrations', work_item: 'ERP', specification: '', notes: '' },
  { section: 'Integrations', work_item: 'LIMS', specification: '', notes: '' },
  { section: 'Integrations', work_item: 'QMS', specification: '', notes: '' },
  { section: 'Integrations', work_item: 'Equipment Integrations', specification: '', notes: '' },
  // Additional Languages
  { section: 'Additional Languages', work_item: '', specification: '', notes: '' },
  // Professional Services
  { section: 'Professional Services', work_item: 'Share CSV Package', specification: 'Included', notes: '' },
  { section: 'Professional Services', work_item: 'Conduct Trainings', specification: '', notes: '' },
  { section: 'Professional Services', work_item: 'Hypercare Support', specification: '', notes: '' },
  // Payment Milestones
  { section: 'Payment Milestones', work_item: 'Payment Milestones', specification: '', notes: 'Add payments in the Payments Sheet' },
];

// Dropdown options per work_item (admin can add more)
export const SOW_DROPDOWN_OPTIONS = {
  'MSA': ['Signed', 'Not Signed', 'Pending'],
  'NDA': ['Signed', 'Not Signed', 'Pending'],
  'Application': APPLICATIONS,
  'Cloud Management': ['Leucine Managed', 'Customer Managed'],
  'Cloud Service': ['Azure', 'AWS', 'GCP', 'On-Premise'],
  'High Availability (HA)': ['Required', 'Not Required'],
  'Disaster Recovery': ['Required', 'Not Required'],
  'APM on Grafana (+Alerts)': ['Required', 'Not Required'],
  'Sentry Monitoring (+Alerts)': ['Required', 'Not Required'],
  'Synthetic Monitoring on New Relic (+Alerts)': ['Required', 'Not Required'],
  'SSO': ['Go Live scope', 'Post Go Live scope', 'Not Required'],
  'ERP': ['Go Live scope', 'Post Go Live scope', 'Not Required'],
  'LIMS': ['Go Live scope', 'Post Go Live scope', 'Not Required'],
  'QMS': ['Go Live scope', 'Post Go Live scope', 'Not Required'],
  'Equipment Integrations': ['Go Live scope', 'Post Go Live scope', 'Not Required'],
  'Share CSV Package': ['Included', 'Not Included'],
  'Firewall': ['Azure', 'AWS', 'Custom', 'Not Required'],
};

// ============================================================
// PAYMENTS TEMPLATE (default 3-row template)
// ============================================================
export const PAYMENTS_TEMPLATE = [
  {
    line_item: 'Subscription - 50%',
    milestone_name: 'Purchase Order is Issued',
    type: 'Annual Subscription',
    amount: null,
    currency: 'USD',
    milestone_status: 'Not Started',
    planned_milestone_completion_date: null,
    invoice_id: '',
    payment_status: 'Not Paid',
    pending_milestone_amount: null,
  },
  {
    line_item: 'Implementation Fee - 50%',
    milestone_name: 'Purchase Order is Issued',
    type: 'One Time Services',
    amount: null,
    currency: 'USD',
    milestone_status: 'Not Started',
    planned_milestone_completion_date: null,
    invoice_id: '',
    payment_status: 'Not Paid',
    pending_milestone_amount: null,
  },
  {
    line_item: 'Implementation Fee - 50%',
    milestone_name: 'IQ PS is Signed by Leucine',
    type: 'One Time Services',
    amount: null,
    currency: 'USD',
    milestone_status: 'Not Started',
    planned_milestone_completion_date: null,
    invoice_id: '',
    payment_status: 'Project Pending',
    pending_milestone_amount: null,
  },
];

export const PAYMENT_STATUS_OPTIONS = ['Not Paid', 'Invoice Sent', 'Project Pending', 'Paid'];
export const PAYMENT_TYPE_OPTIONS = ['Annual Subscription', 'One Time Services'];
export const CURRENCY_OPTIONS = ['USD', 'INR', 'EUR', 'GBP'];

// ============================================================
// MES / LOGBOOKS / DMS / AI INVESTIGATOR / LMS / AI AGENTS TEMPLATE
// 98 tasks across 13 milestones
// Dates are stripped — recalculated from dependency chain at runtime
// ============================================================
export const MES_MILESTONES = [
  'Kick-off Project',
  'Share CSV Package',
  'Map As-Is Process',
  'Assess Go-Live Readiness Infra',
  'Finalize Configurations - Application',
  'Finalize Configurations - SSO/LDAP',
  'Finalize Configurations - ERP',
  'Finalize Configurations - E1',
  'Conduct UAT',
  'Train Users & Admins',
  'Go-Live on Production',
  'Hypercare',
  'Publish Go-Live Report',
];

export const MES_TASKS = [
  // Kick-off Project
  { milestone: 'Kick-off Project', activities: 'Finalize SOW with Delivery Manager', tools: 'Get ready for Kick-off', owner: 'Leucine Promise Owner', status: 'Not Started', duration: 1, dependency: '' },
  { milestone: 'Kick-off Project', activities: 'Discover Project Goals & Key Success Metrics', tools: 'Project Discovery', owner: 'Leucine Promise Owner', status: 'Not Started', duration: 1, dependency: 'Finalize SOW with Delivery Manager' },
  { milestone: 'Kick-off Project', activities: 'Add Payment Tasks to the delivery plan as per SOW Milestones', tools: 'Payment Tasks', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Finalize SOW with Delivery Manager' },
  { milestone: 'Kick-off Project', activities: 'Send Invoices', tools: '', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Add Payment Tasks to the delivery plan as per SOW Milestones' },
  { milestone: 'Kick-off Project', activities: 'Prepare Kick-off Deck & Delivery Plan', tools: 'Kick Off Deck Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Finalize SOW with Delivery Manager' },
  { milestone: 'Kick-off Project', activities: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)', tools: 'NA', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Prepare Kick-off Deck & Delivery Plan' },
  { milestone: 'Kick-off Project', activities: 'Finalize Delivery Plan (SOW, Project Plan, People)', tools: 'NA', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 5, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Finalize the list of BMRs, BPRs and Logbooks in Go Live Scope', tools: 'Go-live Scope Selection', owner: 'Client Production Leader', status: 'Not Started', duration: 5, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Upload Go-live scope documents', tools: 'Process Mapping', owner: 'Client Production SME', status: 'Not Started', duration: 1, dependency: 'Finalize the list of BMRs, BPRs and Logbooks in Go Live Scope' },
  { milestone: 'Kick-off Project', activities: 'Share Draft Change Control with Client', tools: 'Draft Change control', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Initiate and Approve Change Control', tools: 'Draft Change control', owner: 'Client Project Manager', status: 'Not Started', duration: 10, dependency: 'Share Draft Change Control with Client' },
  { milestone: 'Kick-off Project', activities: 'Receive Payment', tools: '', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Send Invoices' },
  { milestone: 'Kick-off Project', activities: 'Conduct Kick-off call', tools: 'Kick Off Deck Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 3, dependency: 'Receive Payment' },
  { milestone: 'Kick-off Project', activities: 'Set up meetings - Project Managers - Alternative day', tools: 'Reference Alternate Day Sync Calendar Invite', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Set up meetings - Monthly Steering Commitee with Executives', tools: 'Reference Monthly Steering Commitee Meeting Calendar Invite', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Create Sharepoint Site and share access with project team', tools: 'Sharepoint Site', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  // Share CSV Package
  { milestone: 'Share CSV Package', activities: 'Share Validation Plan', tools: 'Validation Plan', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Share CSV Package', activities: 'Acknowledge Validation Plan', tools: 'Same as above', owner: 'Client Quality Leader', status: 'Not Started', duration: 3, dependency: 'Share Validation Plan' },
  { milestone: 'Share CSV Package', activities: 'Share CSV Package', tools: 'CSV Walkthrough Email', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  // Map As-Is Process
  { milestone: 'Map As-Is Process', activities: 'Collect master data - Area, room, product data, equipment', tools: '', owner: 'Client Project Manager', status: 'Not Started', duration: 2, dependency: 'Conduct Kick-off call' },
  { milestone: 'Map As-Is Process', activities: 'Collect executed and master copies of BMR, BPR and logbooks', tools: '', owner: 'Client Project Manager', status: 'Not Started', duration: 2, dependency: 'Conduct Kick-off call' },
  { milestone: 'Map As-Is Process', activities: 'Conduct workshop - ERP', tools: '', owner: 'Leucine Integration Team', status: 'Not Started', duration: 1, dependency: 'Collect executed and master copies of BMR, BPR and logbooks' },
  { milestone: 'Map As-Is Process', activities: 'Conduct workshop - BMR Process and associated logbooks', tools: '', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Conduct workshop - ERP' },
  { milestone: 'Map As-Is Process', activities: 'Conduct workshop - BPR Process and associated logbooks', tools: '', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Conduct workshop - BMR Process and associated logbooks' },
  { milestone: 'Map As-Is Process', activities: 'Identify unavailable process templates in Leucine DWI Library', tools: 'Process Mapping', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 2, dependency: 'Upload Go-live scope documents' },
  { milestone: 'Map As-Is Process', activities: 'If required, request client for more information for unavailable process templates', tools: 'Same as above', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 3, dependency: 'Upload Go-live scope documents' },
  { milestone: 'Map As-Is Process', activities: 'Publish Simple Process Flow Chart', tools: 'Same as above', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 3, dependency: 'Upload Go-live scope documents' },
  // Assess Go-Live Readiness Infra
  { milestone: 'Assess Go-Live Readiness Infra', activities: 'Share Recommended Network & Hardware Specifications', tools: 'Hardware Specifications', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Assess Go-Live Readiness Infra', activities: 'Share Equipment Integration Readiness Checklist', tools: 'Equipment Integration Playbook', owner: '', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Assess Go-Live Readiness Infra', activities: 'Identify gaps in the current site infrastructure', tools: 'Same as above', owner: 'Client IT SME', status: 'Not Started', duration: 5, dependency: 'Share Recommended Network & Hardware Specifications' },
  { milestone: 'Assess Go-Live Readiness Infra', activities: 'Order additional materials (such as Tablets, Routers, etc.)', tools: 'NA', owner: 'Client IT SME', status: 'Not Started', duration: 15, dependency: 'Identify gaps in the current site infrastructure' },
  // Finalize Configurations - Application
  { milestone: 'Finalize Configurations - Application', activities: 'Finalize Application CS (Configuration Specifications)', tools: 'Configuration Specification Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Finalize Configurations - Application', activities: 'Setup & Test UAT Server', tools: 'Deploy Instance', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 5, dependency: 'Finalize Application CS (Configuration Specifications)' },
  { milestone: 'Finalize Configurations - Application', activities: 'Approve Configuration Specification', tools: 'Configuration Specification Template', owner: 'Client Project Manager', status: 'Not Started', duration: 5, dependency: 'Setup & Test UAT Server' },
  // Finalize Configurations - SSO/LDAP
  { milestone: 'Finalize Configurations - SSO/LDAP', activities: 'Draft & Share SSO Integration Specification', tools: 'SSO/LDAP Integration Playbook', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Finalize Application CS (Configuration Specifications)' },
  { milestone: 'Finalize Configurations - SSO/LDAP', activities: 'Setup & Test SSO Integration Service on UAT Server', tools: 'Same as above', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 10, dependency: 'Draft & Share SSO Integration Specification' },
  // Finalize Configurations - ERP
  { milestone: 'Finalize Configurations - ERP', activities: 'Inform Integration Specifications to the client', tools: 'ERP Integration Playbook', owner: 'Leucine Integration Team', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Finalize Integration Specifications', tools: 'Same as above', owner: 'Client IT Leader', status: 'Not Started', duration: 5, dependency: 'Inform Integration Specifications to the client' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Build or Share ERP Interface', tools: 'Same as above', owner: 'Client IT Leader', status: 'Not Started', duration: 5, dependency: 'Finalize Integration Specifications' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Test ERP Interface', tools: 'Same as above', owner: 'Leucine Integration Team', status: 'Not Started', duration: 2, dependency: 'Build or Share ERP Interface' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Map SAP properties to DWI properties', tools: 'Same as above', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 2, dependency: 'Build or Share ERP Interface' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Setup & Test ERP Integration Service on UAT Server (Ontology)', tools: 'Same as above', owner: 'Leucine Integration Team', status: 'Not Started', duration: 2, dependency: 'Map SAP properties to DWI properties' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Test data flow from ERP to Ontology', tools: 'Same as above', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 5, dependency: 'Setup & Test ERP Integration Service on UAT Server (Ontology)' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Migrate the service from Dev/Quality to production', tools: 'Same as above', owner: 'Client IT Leader', status: 'Not Started', duration: 2, dependency: 'Test data flow from Ontology to Process' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Test data flow from production ERP to Ontology', tools: 'Same as above', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Migrate the service from Dev/Quality to production' },
  // Finalize Configurations - E1
  { milestone: 'Finalize Configurations - E1', activities: 'Inform Integration Specifications to the client', tools: 'Equipment Integration Playbook', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Finalize Configurations - E1', activities: 'Submit filled Equipment Integration Readiness Checklist', tools: 'Same as above', owner: 'Client IT SME', status: 'Not Started', duration: 5, dependency: 'Share Equipment Integration Readiness Checklist' },
  { milestone: 'Finalize Configurations - E1', activities: 'Send an approach for Integration readiness', tools: 'Same as above', owner: 'Leucine Integration Team', status: 'Not Started', duration: 2, dependency: 'Submit filled Equipment Integration Readiness Checklist' },
  { milestone: 'Finalize Configurations - E1', activities: 'Enable Integration Readiness', tools: 'Same as above', owner: 'Client IT Leader', status: 'Not Started', duration: 15, dependency: 'Send an approach for Integration readiness' },
  { milestone: 'Finalize Configurations - E1', activities: 'Perform an Initial assessment of integration readiness', tools: 'Same as above', owner: 'Leucine Integration Team', status: 'Not Started', duration: 2, dependency: 'Enable Integration Readiness' },
  { milestone: 'Finalize Configurations - E1', activities: 'Setup & Test Equipment Integration Service on UAT Server (Ontology)', tools: 'Same as above', owner: 'Leucine Integration Team', status: 'Not Started', duration: 5, dependency: 'Perform an Initial assessment of integration readiness' },
  { milestone: 'Finalize Configurations - E1', activities: 'Test data flow from Ontology to Process', tools: 'Same as above', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 5, dependency: 'Setup & Test Equipment Integration Service on UAT Server (Ontology)' },
  // Conduct UAT
  { milestone: 'Conduct UAT', activities: 'Share list of UAT Approvers to be Onboarded', tools: 'Conduct UAT', owner: 'Client Production SME', status: 'Not Started', duration: 1, dependency: 'Setup & Test UAT Server' },
  { milestone: 'Conduct UAT', activities: 'Copy template from Leucine Library or Design Template', tools: 'Process Migration', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 20, dependency: 'Setup & Test UAT Server' },
  { milestone: 'Conduct UAT', activities: 'Perform a complete dry run of the BMR before UAT execution', tools: 'Conduct UAT', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 2, dependency: 'Copy template from Leucine Library or Design Template' },
  { milestone: 'Conduct UAT', activities: 'Conduct guided UAT Execution for 1 recently executed batch (without ERP)', tools: 'Conduct UAT', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 10, dependency: 'Copy template from Leucine Library or Design Template' },
  { milestone: 'Conduct UAT', activities: 'Conduct incremental UAT execution just for ERP data fields', tools: 'Same as above', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 5, dependency: 'Conduct guided UAT Execution for 1 recently executed batch (without ERP)' },
  { milestone: 'Conduct UAT', activities: 'Signoff UAT (Ontology and Process for Go Live processes)', tools: 'UAT Sign off Template', owner: 'UAT Coordinator', status: 'Not Started', duration: 5, dependency: 'Copy template from Leucine Library or Design Template' },
  // Train Users & Admins
  { milestone: 'Train Users & Admins', activities: 'Share Draft MES SOP', tools: 'Draft MES SOP Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Share list of UAT Approvers to be Onboarded' },
  { milestone: 'Train Users & Admins', activities: 'Share Knowledge Base (Training Videos)', tools: 'Training Session Content', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Signoff UAT (Ontology and Process for Go Live processes)' },
  { milestone: 'Train Users & Admins', activities: 'Approve MES SOP', tools: 'NA', owner: 'Client Project Manager', status: 'Not Started', duration: 5, dependency: 'Share Draft MES SOP' },
  { milestone: 'Train Users & Admins', activities: 'Train Users on the Operational SOP', tools: 'NA', owner: 'UAT Coordinator', status: 'Not Started', duration: 5, dependency: 'Approve MES SOP' },
  // Go-Live on Production
  { milestone: 'Go-Live on Production', activities: 'Share draft PQ Protocol', tools: 'PQ Execution Guide', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Signoff UAT (Ontology and Process for Go Live processes)' },
  { milestone: 'Go-Live on Production', activities: 'Preapprove PQ Protocol', tools: 'NA', owner: 'Client Production SME', status: 'Not Started', duration: 5, dependency: 'Share draft PQ Protocol' },
  { milestone: 'Go-Live on Production', activities: 'Setup Stage Server as per approved CS', tools: 'Deploy Instance', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Preapprove PQ Protocol' },
  { milestone: 'Go-Live on Production', activities: 'Setup & Test SSO Integration Service on Stage Server', tools: 'NA', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Setup Stage Server as per approved CS' },
  { milestone: 'Go-Live on Production', activities: 'Migrate the service from UAT to Stage- ERP', tools: 'NA', owner: 'Leucine Integration Team', status: 'Not Started', duration: 2, dependency: 'Setup & Test SSO Integration Service on Stage Server' },
  { milestone: 'Go-Live on Production', activities: 'Migrate the service from UAT to Stage- E1', tools: 'NA', owner: 'Leucine Integration Team', status: 'Not Started', duration: 5, dependency: 'Migrate the service from UAT to Stage- ERP' },
  { milestone: 'Go-Live on Production', activities: 'Perform Leucine Dry run of PQ on Stage server', tools: 'NA', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Migrate the service from UAT to Stage- E1' },
  { milestone: 'Go-Live on Production', activities: 'Setup Production Server as per approved CS', tools: 'Deploy Instance', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Perform Leucine Dry run of PQ on Stage server' },
  { milestone: 'Go-Live on Production', activities: 'Setup & Test SSO Integration Service on Production Server', tools: 'NA', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Setup Production Server as per approved CS' },
  { milestone: 'Go-Live on Production', activities: 'Migrate the service from UAT to Production- ERP', tools: 'NA', owner: 'Leucine Integration Team', status: 'Not Started', duration: 2, dependency: 'Setup & Test SSO Integration Service on Production Server' },
  { milestone: 'Go-Live on Production', activities: 'Migrate the service from UAT to Production- E1', tools: 'NA', owner: 'Leucine Integration Team', status: 'Not Started', duration: 5, dependency: 'Migrate the service from UAT to Production- ERP' },
  { milestone: 'Go-Live on Production', activities: 'Share IQ-PS and CPC for Production Server', tools: 'IQ-PS Template + CPC Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Migrate the service from UAT to Production- E1' },
  { milestone: 'Go-Live on Production', activities: 'Share executed Data Migration Report', tools: 'Data migration report', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Share IQ-PS and CPC for Production Server' },
  { milestone: 'Go-Live on Production', activities: 'Add Users and make user groups on Production server', tools: 'NA', owner: 'Client IT SME', status: 'Not Started', duration: 1, dependency: 'Share executed Data Migration Report' },
  { milestone: 'Go-Live on Production', activities: 'Execute PQ', tools: 'NA', owner: 'Client Production SME', status: 'Not Started', duration: 4, dependency: 'Add Users and make user groups on Production server' },
  { milestone: 'Go-Live on Production', activities: 'Approve PQ Report', tools: 'NA', owner: 'Client Production SME', status: 'Not Started', duration: 1, dependency: 'Execute PQ' },
  { milestone: 'Go-Live on Production', activities: 'Make MES SOP Effective', tools: 'NA', owner: 'Client Quality SME', status: 'Not Started', duration: 1, dependency: 'Approve PQ Report' },
  { milestone: 'Go-Live on Production', activities: 'Release System', tools: 'NA', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Approve PQ Report' },
  // Hypercare
  { milestone: 'Hypercare', activities: 'Setup Hypercare support calls', tools: 'Hypercare Playbook', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Release System' },
  { milestone: 'Hypercare', activities: 'Hypercare Closure & Transition to BAU Support', tools: 'Same as above', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Setup Hypercare support calls' },
  // Publish Go-Live Report
  { milestone: 'Publish Go-Live Report', activities: 'Schedule Go-Live Event (Inform Customer Events Team)', tools: 'Go-Live event guide', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Release System' },
  { milestone: 'Publish Go-Live Report', activities: 'Prepare Go-Live case study', tools: 'Go-Live case study template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Release System' },
  { milestone: 'Publish Go-Live Report', activities: 'Publish Go-Live case study', tools: 'Go-Live case study template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Prepare Go-Live case study' },
  { milestone: 'Publish Go-Live Report', activities: 'Publish Press Release', tools: 'Press-release Playbook', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Publish Go-Live case study' },
];

// ============================================================
// CLEEN TEMPLATE — 56 tasks across 10 milestones
// ============================================================
export const CLEEN_MILESTONES = [
  'Kick-off Project',
  'Map As-Is Process',
  'Finalize Configurations - Application',
  'Finalize Configurations - SSO/LDAP',
  'Conduct UAT',
  'Share CSV Package',
  'Train Users & Admins',
  'Go-Live on Production',
  'Hypercare',
  'Publish Go-Live Report',
];

export const CLEEN_TASKS = [
  // Kick-off Project
  { milestone: 'Kick-off Project', activities: 'Finalize SOW with Promise Owner', tools: 'Tool 1', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: '' },
  { milestone: 'Kick-off Project', activities: 'Discovery Project Goals & Key Success Metrics', tools: '', owner: 'Leucine Promise Owner', status: 'Not Started', duration: 1, dependency: 'Finalize SOW with Promise Owner' },
  { milestone: 'Kick-off Project', activities: 'Add Payment Tasks to the delivery plan as per SOW Milestones', tools: '', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Finalize SOW with Promise Owner' },
  { milestone: 'Kick-off Project', activities: 'Prepare Kick-off Deck & Delivery Plan', tools: 'Kick Off Deck Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Finalize SOW with Promise Owner' },
  { milestone: 'Kick-off Project', activities: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)', tools: '', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Prepare Kick-off Deck & Delivery Plan' },
  { milestone: 'Kick-off Project', activities: 'Finalize Delivery Plan (SOW, Project Plan, People)', tools: '', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 5, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Share Draft Change Control with Client', tools: 'Draft Change Control', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Initiate Change Control', tools: '', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Share Draft Change Control with Client' },
  { milestone: 'Kick-off Project', activities: 'Approve Change Control', tools: '', owner: 'Client Project Manager', status: 'Not Started', duration: 5, dependency: 'Initiate Change Control' },
  { milestone: 'Kick-off Project', activities: 'Conduct Kick-off call', tools: '', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 5, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Set up meetings - Project Managers - Alternative day', tools: 'Reference Alternate Day Sync Calendar Invite', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Set up meetings - Monthly Steering Commitee with Executives', tools: 'Reference Monthly Steering Commitee Meeting Calendar Invite', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Create Sharepoint Folder and share access with finalized people', tools: 'External access folder guide', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  // Map As-Is Process
  { milestone: 'Map As-Is Process', activities: 'Upload SOPs, Excel Matrix and Executed Cleaning Validation Protocols and Reports', tools: 'Process Mapping Workshop Guide', owner: 'Client CV SME', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Map As-Is Process', activities: 'Draft Application CS (Configuration Specifications)', tools: 'Draft CS Template', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Upload SOPs, Excel Matrix and Executed Cleaning Validation Protocols and Reports' },
  { milestone: 'Map As-Is Process', activities: 'Conduct Workshop for Cleaning Validation Process Mapping', tools: 'Draft CS Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Upload SOPs, Excel Matrix and Executed Cleaning Validation Protocols and Reports' },
  { milestone: 'Map As-Is Process', activities: 'Finalize CS for UAT Setup', tools: '', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Conduct Workshop for Cleaning Validation Process Mapping' },
  { milestone: 'Map As-Is Process', activities: 'Record Change Requests / GLRs', tools: '', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Workshop for Cleaning Validation Process Mapping' },
  // Finalize Configurations - Application
  { milestone: 'Finalize Configurations - Application', activities: 'Share Master Data Template', tools: 'Master Data Template and Walkthrough Video', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Finalize Configurations - Application', activities: 'Submit collected Master Data', tools: '', owner: 'Client CV SME', status: 'Not Started', duration: 2, dependency: 'Upload SOPs, Excel Matrix and Executed Cleaning Validation Protocols and Reports' },
  { milestone: 'Finalize Configurations - Application', activities: 'Setup & Test UAT Server', tools: '', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 2, dependency: 'Finalize CS for UAT Setup' },
  // Finalize Configurations - SSO/LDAP
  { milestone: 'Finalize Configurations - SSO/LDAP', activities: 'Draft & Share SSO Integration Specification', tools: 'SSO/LDAP Integration Playbook', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Finalize Configurations - SSO/LDAP', activities: 'Share access to internal SSO environment', tools: '', owner: 'Client IT SME', status: 'Not Started', duration: 5, dependency: 'Draft & Share SSO Integration Specification' },
  { milestone: 'Finalize Configurations - SSO/LDAP', activities: 'Setup & Test SSO Integration Service on UAT Server', tools: '', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 5, dependency: 'Share access to internal SSO environment' },
  { milestone: 'Finalize Configurations - SSO/LDAP', activities: 'Setup SSO Integration Service during PQ', tools: '', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Setup Productioon Server as per approved CS' },
  { milestone: 'Finalize Configurations - SSO/LDAP', activities: 'Validate SSO Integration Service during PQ', tools: 'PQ Protocol', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Execute PQ' },
  // Conduct UAT
  { milestone: 'Conduct UAT', activities: 'Share list of UAT Approvers to be Onboarded', tools: 'User Addition Excel Template', owner: 'Client CV SME', status: 'Not Started', duration: 1, dependency: 'Setup & Test UAT Server' },
  { milestone: 'Conduct UAT', activities: 'Execute UAT', tools: 'UAT Execution Guide', owner: 'Client CV SME', status: 'Not Started', duration: 4, dependency: 'Share list of UAT Approvers to be Onboarded' },
  { milestone: 'Conduct UAT', activities: 'Approve Configuration Specification', tools: '', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Execute UAT' },
  { milestone: 'Conduct UAT', activities: 'Approve Master Data', tools: '', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Execute UAT' },
  { milestone: 'Conduct UAT', activities: 'Approve UAT', tools: '', owner: 'Client UAT Approver', status: 'Not Started', duration: 1, dependency: 'Execute UAT' },
  // Share CSV Package
  { milestone: 'Share CSV Package', activities: 'Share Validation Plan', tools: 'Validation Plan', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Share CSV Package', activities: 'Acknowledge Validation Plan', tools: 'Same as above', owner: 'Client CSV SME', status: 'Not Started', duration: 3, dependency: 'Share Validation Plan' },
  { milestone: 'Share CSV Package', activities: 'Share CSV Package', tools: 'CSV Walkthrough Email', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  // Train Users & Admins
  { milestone: 'Train Users & Admins', activities: 'Share Draft Cleaning Validation SOP (Relevant Sections)', tools: 'Draft Cleaning Validation SOP Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Share CSV Package' },
  { milestone: 'Train Users & Admins', activities: 'Share Knowledge Base (Training Videos)', tools: 'Training Session Video for End Users, Super Users, Admins', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Share Draft Cleaning Validation SOP (Relevant Sections)' },
  { milestone: 'Train Users & Admins', activities: 'Approve Operational SOP', tools: '', owner: 'Client Project Manager', status: 'Not Started', duration: 5, dependency: 'Share Draft Cleaning Validation SOP (Relevant Sections)' },
  { milestone: 'Train Users & Admins', activities: 'Train Users on the Operational SOP', tools: 'NA', owner: 'Client UAT Approver', status: 'Not Started', duration: 5, dependency: 'Approve Operational SOP' },
  // Go-Live on Production
  { milestone: 'Go-Live on Production', activities: 'Share draft PQ Protocol and Report', tools: 'PQ Execution Guide + Draft PQ Protocol, Report', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Make Operational SOP effective' },
  { milestone: 'Go-Live on Production', activities: 'Preapprove PQ Protocol', tools: '', owner: 'Client CV SME', status: 'Not Started', duration: 3, dependency: 'Share draft PQ Protocol and Report' },
  { milestone: 'Go-Live on Production', activities: 'Setup Stage Server as per approved CS', tools: '', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 2, dependency: 'Approve UAT' },
  { milestone: 'Go-Live on Production', activities: 'Perform Leucine Dry run of PQ on Stage server', tools: 'NA', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 2, dependency: 'Setup Stage Server as per approved CS' },
  { milestone: 'Go-Live on Production', activities: 'Setup Productioon Server as per approved CS', tools: '', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Approve UAT' },
  { milestone: 'Go-Live on Production', activities: 'Execute & post-approve IQ-PS', tools: '', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Share Draft Cleaning Validation SOP (Relevant Sections)' },
  { milestone: 'Go-Live on Production', activities: 'Execute & post-approve Data Migration', tools: '', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Execute & post-approve IQ-PS' },
  { milestone: 'Go-Live on Production', activities: 'Add Users on Production server', tools: '', owner: 'Client IT SME', status: 'Not Started', duration: 1, dependency: 'Execute & post-approve Data Migration' },
  { milestone: 'Go-Live on Production', activities: 'Execute PQ', tools: '', owner: 'Client CV SME', status: 'Not Started', duration: 1, dependency: 'Add Users on Production server' },
  { milestone: 'Go-Live on Production', activities: 'Approve PQ Report', tools: '', owner: 'Client CV SME', status: 'Not Started', duration: 1, dependency: 'Execute PQ' },
  { milestone: 'Go-Live on Production', activities: 'Make Operational SOP effective', tools: '', owner: 'Client Project Manager', status: 'Not Started', duration: 5, dependency: 'Approve Operational SOP' },
  { milestone: 'Go-Live on Production', activities: 'Release System', tools: '', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Approve PQ Report' },
  // Hypercare
  { milestone: 'Hypercare', activities: 'Setup Hypercare support calls', tools: 'Hypercare Playbook', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Release System' },
  { milestone: 'Hypercare', activities: 'Hypercare Closure & Transition to BAU Support', tools: '', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Setup Hypercare support calls' },
  // Publish Go-Live Report
  { milestone: 'Publish Go-Live Report', activities: 'Schedule Go-Live Event', tools: 'Go-Live event guide', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Release System' },
  { milestone: 'Publish Go-Live Report', activities: 'Prepare Go-Live case study', tools: 'Go-Live case study template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Release System' },
  { milestone: 'Publish Go-Live Report', activities: 'Publish Go-Live case study', tools: 'Go-Live case study template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Prepare Go-Live case study' },
  { milestone: 'Publish Go-Live Report', activities: 'Publish Press Release', tools: 'Press-release Playbook', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Publish Go-Live case study' },
];


// ============================================================
// PROJECT PLAN COLUMNS
// ============================================================
export const PLAN_COLUMNS = [
  { key: 'milestone',                    label: 'Milestone',                        frozen: true,  width: 180, editable: ['admin'], dmEditable: false },
  { key: 'activities',                   label: 'Activities',                       frozen: true,  width: 240, editable: ['admin','dm'] },
  { key: 'tools',                        label: 'Tools',                            frozen: false, width: 160, editable: ['admin','dm'] },
  { key: 'owner',                        label: 'Owner',                            frozen: false, width: 160, editable: ['admin','dm'], type: 'owner-dropdown' },
  { key: 'status',                       label: 'Status',                           frozen: false, width: 130, editable: ['admin','dm'], type: 'status-dropdown' },
  { key: 'duration',                     label: 'Duration',                         frozen: false, width: 90,  editable: ['admin','dm'], type: 'number' },
  { key: 'baseline_planned_start',       label: 'Baseline Planned Start',           frozen: false, width: 140, editable: ['admin'], type: 'date' },
  { key: 'baseline_planned_end',         label: 'Baseline Planned End',             frozen: false, width: 140, editable: ['admin'], type: 'date' },
  { key: 'planned_start',                label: 'Planned Start',                    frozen: false, width: 120, editable: ['admin'], type: 'date' },  // DM can edit anchor task only
  { key: 'planned_end',                  label: 'Planned End',                      frozen: false, width: 120, editable: ['admin'], type: 'date' },
  { key: 'actual_start',                 label: 'Actual Start',                     frozen: false, width: 120, editable: ['admin','dm'], type: 'date' },
  { key: 'current_end',                  label: 'Current End',                      frozen: false, width: 120, editable: ['admin','dm'], type: 'date' },
  { key: 'dependency',                   label: 'Dependency',                       frozen: false, width: 200, editable: ['admin','dm'] },
  { key: 'deviation',                    label: 'Deviation',                        frozen: false, width: 120, editable: ['admin','dm'] },
  { key: 'deviation_details',            label: 'Deviation Details',                frozen: false, width: 200, editable: ['admin','dm'] },
  { key: 'delay_on_track',               label: 'Delay/On Track',                   frozen: false, width: 120, editable: [], type: 'computed' },
  { key: 'no_of_days_delay',             label: 'No of Days Delay',                 frozen: false, width: 120, editable: [], type: 'computed' },
  { key: 'planned_start_vs_baseline',    label: 'Planned Start - Baseline Planned Start', frozen: false, width: 200, editable: [], type: 'computed' },
  { key: 'learnings_from_delay',         label: 'Learnings from Delay',             frozen: false, width: 200, editable: ['admin','dm'] },
];

// Status options for dropdowns
export const STATUS_OPTIONS = ['Not Started', 'In Progress', 'Done', 'Blocked', 'Not Applicable'];

// Deal status options
export const DEAL_STATUS_OPTIONS = ['Ready for Onboarding', 'Under Onboarding', 'Live-Under Scaleup'];

// ============================================================
// LOGBOOKS TEMPLATE — 57 tasks across 10 milestones
// ============================================================
export const LOGBOOKS_MILESTONES = [
  'Kick-off Project',
  'Share CSV Package',
  'Assess Go-Live Readiness Infra',
  'Finalize Configurations - Application',
  'Finalize Configurations - SSO/LDAP',
  'Conduct UAT',
  'Train Users & Admins',
  'Go-Live on Production',
  'Hypercare',
  'Publish Go-Live Report',
];

export const LOGBOOKS_TASKS = [
  // Kick-off Project
  { milestone: 'Kick-off Project', activities: 'Finalize SOW with Delivery Manager', tools: 'Get ready for Kick-off', owner: 'Leucine Promise Owner', status: 'Not Started', duration: 1, dependency: '' },
  { milestone: 'Kick-off Project', activities: 'Discover Project Goals & Key Success Metrics', tools: 'Project Discovery', owner: 'Leucine Promise Owner', status: 'Not Started', duration: 1, dependency: 'Finalize SOW with Delivery Manager' },
  { milestone: 'Kick-off Project', activities: 'Add Payment Tasks to the delivery plan as per SOW Milestones', tools: 'Payment Tasks', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Finalize SOW with Delivery Manager' },
  { milestone: 'Kick-off Project', activities: 'Send Invoices', tools: '', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Add Payment Tasks to the delivery plan as per SOW Milestones' },
  { milestone: 'Kick-off Project', activities: 'Prepare Kick-off Deck & Delivery Plan', tools: 'Kick Off Deck Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Finalize SOW with Delivery Manager' },
  { milestone: 'Kick-off Project', activities: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)', tools: 'NA', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Prepare Kick-off Deck & Delivery Plan' },
  { milestone: 'Kick-off Project', activities: 'Finalize Delivery Plan (SOW, Project Plan, People)', tools: 'NA', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 5, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Finalize the list of Logbooks in Go Live Scope', tools: 'Go-live Scope Selection', owner: 'Client Production Leader', status: 'Not Started', duration: 5, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Upload Go-live scope documents', tools: 'Process Mapping', owner: 'Client Production SME', status: 'Not Started', duration: 1, dependency: 'Finalize the list of Logbooks in Go Live Scope' },
  { milestone: 'Kick-off Project', activities: 'Share Draft Change Control with Client', tools: 'Draft Change control', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Initiate and Approve Change Control', tools: 'Draft Change control', owner: 'Client Project Manager', status: 'Not Started', duration: 10, dependency: 'Share Draft Change Control with Client' },
  { milestone: 'Kick-off Project', activities: 'Receive Payment', tools: '', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Send Invoices' },
  { milestone: 'Kick-off Project', activities: 'Conduct Kick-off call', tools: 'Kick Off Deck Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 3, dependency: 'Receive Payment' },
  { milestone: 'Kick-off Project', activities: 'Set up meetings - Project Managers - Alternative day', tools: 'Reference Alternate Day Sync Calendar Invite', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Set up meetings - Monthly Steering Commitee with Executives', tools: 'Reference Monthly Steering Commitee Meeting Calendar Invite', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Create Sharepoint Site and share access with project team', tools: 'Sharepoint Site', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  // Share CSV Package
  { milestone: 'Share CSV Package', activities: 'Share Draft Validation Plan', tools: 'Validation Plan', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Share CSV Package', activities: 'Acknowledge Validation Plan', tools: 'Same as above', owner: 'Client Quality Leader', status: 'Not Started', duration: 10, dependency: 'Share Draft Validation Plan' },
  { milestone: 'Share CSV Package', activities: 'Share CSV Package', tools: 'CSV Walkthrough Email', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Share CSV Package', activities: 'Acknowledge CSV Package', tools: '', owner: 'Client Quality Leader', status: 'Not Started', duration: 10, dependency: 'Share CSV Package' },
  // Assess Go-Live Readiness Infra
  { milestone: 'Assess Go-Live Readiness Infra', activities: 'Share Recommended Network & Hardware Specifications', tools: 'Hardware Specifications', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Assess Go-Live Readiness Infra', activities: 'Identify gaps in the current site infrastructure', tools: 'Same as above', owner: 'Client IT SME', status: 'Not Started', duration: 5, dependency: 'Share Recommended Network & Hardware Specifications' },
  { milestone: 'Assess Go-Live Readiness Infra', activities: 'Order additional materials (such as Tablets, Routers, etc.)', tools: 'NA', owner: 'Client IT SME', status: 'Not Started', duration: 15, dependency: 'Identify gaps in the current site infrastructure' },
  // Finalize Configurations - Application
  { milestone: 'Finalize Configurations - Application', activities: 'Finalize Application CS (Configuration Specifications)', tools: 'Configuration Specification Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Conduct Kick-off call' },
  { milestone: 'Finalize Configurations - Application', activities: 'Setup & Test UAT Server', tools: 'Deploy Instance', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 5, dependency: 'Finalize Application CS (Configuration Specifications)' },
  // Finalize Configurations - SSO/LDAP
  { milestone: 'Finalize Configurations - SSO/LDAP', activities: 'Draft & Share SSO Integration Specification', tools: 'SSO/LDAP Integration Playbook', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Finalize Application CS (Configuration Specifications)' },
  { milestone: 'Finalize Configurations - SSO/LDAP', activities: 'Setup & Test SSO Integration Service on UAT Server', tools: 'Same as above', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 5, dependency: 'Draft & Share SSO Integration Specification' },
  // Conduct UAT
  { milestone: 'Conduct UAT', activities: 'Share list of UAT Approvers to be Onboarded', tools: 'Conduct UAT', owner: 'Client Production SME', status: 'Not Started', duration: 1, dependency: 'Setup & Test UAT Server' },
  { milestone: 'Conduct UAT', activities: 'Discuss, Prepare and Finalize Narrations for the Go-Live Set', tools: 'Process Migration', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 10, dependency: 'Setup & Test UAT Server' },
  { milestone: 'Conduct UAT', activities: 'Conduct UAT Execution for Go-Live set', tools: 'Conduct UAT', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 10, dependency: 'Discuss, Prepare and Finalize Narrations for the Go-Live Set' },
  { milestone: 'Conduct UAT', activities: 'Signoff UAT (Ontology and Process for Go Live processes)', tools: 'UAT Sign off Template', owner: 'UAT Coordinator', status: 'Not Started', duration: 5, dependency: 'Conduct UAT Execution for Go-Live set' },
  // Train Users & Admins
  { milestone: 'Train Users & Admins', activities: 'Share Draft MES SOP', tools: 'Draft MES SOP Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Share list of UAT Approvers to be Onboarded' },
  { milestone: 'Train Users & Admins', activities: 'Conduct training of super users', tools: 'Training Session Content', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Signoff UAT (Ontology and Process for Go Live processes)' },
  { milestone: 'Train Users & Admins', activities: 'Approve MES SOP', tools: 'NA', owner: 'Client Project Manager', status: 'Not Started', duration: 5, dependency: 'Share Draft MES SOP' },
  { milestone: 'Train Users & Admins', activities: 'Train Users on the Operational SOP', tools: 'NA', owner: 'UAT Coordinator', status: 'Not Started', duration: 5, dependency: 'Approve MES SOP' },
  // Go-Live on Production
  { milestone: 'Go-Live on Production', activities: 'Approve Application CS (Configuration Specification)', tools: 'Configuration Specification Template', owner: 'Client Project Manager', status: 'Not Started', duration: 5, dependency: 'Signoff UAT (Ontology and Process for Go Live processes)' },
  { milestone: 'Go-Live on Production', activities: 'Share draft PQ Protocol', tools: 'PQ Execution Guide', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Signoff UAT (Ontology and Process for Go Live processes)' },
  { milestone: 'Go-Live on Production', activities: 'Preapprove PQ Protocol', tools: 'NA', owner: 'Client Production SME', status: 'Not Started', duration: 5, dependency: 'Share draft PQ Protocol' },
  { milestone: 'Go-Live on Production', activities: 'Setup Quality Server as per approved CS', tools: 'Deploy Instance', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Preapprove PQ Protocol' },
  { milestone: 'Go-Live on Production', activities: 'Setup & Test SSO Integration Service on Quality Server', tools: 'NA', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Approve Application CS (Configuration Specification)' },
  { milestone: 'Go-Live on Production', activities: 'Share IQ-QS and CPC for Quality Server', tools: 'NA', owner: 'Leucine Integration Team', status: 'Not Started', duration: 1, dependency: 'Setup Quality Server as per approved CS' },
  { milestone: 'Go-Live on Production', activities: 'Migrate the Master Data from UAT to Quality', tools: 'Deploy Instance', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Share IQ-QS and CPC for Quality Server' },
  { milestone: 'Go-Live on Production', activities: 'Execute PQ', tools: 'NA', owner: 'Client Production SME', status: 'Not Started', duration: 4, dependency: 'Migrate the Master Data from UAT to Quality' },
  { milestone: 'Go-Live on Production', activities: 'Approve PQ Report', tools: 'NA', owner: 'Client Production SME', status: 'Not Started', duration: 1, dependency: 'Execute PQ' },
  { milestone: 'Go-Live on Production', activities: 'Setup Production Server as per approved CS', tools: 'Deploy Instance', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Approve Application CS (Configuration Specification)' },
  { milestone: 'Go-Live on Production', activities: 'Setup & Test SSO Integration Service on Production Server', tools: 'NA', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 1, dependency: 'Setup Production Server as per approved CS' },
  { milestone: 'Go-Live on Production', activities: 'Migrate the Master Data from UAT to Production', tools: '', owner: 'Leucine Solution Architect', status: 'Not Started', duration: 2, dependency: 'Setup & Test SSO Integration Service on Production Server' },
  { milestone: 'Go-Live on Production', activities: 'Share IQ-PS and CPC for Production Server', tools: 'IQ-PS Template + CPC Template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Setup Production Server as per approved CS' },
  { milestone: 'Go-Live on Production', activities: 'Add Users and make user groups on Production server', tools: 'NA', owner: 'Client IT SME', status: 'Not Started', duration: 1, dependency: 'Setup Production Server as per approved CS' },
  { milestone: 'Go-Live on Production', activities: 'Make MES SOP Effective', tools: 'NA', owner: 'Client Quality SME', status: 'Not Started', duration: 1, dependency: 'Add Users and make user groups on Production server' },
  { milestone: 'Go-Live on Production', activities: 'Release System', tools: 'NA', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Approve PQ Report' },
  // Hypercare
  { milestone: 'Hypercare', activities: 'Setup Hypercare support calls', tools: 'Hypercare Playbook', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Release System' },
  { milestone: 'Hypercare', activities: 'Hypercare Closure & Transition to BAU Support', tools: 'Same as above', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Setup Hypercare support calls' },
  // Publish Go-Live Report
  { milestone: 'Publish Go-Live Report', activities: 'Schedule Go-Live Event (Inform Customer Events Team)', tools: 'Go-Live event guide', owner: 'Client Project Manager', status: 'Not Started', duration: 1, dependency: 'Release System' },
  { milestone: 'Publish Go-Live Report', activities: 'Prepare Go-Live case study', tools: 'Go-Live case study template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Release System' },
  { milestone: 'Publish Go-Live Report', activities: 'Publish Go-Live case study', tools: 'Go-Live case study template', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Prepare Go-Live case study' },
  { milestone: 'Publish Go-Live Report', activities: 'Publish Press Release', tools: 'Press-release Playbook', owner: 'Leucine Delivery Manager', status: 'Not Started', duration: 1, dependency: 'Publish Go-Live case study' },
];

// ============================================================
// UPDATED getTemplateForCategory
// ============================================================
export function getTemplateForCategory(categoryName) {
  if (categoryName === 'CLEEN') {
    return { milestones: CLEEN_MILESTONES, tasks: CLEEN_TASKS, hasUAT: false };
  }
  if (categoryName === 'Logbooks') {
    return { milestones: LOGBOOKS_MILESTONES, tasks: LOGBOOKS_TASKS, hasUAT: true, uatType: 'logbooks' };
  }
  // MES, DMS, AI Investigator, LMS, AI Agents → MES template
  return { milestones: MES_MILESTONES, tasks: MES_TASKS, hasUAT: true, uatType: 'mes' };
}

// ============================================================
// UAT TRACKER TEMPLATES
// ============================================================

// MES UAT default rows (BMR + BPR + Logbooks/Processes)
export const MES_UAT_TEMPLATE = [
  // BMR group
  { group_name: 'BMR', process_name: '{Stage 1 Name}', status: 'Ready for UAT', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'BMR', process_name: '{Stage 2 Name}', status: 'Ready for UAT', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'BMR', process_name: '{Stage 3 Name}', status: 'Ready for UAT', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'BMR', process_name: '{Stage 4 Name}', status: 'Under Reconfig', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'BMR', process_name: '{Stage 5 Name}', status: 'In Progress', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'BMR', process_name: '{Stage 6 Name}', status: 'In Progress', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  // BPR group
  { group_name: 'BPR', process_name: '{Stage 1 Name}', status: '', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'BPR', process_name: '{Stage 2 Name}', status: '', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'BPR', process_name: '{Stage 3 Name}', status: '', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'BPR', process_name: '{Stage 4 Name}', status: '', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'BPR', process_name: '{Stage 5 Name}', status: '', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'BPR', process_name: '{Stage 6 Name}', status: '', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  // Logbooks/Processes group
  { group_name: 'Logbooks / Processes', process_name: 'Logbook 1 Name', status: '', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'Logbooks / Processes', process_name: 'Logbook 2 Name', status: '', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'Logbooks / Processes', process_name: 'Logbook 3 Name', status: '', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'Logbooks / Processes', process_name: 'Logbook 4 Name', status: '', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'Logbooks / Processes', process_name: 'Logbook 5 Name', status: '', uat_approver: '', batch_1_status: 'Not Started', batch_2_status: 'Not Started', batch_3_status: 'Not Started', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
];

// Logbooks UAT default rows (Logbooks/Processes only — no batches)
export const LOGBOOKS_UAT_TEMPLATE = [
  { group_name: 'Logbooks / Processes', process_name: 'Logbook 1 Name', status: '', uat_approver: '', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'Logbooks / Processes', process_name: 'Logbook 2 Name', status: '', uat_approver: '', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'Logbooks / Processes', process_name: 'Logbook 3 Name', status: '', uat_approver: '', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'Logbooks / Processes', process_name: 'Logbook 4 Name', status: '', uat_approver: '', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
  { group_name: 'Logbooks / Processes', process_name: 'Logbook 5 Name', status: '', uat_approver: '', paper_fields: null, eliminated: null, automated: null, controlled: null, remaining: null, interlocks: '', compliance_score: '' },
];

// UAT Status options
export const UAT_STATUS_OPTIONS = ['Not Started', 'Ready for UAT', 'In Progress', 'Under Reconfig', 'UAT Complete', 'Signed Off'];
export const UAT_BATCH_STATUS_OPTIONS = ['Not Started', 'In Progress', 'Done', 'Blocked'];

// ============================================================
// FEEDBACK TEMPLATE (same for ALL applications)
// Columns: #, Requirement, Delivery Priority, Clickup Task Id, Development Status, Due Date Committed to Customer
// ============================================================
export const FEEDBACK_TEMPLATE = [
  { requirement: '', delivery_priority: '', clickup_task_id: '', development_status: '', due_date_committed: null },
  { requirement: '', delivery_priority: '', clickup_task_id: '', development_status: '', due_date_committed: null },
  { requirement: '', delivery_priority: '', clickup_task_id: '', development_status: '', due_date_committed: null },
  { requirement: '', delivery_priority: '', clickup_task_id: '', development_status: '', due_date_committed: null },
];

export const FEEDBACK_PRIORITY_OPTIONS = ['Critical', 'High', 'Medium', 'Low'];
export const FEEDBACK_DEV_STATUS_OPTIONS = ['Not Started', 'In Progress', 'Done', 'On Hold', 'Cancelled'];

// ============================================================
// MES + LOGBOOKS PROJECT PLAN TEMPLATE — 99 tasks, 10 milestones
// Dates are intentionally omitted; they will be computed from
// the project's actual planned_start once loaded.
// ============================================================
export const PLAN_TEMPLATE = [
  // ── Kick-off Project ─────────────────────────────────────
  { milestone: 'Kick-off Project', activities: 'Finalize SOW with Delivery Manager',                                              tools: 'Get ready for Kick-off',                              owner: '', duration: 1,  dependency: '' },
  { milestone: 'Kick-off Project', activities: 'Discover Project Goals & Key Success Metrics',                                    tools: 'Project Discovery',                                    owner: '', duration: 1,  dependency: 'Finalize SOW with Delivery Manager' },
  { milestone: 'Kick-off Project', activities: 'Add Payment Tasks to the delivery plan as per SOW Milestones',                    tools: 'Payment Tasks',                                        owner: '', duration: 1,  dependency: 'Finalize SOW with Delivery Manager' },
  { milestone: 'Kick-off Project', activities: 'Send Invoices',                                                                   tools: '',                                                     owner: '', duration: 1,  dependency: 'Add Payment Tasks to the delivery plan as per SOW Milestones' },
  { milestone: 'Kick-off Project', activities: 'Prepare Kick-off Deck & Delivery Plan',                                          tools: 'Kick Off Deck Template',                               owner: '', duration: 1,  dependency: 'Finalize SOW with Delivery Manager' },
  { milestone: 'Kick-off Project', activities: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)',                     tools: 'NA',                                                   owner: '', duration: 1,  dependency: 'Prepare Kick-off Deck & Delivery Plan' },
  { milestone: 'Kick-off Project', activities: 'Finalize Delivery Plan (SOW, Project Plan, People)',                             tools: 'NA',                                                   owner: '', duration: 5,  dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Finalize the list of BMRs, BPRs and Logbooks in Go Live Scope',                 tools: 'Go-live Scope Selection',                              owner: '', duration: 5,  dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Upload Go-live scope documents',                                                  tools: 'Process Mapping',                                      owner: '', duration: 1,  dependency: 'Finalize the list of BMRs, BPRs and Logbooks in Go Live Scope' },
  { milestone: 'Kick-off Project', activities: 'Share Draft Change Control with Client',                                          tools: 'Draft Change control',                                 owner: '', duration: 1,  dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Initiate and Approve Change Control',                                             tools: 'Draft Change control',                                 owner: '', duration: 10, dependency: 'Share Draft Change Control with Client' },
  { milestone: 'Kick-off Project', activities: 'Receive Payment',                                                                 tools: '',                                                     owner: '', duration: 1,  dependency: 'Send Invoices' },
  { milestone: 'Kick-off Project', activities: 'Conduct Kick-off call',                                                           tools: 'Kick Off Deck Template',                               owner: '', duration: 3,  dependency: 'Receive Payment' },
  { milestone: 'Kick-off Project', activities: 'Set up meetings - Project Managers - Alternative day',                           tools: 'Reference Alternate Day Sync Calendar Invite',         owner: '', duration: 1,  dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Set up meetings - Monthly Steering Commitee with Executives',                    tools: 'Reference Monthly Steering Commitee Meeting Calendar Invite', owner: '', duration: 1, dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  { milestone: 'Kick-off Project', activities: 'Create Sharepoint Site and share access with project team',                      tools: 'Sharepoint Site',                                      owner: '', duration: 1,  dependency: 'Conduct Pre-kick off call (align on SOW and Delivery Plan)' },
  // ── Share CSV Package ────────────────────────────────────
  { milestone: 'Share CSV Package', activities: 'Share Validation Plan',                                                          tools: 'Validation Plan',                                      owner: '', duration: 1,  dependency: 'Conduct Kick-off call' },
  { milestone: 'Share CSV Package', activities: 'Acknowledge Validation Plan',                                                    tools: 'Same as above',                                        owner: '', duration: 3,  dependency: 'Share Validation Plan' },
  { milestone: 'Share CSV Package', activities: 'Share CSV Package',                                                              tools: 'CSV Walkthrough Email',                                owner: '', duration: 1,  dependency: 'Conduct Kick-off call' },
  // ── Map As-Is Process ────────────────────────────────────
  { milestone: 'Map As-Is Process', activities: 'Collect master data - Area, room, product data, equipment',                     tools: '',                                                     owner: '', duration: 2,  dependency: 'Conduct Kick-off call' },
  { milestone: 'Map As-Is Process', activities: 'Collect executed and master copies of BMR, BPR and logbooks',                  tools: '',                                                     owner: '', duration: 2,  dependency: 'Conduct Kick-off call' },
  { milestone: 'Map As-Is Process', activities: 'Conduct workshop - ERP',                                                         tools: '',                                                     owner: '', duration: 1,  dependency: 'Collect executed and master copies of BMR, BPR and logbooks' },
  { milestone: 'Map As-Is Process', activities: 'Conduct workshop - BMR Process and associated logbooks',                        tools: '',                                                     owner: '', duration: 1,  dependency: 'Conduct workshop - ERP' },
  { milestone: 'Map As-Is Process', activities: 'Conduct workshop - BPR Process and associated logbooks',                        tools: '',                                                     owner: '', duration: 1,  dependency: 'Conduct workshop - BMR Process and associated logbooks' },
  { milestone: 'Map As-Is Process', activities: 'Identify unavailable process templates in Leucine DWI Library',                 tools: 'Process Mapping',                                      owner: '', duration: 2,  dependency: 'Upload Go-live scope documents' },
  { milestone: 'Map As-Is Process', activities: 'If required, request client for more information for unavailable process templates', tools: 'Same as above',                                  owner: '', duration: 3,  dependency: 'Upload Go-live scope documents' },
  { milestone: 'Map As-Is Process', activities: 'Publish Simple Process Flow Chart',                                              tools: 'Same as above',                                        owner: '', duration: 3,  dependency: 'Upload Go-live scope documents' },
  // ── Assess Go-Live Readiness Infra ───────────────────────
  { milestone: 'Assess Go-Live Readiness Infra', activities: 'Share Recommended Network & Hardware Specifications',               tools: 'Hardware Specifications',                              owner: '', duration: 1,  dependency: 'Conduct Kick-off call' },
  { milestone: 'Assess Go-Live Readiness Infra', activities: 'Share Equipment Integration Readiness Checklist',                  tools: 'Equipment Integration Playbook',                       owner: '', duration: 1,  dependency: 'Conduct Kick-off call' },
  { milestone: 'Assess Go-Live Readiness Infra', activities: 'Identify gaps in the current site infrastructure',                 tools: 'Same as above',                                        owner: '', duration: 5,  dependency: 'Share Recommended Network & Hardware Specifications' },
  { milestone: 'Assess Go-Live Readiness Infra', activities: 'Order additional materials (such as Tablets, Routers, etc.)',      tools: 'NA',                                                   owner: '', duration: 15, dependency: 'Identify gaps in the current site infrastructure' },
  // ── Finalize Configurations - Application ────────────────
  { milestone: 'Finalize Configurations - Application', activities: 'Finalize Application CS (Configuration Specifications)',    tools: 'Configuration Specification Template',                 owner: '', duration: 1,  dependency: 'Conduct Kick-off call' },
  { milestone: 'Finalize Configurations - Application', activities: 'Setup & Test UAT Server',                                   tools: 'Deploy Instance',                                      owner: '', duration: 5,  dependency: 'Finalize Application CS (Configuration Specifications)' },
  { milestone: 'Finalize Configurations - Application', activities: 'Approve Configuration Specification',                       tools: 'Configuration Specification Template',                 owner: '', duration: 5,  dependency: 'Setup & Test UAT Server' },
  // ── Finalize Configurations - SSO/LDAP ───────────────────
  { milestone: 'Finalize Configurations - SSO/LDAP', activities: 'Draft & Share SSO Integration Specification',                  tools: 'SSO/LDAP Integration Playbook',                        owner: '', duration: 1,  dependency: 'Finalize Application CS (Configuration Specifications)' },
  { milestone: 'Finalize Configurations - SSO/LDAP', activities: 'Setup & Test SSO Integration Service on UAT Server',          tools: 'Same as above',                                        owner: '', duration: 10, dependency: 'Draft & Share SSO Integration Specification' },
  // ── Finalize Configurations - ERP ────────────────────────
  { milestone: 'Finalize Configurations - ERP', activities: 'Inform Integration Specifications to the client',                   tools: 'ERP Integration Playbook',                             owner: '', duration: 1,  dependency: 'Conduct Kick-off call' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Finalize Integration Specifications',                               tools: 'Same as above',                                        owner: '', duration: 5,  dependency: 'Inform Integration Specifications to the client' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Build or Share ERP Interface',                                      tools: 'Same as above',                                        owner: '', duration: 5,  dependency: 'Finalize Integration Specifications' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Test ERP Interface',                                                tools: 'Same as above',                                        owner: '', duration: 2,  dependency: 'Build or Share ERP Interface' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Map SAP properties to DWI properties',                             tools: 'Same as above',                                        owner: '', duration: 2,  dependency: 'Build or Share ERP Interface' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Setup & Test ERP Integration Service on UAT Server (Ontology)',    tools: 'Same as above',                                        owner: '', duration: 2,  dependency: 'Map SAP properties to DWI properties' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Test data flow from ERP to Ontology',                               tools: 'Same as above',                                        owner: '', duration: 5,  dependency: 'Setup & Test ERP Integration Service on UAT Server (Ontology)' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Migrate the service from Dev/Quality to production',                tools: 'Same as above',                                        owner: '', duration: 2,  dependency: 'Test data flow from Ontology to Process' },
  { milestone: 'Finalize Configurations - ERP', activities: 'Test data flow from production ERP to Ontology',                   tools: 'Same as above',                                        owner: '', duration: 1,  dependency: 'Migrate the service from Dev/Quality to production' },
  // ── Finalize Configurations - E1 ─────────────────────────
  { milestone: 'Finalize Configurations - E1', activities: 'Inform Integration Specifications to the client',                    tools: 'Equipment Integration Playbook',                       owner: '', duration: 1,  dependency: 'Conduct Kick-off call' },
  { milestone: 'Finalize Configurations - E1', activities: 'Submit filled Equipment Integration Readiness Checklist',           tools: 'Same as above',                                        owner: '', duration: 5,  dependency: 'Share Equipment Integration Readiness Checklist' },
  { milestone: 'Finalize Configurations - E1', activities: 'Send an approach for Integration readiness',                         tools: 'Same as above',                                        owner: '', duration: 2,  dependency: 'Submit filled Equipment Integration Readiness Checklist' },
  { milestone: 'Finalize Configurations - E1', activities: 'Enable Integration Readiness',                                       tools: 'Same as above',                                        owner: '', duration: 15, dependency: 'Send an approach for Integration readiness' },
  { milestone: 'Finalize Configurations - E1', activities: 'Perform an Initial assessment of integration readiness',            tools: 'Same as above',                                        owner: '', duration: 2,  dependency: 'Enable Integration Readiness' },
  { milestone: 'Finalize Configurations - E1', activities: 'Setup & Test Equipment Integration Service on UAT Server (Ontology)', tools: 'Same as above',                                     owner: '', duration: 5,  dependency: 'Perform an Initial assessment of integration readiness' },
  { milestone: 'Finalize Configurations - E1', activities: 'Test data flow from Ontology to Process',                            tools: 'Same as above',                                        owner: '', duration: 5,  dependency: 'Setup & Test Equipment Integration Service on UAT Server (Ontology)' },
  // ── Conduct UAT ──────────────────────────────────────────
  { milestone: 'Conduct UAT', activities: 'Share list of UAT Approvers to be Onboarded',                                         tools: 'Conduct UAT',                                          owner: '', duration: 1,  dependency: 'Setup & Test UAT Server' },
  { milestone: 'Conduct UAT', activities: 'Copy template from Leucine Library or Design Template',                               tools: 'Process Migration',                                    owner: '', duration: 20, dependency: 'Setup & Test UAT Server' },
  { milestone: 'Conduct UAT', activities: 'Perform a complete dry run of the BMR before UAT execution',                         tools: 'Conduct UAT',                                          owner: '', duration: 2,  dependency: 'Copy template from Leucine Library or Design Template' },
  { milestone: 'Conduct UAT', activities: 'Conduct guided UAT Execution for 1 recently executed batch (without ERP)',           tools: 'Conduct UAT',                                          owner: '', duration: 10, dependency: 'Copy template from Leucine Library or Design Template' },
  { milestone: 'Conduct UAT', activities: 'Conduct incremental UAT execution just for ERP data fields',                         tools: 'Same as above',                                        owner: '', duration: 5,  dependency: 'Conduct guided UAT Execution for 1 recently executed batch (without ERP)' },
  { milestone: 'Conduct UAT', activities: 'Signoff UAT (Ontology and Process for Go Live processes)',                           tools: 'UAT Sign off Template',                                owner: '', duration: 5,  dependency: 'Copy template from Leucine Library or Design Template' },
  // ── Train Users & Admins ─────────────────────────────────
  { milestone: 'Train Users & Admins', activities: 'Share Draft MES SOP',                                                        tools: 'Draft MES SOP Template',                               owner: '', duration: 1,  dependency: 'Share list of UAT Approvers to be Onboarded' },
  { milestone: 'Train Users & Admins', activities: 'Share Knowledge Base (Training Videos)',                                     tools: 'Training Session Content',                             owner: '', duration: 1,  dependency: 'Signoff UAT (Ontology and Process for Go Live processes)' },
  { milestone: 'Train Users & Admins', activities: 'Approve MES SOP',                                                            tools: 'NA',                                                   owner: '', duration: 5,  dependency: 'Share Draft MES SOP' },
  { milestone: 'Train Users & Admins', activities: 'Train Users on the Operational SOP',                                        tools: 'NA',                                                   owner: '', duration: 5,  dependency: 'Approve MES SOP' },
  // ── Go-Live on Production ────────────────────────────────
  { milestone: 'Go-Live on Production', activities: 'Share draft PQ Protocol',                                                   tools: 'PQ Execution Guide',                                   owner: '', duration: 1,  dependency: 'Signoff UAT (Ontology and Process for Go Live processes)' },
  { milestone: 'Go-Live on Production', activities: 'Preapprove PQ Protocol',                                                    tools: 'NA',                                                   owner: '', duration: 5,  dependency: 'Share draft PQ Protocol' },
  { milestone: 'Go-Live on Production', activities: 'Setup Stage Server as per approved CS',                                    tools: 'Deploy Instance',                                      owner: '', duration: 1,  dependency: 'Preapprove PQ Protocol' },
  { milestone: 'Go-Live on Production', activities: 'Setup & Test SSO Integration Service on Stage Server',                     tools: 'NA',                                                   owner: '', duration: 1,  dependency: 'Setup Stage Server as per approved CS' },
  { milestone: 'Go-Live on Production', activities: 'Migrate the service from UAT to Stage- ERP',                               tools: 'NA',                                                   owner: '', duration: 2,  dependency: 'Setup & Test SSO Integration Service on Stage Server' },
  { milestone: 'Go-Live on Production', activities: 'Migrate the service from UAT to Stage- E1',                                tools: 'NA',                                                   owner: '', duration: 5,  dependency: 'Migrate the service from UAT to Stage- ERP' },
  { milestone: 'Go-Live on Production', activities: 'Perform Leucine Dry run of PQ on Stage server',                           tools: 'NA',                                                   owner: '', duration: 1,  dependency: 'Migrate the service from UAT to Stage- E1' },
  { milestone: 'Go-Live on Production', activities: 'Setup Production Server as per approved CS',                               tools: 'Deploy Instance',                                      owner: '', duration: 1,  dependency: 'Perform Leucine Dry run of PQ on Stage server' },
  { milestone: 'Go-Live on Production', activities: 'Setup & Test SSO Integration Service on Production Server',               tools: 'NA',                                                   owner: '', duration: 1,  dependency: 'Setup Production Server as per approved CS' },
  { milestone: 'Go-Live on Production', activities: 'Migrate the service from UAT to Production- ERP',                         tools: 'NA',                                                   owner: '', duration: 2,  dependency: 'Setup & Test SSO Integration Service on Production Server' },
  { milestone: 'Go-Live on Production', activities: 'Migrate the service from UAT to Production- E1',                          tools: 'NA',                                                   owner: '', duration: 5,  dependency: 'Migrate the service from UAT to Production- ERP' },
  { milestone: 'Go-Live on Production', activities: 'Share IQ-PS and CPC for Production Server',                               tools: 'IQ-PS Template + CPC Template',                        owner: '', duration: 1,  dependency: 'Migrate the service from UAT to Production- E1' },
  { milestone: 'Go-Live on Production', activities: 'Share executed Data Migration Report',                                     tools: 'Data migration report',                                owner: '', duration: 1,  dependency: 'Share IQ-PS and CPC for Production Server' },
  { milestone: 'Go-Live on Production', activities: 'Add Users and make user groups on Production server',                     tools: 'NA',                                                   owner: '', duration: 1,  dependency: 'Share executed Data Migration Report' },
  { milestone: 'Go-Live on Production', activities: 'Execute PQ',                                                               tools: 'NA',                                                   owner: '', duration: 4,  dependency: 'Add Users and make user groups on Production server' },
  { milestone: 'Go-Live on Production', activities: 'Approve PQ Report',                                                        tools: 'NA',                                                   owner: '', duration: 1,  dependency: 'Execute PQ' },
  { milestone: 'Go-Live on Production', activities: 'Make MES SOP Effective',                                                   tools: 'NA',                                                   owner: '', duration: 1,  dependency: 'Approve PQ Report' },
  { milestone: 'Go-Live on Production', activities: 'Release System',                                                           tools: 'NA',                                                   owner: '', duration: 1,  dependency: 'Approve PQ Report' },
  // ── Hypercare ────────────────────────────────────────────
  { milestone: 'Hypercare', activities: 'Setup Hypercare support calls',                                                         tools: 'Hypercare Playbook',                                   owner: '', duration: 1,  dependency: 'Release System' },
  { milestone: 'Hypercare', activities: 'Hypercare Closure & Transition to BAU Support',                                        tools: 'Same as above',                                        owner: '', duration: 1,  dependency: 'Setup Hypercare support calls' },
  // ── Publish Go-Live Report ───────────────────────────────
  { milestone: 'Publish Go-Live Report', activities: 'Schedule Go-Live Event (Inform Customer Events Team)',                    tools: 'Go-Live event guide',                                  owner: '', duration: 1,  dependency: 'Release System' },
  { milestone: 'Publish Go-Live Report', activities: 'Prepare Go-Live case study',                                              tools: 'Go-Live case study template',                          owner: '', duration: 1,  dependency: 'Release System' },
  { milestone: 'Publish Go-Live Report', activities: 'Publish Go-Live case study',                                              tools: 'Go-Live case study template',                          owner: '', duration: 1,  dependency: 'Prepare Go-Live case study' },
  { milestone: 'Publish Go-Live Report', activities: 'Publish Press Release',                                                   tools: 'Press-release Playbook',                               owner: '', duration: 1,  dependency: 'Publish Go-Live case study' },
];
