const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const sampleApplications = [
  {
    "Application Name": "SAP S/4HANA Finance",
    "Department": "Finance & Accounting",
    "Business Criticality": "Mission Critical",
    "Annual Maintenance Cost": 850000,
    "Architecture Health": "Modern",
    "Hosting": "Azure Cloud",
    "Tech Stack": "ABAP, SAP HANA, In-Memory DB",
    "Cloud Readiness": "Cloud Native",
    "Active Users": 3200,
    "Vendor": "SAP SE",
    "Dependencies": "Active Directory, Snowflake Data Warehouse",
    "Description": "Central enterprise resource planning system managing general ledger, accounts payable, and statutory reporting."
  },
  {
    "Application Name": "Legacy AS400 Core Banking",
    "Department": "Core Operations",
    "Business Criticality": "Mission Critical",
    "Annual Maintenance Cost": 1200000,
    "Architecture Health": "EOL & Fragile",
    "Hosting": "On-Premises Mainframe",
    "Tech Stack": "RPG, COBOL, DB2/400",
    "Cloud Readiness": "Legacy Incompatible",
    "Active Users": 450,
    "Vendor": "IBM",
    "Dependencies": "Oracle E-Business Suite 11i, Legacy COBOL Payroll Engine",
    "Description": "Over-30-year-old core banking ledger. Monolithic codebase with dwindling talent pool and exorbitant maintenance contracts."
  },
  {
    "Application Name": "Salesforce Sales Cloud",
    "Department": "Sales & Marketing",
    "Business Criticality": "High",
    "Annual Maintenance Cost": 420000,
    "Architecture Health": "Modern SaaS",
    "Hosting": "SaaS",
    "Tech Stack": "Apex, Lightning Web Components",
    "Cloud Readiness": "Cloud Native",
    "Active Users": 1800,
    "Vendor": "Salesforce",
    "Dependencies": "Zendesk Support, Snowflake Data Warehouse",
    "Description": "Global CRM for opportunity pipeline, lead routing, and customer interaction histories."
  },
  {
    "Application Name": "Legacy PHP Customer Portal",
    "Department": "Customer Support",
    "Business Criticality": "Medium",
    "Annual Maintenance Cost": 280000,
    "Architecture Health": "High Tech Debt",
    "Hosting": "On-Premises VM",
    "Tech Stack": "PHP 5.6, MySQL 5.5, Apache",
    "Cloud Readiness": "Monolith Heavy",
    "Active Users": 12000,
    "Vendor": "In-House",
    "Dependencies": "Legacy AS400 Core Banking",
    "Description": "Customer-facing ticket and order portal built 14 years ago on unsupported PHP 5.6. Frequent security vulnerabilities."
  },
  {
    "Application Name": "Workday HCM",
    "Department": "Human Resources",
    "Business Criticality": "High",
    "Annual Maintenance Cost": 310000,
    "Architecture Health": "Modern SaaS",
    "Hosting": "SaaS",
    "Tech Stack": "Workday Cloud API, Enterprise Interface Builder",
    "Cloud Readiness": "Cloud Native",
    "Active Users": 5500,
    "Vendor": "Workday",
    "Dependencies": "Active Directory, SAP S/4HANA Finance",
    "Description": "Global workforce management, payroll integrations, benefits administration, and talent acquisition."
  },
  {
    "Application Name": "Legacy COBOL Payroll Engine",
    "Department": "Human Resources",
    "Business Criticality": "High",
    "Annual Maintenance Cost": 380000,
    "Architecture Health": "EOL & Fragile",
    "Hosting": "On-Premises Mainframe",
    "Tech Stack": "COBOL, CICS, VSAM",
    "Cloud Readiness": "Legacy Incompatible",
    "Active Users": 15,
    "Vendor": "In-House",
    "Dependencies": "Legacy AS400 Core Banking",
    "Description": "Duplicate batch payroll calculation system that runs monthly. Redundant since Workday HCM implementation."
  },
  {
    "Application Name": "Snowflake Data Warehouse",
    "Department": "Analytics & BI",
    "Business Criticality": "High",
    "Annual Maintenance Cost": 490000,
    "Architecture Health": "Modern",
    "Hosting": "AWS Cloud",
    "Tech Stack": "Snowflake SQL, Python, dbt",
    "Cloud Readiness": "Cloud Native",
    "Active Users": 650,
    "Vendor": "Snowflake Inc",
    "Dependencies": "Tableau Analytics Server, Custom Python Microservices",
    "Description": "Central enterprise analytical lakehouse aggregating transactions across all sales, finance, and marketing platforms."
  },
  {
    "Application Name": "Oracle E-Business Suite 11i",
    "Department": "Supply Chain & Logistics",
    "Business Criticality": "High",
    "Annual Maintenance Cost": 640000,
    "Architecture Health": "High Tech Debt",
    "Hosting": "On-Premises Bare Metal",
    "Tech Stack": "Oracle Forms, PL/SQL, Oracle 10g",
    "Cloud Readiness": "Monolith Heavy",
    "Active Users": 320,
    "Vendor": "Oracle",
    "Dependencies": "Legacy AS400 Core Banking, SAP S/4HANA Finance",
    "Description": "Procurement and supply chain system lagging on an unsupported 11i release with massive customizations."
  },
  {
    "Application Name": "Custom Python Microservices",
    "Department": "Engineering",
    "Business Criticality": "Mission Critical",
    "Annual Maintenance Cost": 190000,
    "Architecture Health": "Modern",
    "Hosting": "AWS Cloud (EKS)",
    "Tech Stack": "FastAPI, Python 3.11, Docker, PostgreSQL",
    "Cloud Readiness": "Cloud Native",
    "Active Users": 40000,
    "Vendor": "In-House",
    "Dependencies": "Active Directory, Snowflake Data Warehouse",
    "Description": "Core customer API gateway and event-driven microservices handling authentication and digital transactions."
  },
  {
    "Application Name": "Lotus Notes Archival DB",
    "Department": "Legal & Compliance",
    "Business Criticality": "Low",
    "Annual Maintenance Cost": 145000,
    "Architecture Health": "EOL & Fragile",
    "Hosting": "On-Premises VM",
    "Tech Stack": "Lotus Domino 8.5, NSF Database",
    "Cloud Readiness": "Legacy Incompatible",
    "Active Users": 8,
    "Vendor": "IBM / HCL",
    "Dependencies": "Active Directory",
    "Description": "Historical email and memo repository kept alive strictly for compliance retention. Only queried 2-3 times per year."
  },
  {
    "Application Name": "Tableau Analytics Server",
    "Department": "Analytics & BI",
    "Business Criticality": "Medium",
    "Annual Maintenance Cost": 260000,
    "Architecture Health": "Stable",
    "Hosting": "On-Premises VM",
    "Tech Stack": "Tableau Server, PostgreSQL, Windows Server",
    "Cloud Readiness": "Cloud Ready",
    "Active Users": 1100,
    "Vendor": "Salesforce / Tableau",
    "Dependencies": "Snowflake Data Warehouse",
    "Description": "On-prem dashboard server. High infrastructure cost compared to Tableau Cloud or Power BI embedded."
  },
  {
    "Application Name": "Legacy FoxPro Inventory",
    "Department": "Supply Chain & Logistics",
    "Business Criticality": "Low",
    "Annual Maintenance Cost": 95000,
    "Architecture Health": "EOL & Fragile",
    "Hosting": "Local Windows Server 2008",
    "Tech Stack": "Visual FoxPro 9.0, DBF files",
    "Cloud Readiness": "Legacy Incompatible",
    "Active Users": 12,
    "Vendor": "In-House",
    "Dependencies": "Oracle E-Business Suite 11i",
    "Description": "Regional warehouse stock tracker run on an unpatched Windows 2008 machine. Severe single-point-of-failure."
  },
  {
    "Application Name": "Jira & Confluence Cloud",
    "Department": "Engineering",
    "Business Criticality": "High",
    "Annual Maintenance Cost": 175000,
    "Architecture Health": "Modern SaaS",
    "Hosting": "SaaS",
    "Tech Stack": "Atlassian Cloud REST API, Forge",
    "Cloud Readiness": "Cloud Native",
    "Active Users": 1400,
    "Vendor": "Atlassian",
    "Dependencies": "Active Directory",
    "Description": "Standardized issue tracking, product sprint planning, and engineering knowledge base."
  },
  {
    "Application Name": "ServiceNow ITOM",
    "Department": "IT Infrastructure",
    "Business Criticality": "High",
    "Annual Maintenance Cost": 390000,
    "Architecture Health": "Modern SaaS",
    "Hosting": "SaaS",
    "Tech Stack": "ServiceNow Now Platform, JavaScript",
    "Cloud Readiness": "Cloud Native",
    "Active Users": 2200,
    "Vendor": "ServiceNow",
    "Dependencies": "Active Directory, Jira & Confluence Cloud",
    "Description": "IT service desk, incident response, CMDB configuration management, and change approvals."
  },
  {
    "Application Name": "Custom C# WinForms POS",
    "Department": "Retail Operations",
    "Business Criticality": "High",
    "Annual Maintenance Cost": 340000,
    "Architecture Health": "High Tech Debt",
    "Hosting": "On-Premises Store PCs",
    "Tech Stack": ".NET Framework 3.5, C#, SQL Server Express",
    "Cloud Readiness": "Monolith Heavy",
    "Active Users": 850,
    "Vendor": "In-House",
    "Dependencies": "Legacy AS400 Core Banking",
    "Description": "In-store desktop point-of-sale software requiring manual onsite updates across 120 retail branches."
  },
  {
    "Application Name": "CyberArk Privileged Access Vault",
    "Department": "IT Security",
    "Business Criticality": "Mission Critical",
    "Annual Maintenance Cost": 210000,
    "Architecture Health": "Modern",
    "Hosting": "Hybrid Cloud",
    "Tech Stack": "CyberArk EPV, Vault Protocol, REST API",
    "Cloud Readiness": "Cloud Ready",
    "Active Users": 350,
    "Vendor": "CyberArk",
    "Dependencies": "Active Directory",
    "Description": "Enterprise credential rotation, SSH key management, and zero-trust privileged account access enforcement."
  },
  {
    "Application Name": "Legacy Perl Report Generator",
    "Department": "Finance & Accounting",
    "Business Criticality": "Low",
    "Annual Maintenance Cost": 75000,
    "Architecture Health": "EOL & Fragile",
    "Hosting": "Linux Server",
    "Tech Stack": "Perl 5.10, Flat Files, Cron",
    "Cloud Readiness": "Legacy Incompatible",
    "Active Users": 4,
    "Vendor": "In-House",
    "Dependencies": "Legacy AS400 Core Banking, SAP S/4HANA Finance",
    "Description": "Nightly reconciliation script written by a former employee in 2006. Unmaintained and breaks on leap years."
  },
  {
    "Application Name": "Datadog Cloud Observability",
    "Department": "Engineering",
    "Business Criticality": "High",
    "Annual Maintenance Cost": 290000,
    "Architecture Health": "Modern SaaS",
    "Hosting": "SaaS",
    "Tech Stack": "Datadog Agent, OpenTelemetry, APM",
    "Cloud Readiness": "Cloud Native",
    "Active Users": 450,
    "Vendor": "Datadog",
    "Dependencies": "Custom Python Microservices, AWS Cloud Infrastructure",
    "Description": "Unified distributed tracing, synthetic checks, log aggregation, and real-time infrastructure alerting."
  },
  {
    "Application Name": "Active Directory & Entra ID",
    "Department": "IT Infrastructure",
    "Business Criticality": "Mission Critical",
    "Annual Maintenance Cost": 180000,
    "Architecture Health": "Modern",
    "Hosting": "Hybrid Cloud",
    "Tech Stack": "SAML 2.0, OIDC, Kerberos, Azure AD",
    "Cloud Readiness": "Cloud Native",
    "Active Users": 5800,
    "Vendor": "Microsoft",
    "Dependencies": "None",
    "Description": "Master identity and access management system providing Single Sign-On (SSO) and RBAC for all apps."
  },
  {
    "Application Name": "Informatica PowerCenter ETL",
    "Department": "Data Architecture",
    "Business Criticality": "High",
    "Annual Maintenance Cost": 520000,
    "Architecture Health": "High Tech Debt",
    "Hosting": "On-Premises VM",
    "Tech Stack": "Informatica Server 9.6, Oracle Repository",
    "Cloud Readiness": "Monolith Heavy",
    "Active Users": 45,
    "Vendor": "Informatica",
    "Dependencies": "Oracle E-Business Suite 11i, Snowflake Data Warehouse",
    "Description": "On-premises enterprise ETL pipeline with high annual licensing and complex batch dependencies that frequently block data lake updates."
  }
];

const sampleDir = path.join(__dirname, '..', 'sampleData');
if (!fs.existsSync(sampleDir)) {
  fs.mkdirSync(sampleDir, { recursive: true });
}

const worksheet = XLSX.utils.json_to_sheet(sampleApplications);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, "Application Portfolio");

// Set column widths
worksheet['!cols'] = [
  { wch: 30 }, // Application Name
  { wch: 25 }, // Department
  { wch: 20 }, // Business Criticality
  { wch: 24 }, // Annual Maintenance Cost
  { wch: 20 }, // Architecture Health
  { wch: 25 }, // Hosting
  { wch: 35 }, // Tech Stack
  { wch: 22 }, // Cloud Readiness
  { wch: 15 }, // Active Users
  { wch: 20 }, // Vendor
  { wch: 35 }, // Dependencies
  { wch: 60 }  // Description
];

const filePath = path.join(sampleDir, 'enterprise_application_stack.xlsx');
XLSX.writeFile(workbook, filePath);
console.log(`Sample Excel created at: ${filePath}`);
