const XLSX = require('xlsx');
const path = require('path');
const fs = require('fs');

const sampleDir = path.join(__dirname, '..', 'sampleData');
if (!fs.existsSync(sampleDir)) {
  fs.mkdirSync(sampleDir, { recursive: true });
}

// 1. DATASET 1: Enterprise Application Stack (IT Portfolio Rationalization)
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
  }
];

const wsApps = XLSX.utils.json_to_sheet(sampleApplications);
const wbApps = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbApps, wsApps, "Applications");
XLSX.writeFile(wbApps, path.join(sampleDir, 'enterprise_application_stack.xlsx'));

// 2. DATASET 2: Global Supply Chain & Logistics (Universal Knowledge Graph)
const sampleSupplyChain = [
  {
    "Part ID": "PRT-101",
    "Part Name": "Lithium Battery Pack 75kWh",
    "Category": "Power & Energy",
    "Supplier": "Panasonic Energy",
    "Supplier Country": "Japan",
    "Factory": "Fremont Gigafactory",
    "Factory City": "Fremont, CA",
    "Target Warehouse": "Northwest Distribution Hub",
    "Warehouse State": "Washington",
    "Carrier": "Maersk Logistics",
    "Unit Cost": 4500,
    "Lead Time Days": 21,
    "Shipment Status": "In Transit"
  },
  {
    "Part ID": "PRT-102",
    "Part Name": "NVIDIA Drive Orin AI Chip",
    "Category": "Semiconductors",
    "Supplier": "TSMC",
    "Supplier Country": "Taiwan",
    "Factory": "Austin Assembly Plant",
    "Factory City": "Austin, TX",
    "Target Warehouse": "Central Texas Depot",
    "Warehouse State": "Texas",
    "Carrier": "FedEx Express",
    "Unit Cost": 1200,
    "Lead Time Days": 14,
    "Shipment Status": "Delivered"
  },
  {
    "Part ID": "PRT-103",
    "Part Name": "Carbon Ceramic Brake Discs",
    "Category": "Braking Systems",
    "Supplier": "Brembo SpA",
    "Supplier Country": "Italy",
    "Factory": "Fremont Gigafactory",
    "Factory City": "Fremont, CA",
    "Target Warehouse": "Pacific Coast Hub",
    "Warehouse State": "California",
    "Carrier": "DHL Global Forwarding",
    "Unit Cost": 850,
    "Lead Time Days": 18,
    "Shipment Status": "Customs Hold"
  },
  {
    "Part ID": "PRT-104",
    "Part Name": "Automotive OLED Cockpit Display",
    "Category": "Electronics",
    "Supplier": "LG Display",
    "Supplier Country": "South Korea",
    "Factory": "Berlin EV Facility",
    "Factory City": "Gruenheide",
    "Target Warehouse": "European Central Warehouse",
    "Warehouse State": "Germany",
    "Carrier": "Kuehne + Nagel",
    "Unit Cost": 620,
    "Lead Time Days": 12,
    "Shipment Status": "Delivered"
  },
  {
    "Part ID": "PRT-105",
    "Part Name": "Electric Powertrain Inverter",
    "Category": "Powertrain",
    "Supplier": "Bosch Mobility",
    "Supplier Country": "Germany",
    "Factory": "Austin Assembly Plant",
    "Factory City": "Austin, TX",
    "Target Warehouse": "Central Texas Depot",
    "Warehouse State": "Texas",
    "Carrier": "UPS Supply Chain",
    "Unit Cost": 980,
    "Lead Time Days": 15,
    "Shipment Status": "In Transit"
  },
  {
    "Part ID": "PRT-106",
    "Part Name": "Lightweight Aluminum Chassis Subframe",
    "Category": "Structural",
    "Supplier": "Alcoa Corporation",
    "Supplier Country": "United States",
    "Factory": "Fremont Gigafactory",
    "Factory City": "Fremont, CA",
    "Target Warehouse": "Pacific Coast Hub",
    "Warehouse State": "California",
    "Carrier": "Schneider National",
    "Unit Cost": 1400,
    "Lead Time Days": 7,
    "Shipment Status": "Delivered"
  }
];

const wsSupply = XLSX.utils.json_to_sheet(sampleSupplyChain);
const wbSupply = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbSupply, wsSupply, "SupplyChain");
XLSX.writeFile(wbSupply, path.join(sampleDir, 'supply_chain_logistics.xlsx'));

// 3. DATASET 3: Healthcare Clinical Patient & Treatment Network (Universal Knowledge Graph)
const sampleHealthcare = [
  {
    "Patient ID": "PAT-901",
    "Patient Name": "Sarah Jenkins",
    "Age": 54,
    "Gender": "Female",
    "Attending Physician": "Dr. Emily Chen, MD",
    "Specialty": "Cardiology",
    "Hospital": "Mayo Clinic",
    "Hospital City": "Rochester, MN",
    "Primary Diagnosis": "Hypertensive Heart Disease",
    "Prescribed Medication": "Lisinopril 20mg",
    "Treatment Protocol": "Angiotensin Inhibitor Therapy",
    "Clinical Outcome": "Stable"
  },
  {
    "Patient ID": "PAT-902",
    "Patient Name": "Michael Rossi",
    "Age": 68,
    "Gender": "Male",
    "Attending Physician": "Dr. Robert Vance, MD",
    "Specialty": "Oncology",
    "Hospital": "Memorial Sloan Kettering",
    "Hospital City": "New York, NY",
    "Primary Diagnosis": "Non-Small Cell Lung Carcinoma",
    "Prescribed Medication": "Pembrolizumab (Keytruda)",
    "Treatment Protocol": "Immune Checkpoint Inhibitor",
    "Clinical Outcome": "Partial Remission"
  },
  {
    "Patient ID": "PAT-903",
    "Patient Name": "Elena Rostova",
    "Age": 38,
    "Gender": "Female",
    "Attending Physician": "Dr. Anita Patel, MD",
    "Specialty": "Neurology",
    "Hospital": "Johns Hopkins Hospital",
    "Hospital City": "Baltimore, MD",
    "Primary Diagnosis": "Relapsing-Remitting Multiple Sclerosis",
    "Prescribed Medication": "Ocrelizumab (Ocrevus)",
    "Treatment Protocol": "B-cell Depletion Infusion",
    "Clinical Outcome": "Symptom Controlled"
  },
  {
    "Patient ID": "PAT-904",
    "Patient Name": "David Thompson",
    "Age": 61,
    "Gender": "Male",
    "Attending Physician": "Dr. Emily Chen, MD",
    "Specialty": "Cardiology",
    "Hospital": "Mayo Clinic",
    "Hospital City": "Rochester, MN",
    "Primary Diagnosis": "Coronary Artery Atherosclerosis",
    "Prescribed Medication": "Atorvastatin 40mg",
    "Treatment Protocol": "Percutaneous Coronary Intervention",
    "Clinical Outcome": "Recovered"
  }
];

const wsHealth = XLSX.utils.json_to_sheet(sampleHealthcare);
const wbHealth = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wbHealth, wsHealth, "Healthcare");
XLSX.writeFile(wbHealth, path.join(sampleDir, 'healthcare_clinical_network.xlsx'));

console.log("Generated sample datasets: Applications, Supply Chain, Healthcare");
