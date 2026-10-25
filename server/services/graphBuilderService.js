const XLSX = require('xlsx');
const neo4jService = require('./neo4jService');
const llmService = require('./llmService');

// 1. PROMPT FOR APPLICATION PORTFOLIO RATIONALIZATION
const APP_RATIONALIZATION_PROMPT = `
You are a Principal Enterprise Architect and Application Portfolio Rationalization Expert specializing in Knowledge Graphs.
Your task is to analyze application inventory data and categorize each application into one of three strategic rationalization classifications:
1. "RETAIN": High business value, modern stack, cloud native/ready, cost-effective, mission-critical.
2. "RETIRE": Legacy, End-of-life (EOL), obsolete tech (COBOL, FoxPro, Perl, unmaintained PHP/Java/Access), duplicate capabilities, low user adoption, high security risk. Candidates for immediate decommissioning to save budget.
3. "OPTIMIZE": High business value but high maintenance cost, on-prem legacy infrastructure needing cloud migration, heavy monolithic architecture, or unoptimized enterprise software licenses.

For each application provided, extract:
- name: Exact application name
- classification: Exactly "RETAIN", "RETIRE", or "OPTIMIZE"
- rationale: 2-3 sentences explaining the architectural and business justification for the decision
- actionPlan: Concrete next steps
- confidence: Score between 0.70 and 0.99
- annualCost: numeric annual cost in USD
- businessCriticality: "Mission Critical", "High", "Medium", or "Low"
- architectureHealth: "Modern", "Stable", "High Tech Debt", or "EOL & Fragile"
- cloudReadiness: "Cloud Native", "Cloud Ready", "Monolith Heavy", or "Legacy Incompatible"
- activeUsers: numeric user count
- department: department or business unit name
- vendor: software provider or "In-House"
- hosting: "Azure Cloud", "AWS Cloud", "On-Premises Mainframe", "SaaS", "Hybrid", etc.
- description: summary of application function
- technologies: list of objects [{ "name": "...", "isLegacy": boolean }]
- dependencies: list of application names it depends on

Respond STRICTLY in valid JSON:
{ "applications": [ { ... } ] }
`.trim();

// 2. PROMPT FOR UNIVERSAL KNOWLEDGE GRAPH EXTRACTION (ANY EXCEL SHEET)
const UNIVERSAL_GRAPH_PROMPT = `
You are an Advanced Universal Knowledge Graph Builder (identical to Neo4j LLM Graph Builder).
Your task is to analyze arbitrary tabular records from ANY domain (Supply Chain, Healthcare, HR, Sales, E-Commerce, Logistics, etc.) and extract real-world Entity Nodes and Semantic Directed Relationships.

Rules:
1. Identify distinct Real-World Entities (Nodes):
   - id: Unique clean string identifier (e.g. "Part_PRT101", "Supplier_Panasonic", "Doctor_EmilyChen", "Patient_SarahJenkins")
   - label: TitleCase entity type (e.g. "Part", "Supplier", "Factory", "Warehouse", "Patient", "Doctor", "Hospital", "Diagnosis", "Medication", "Customer", "Order")
   - name: Clear display name
   - properties: Clean object of all descriptive properties from the row
2. Identify Meaningful Semantic Relationships connecting these entities:
   - from: Source node id
   - fromLabel: Source node label
   - to: Target node id
   - toLabel: Target node label
   - type: UPPERCASE_SNAKE_CASE verb (e.g. "SUPPLIED_BY", "SHIPPED_TO", "MANUFACTURED_AT", "DIAGNOSED_WITH", "TREATED_BY", "WORKS_AT", "CONTAINS", "PURCHASED")
   - properties: Edge metadata (date, cost, status, days, dose, etc.)

Respond STRICTLY in valid JSON:
{
  "nodes": [
    { "id": "...", "label": "...", "name": "...", "properties": { ... } }
  ],
  "relationships": [
    { "from": "...", "fromLabel": "...", "to": "...", "toLabel": "...", "type": "...", "properties": { ... } }
  ]
}
`.trim();

/**
 * Parse Excel or CSV buffer
 */
function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return { sheetName: firstSheetName, rows };
}

/**
 * Detect spreadsheet type: 'application' vs 'universal'
 */
function detectSpreadsheetDomain(rows) {
  if (!rows || rows.length === 0) return 'universal';
  const firstRow = rows[0];
  const keys = Object.keys(firstRow).map(k => k.toLowerCase());

  const appIndicators = ['application', 'app name', 'tech stack', 'architecture health', 'cloud readiness', 'criticality'];
  const matchCount = appIndicators.filter(ind => keys.some(k => k.includes(ind))).length;

  return matchCount >= 2 ? 'application' : 'universal';
}

/**
 * Universal Rule-Based Heuristic Parser (fallback if no LLM key provided)
 */
function heuristicUniversalParser(rows) {
  const nodesMap = new Map();
  const edgesMap = new Map();

  rows.forEach((row, rowIdx) => {
    const keys = Object.keys(row);
    if (keys.length === 0) return;

    // Pick primary key / entity (first non-empty column)
    const primaryKey = keys[0];
    const primaryVal = String(row[primaryKey] || `Row_${rowIdx + 1}`).trim();
    const primaryCleanLabel = primaryKey.replace(/[^a-zA-Z]/g, '') || 'Item';
    const primaryId = `${primaryCleanLabel}_${primaryVal.replace(/[^a-zA-Z0-9]/g, '_')}`;

    if (!nodesMap.has(primaryId)) {
      nodesMap.set(primaryId, {
        id: primaryId,
        label: primaryCleanLabel,
        name: primaryVal,
        category: primaryCleanLabel,
        properties: { ...row }
      });
    }

    // Inspect other columns to find entity connections
    keys.slice(1).forEach(colKey => {
      const val = row[colKey];
      if (val === null || val === undefined || val === '') return;

      const strVal = String(val).trim();
      const numVal = Number(strVal);

      // If text string and not purely numeric, treat as related entity node!
      if (isNaN(numVal) && strVal.length > 1 && strVal.length < 50) {
        const entityLabel = colKey.replace(/[^a-zA-Z]/g, '') || 'Category';
        const entityId = `${entityLabel}_${strVal.replace(/[^a-zA-Z0-9]/g, '_')}`;

        if (!nodesMap.has(entityId)) {
          nodesMap.set(entityId, {
            id: entityId,
            label: entityLabel,
            name: strVal,
            category: entityLabel,
            properties: { name: strVal }
          });
        }

        // Derive semantic relationship name from column header
        let relType = `HAS_${entityLabel.toUpperCase()}`;
        const lowerKey = colKey.toLowerCase();
        if (lowerKey.includes('supplier')) relType = 'SUPPLIED_BY';
        else if (lowerKey.includes('factory')) relType = 'MANUFACTURED_AT';
        else if (lowerKey.includes('warehouse')) relType = 'STORED_IN';
        else if (lowerKey.includes('carrier')) relType = 'SHIPPED_VIA';
        else if (lowerKey.includes('doctor') || lowerKey.includes('physician')) relType = 'TREATED_BY';
        else if (lowerKey.includes('hospital')) relType = 'ADMITTED_TO';
        else if (lowerKey.includes('diagnosis')) relType = 'DIAGNOSED_WITH';
        else if (lowerKey.includes('medication')) relType = 'PRESCRIBED';
        else if (lowerKey.includes('department')) relType = 'OWNED_BY';

        const edgeId = `${primaryId}_${relType}_${entityId}`;
        if (!edgesMap.has(edgeId)) {
          edgesMap.set(edgeId, {
            id: edgeId,
            from: primaryId,
            fromLabel: primaryCleanLabel,
            to: entityId,
            toLabel: entityLabel,
            label: relType,
            properties: {}
          });
        }
      }
    });
  });

  return {
    nodes: Array.from(nodesMap.values()),
    relationships: Array.from(edgesMap.values())
  };
}

/**
 * Universal Neo4j Ingestion (Ingests ANY dynamic labels and relationships)
 */
async function ingestUniversalToNeo4j(nodes, relationships, config) {
  const { driver, database } = neo4jService.getDriver(config);
  const session = driver.session({ database });

  try {
    // 1. Ingest all Nodes
    for (const node of nodes) {
      const safeLabel = (node.label || 'Entity').replace(/[^a-zA-Z0-9_]/g, '');
      const cypher = `
        MERGE (n:\`${safeLabel}\` {id: $id})
        SET n.name = $name,
            n += $props
      `;
      await session.run(cypher, {
        id: node.id,
        name: node.name || node.label || node.id,
        props: node.properties || {}
      });
    }

    // 2. Ingest all Relationships
    for (const rel of relationships) {
      const safeType = (rel.type || 'CONNECTED_TO').replace(/[^a-zA-Z0-9_]/g, '');
      const cypher = `
        MATCH (a {id: $fromId})
        MATCH (b {id: $toId})
        MERGE (a)-[r:\`${safeType}\`]->(b)
        SET r += $props
      `;
      await session.run(cypher, {
        fromId: rel.from,
        toId: rel.to,
        props: rel.properties || {}
      });
    }

    return { success: true };
  } finally {
    await session.close();
  }
}

/**
 * Ingest classified applications into Neo4j
 */
async function ingestApplicationsToNeo4j(analyzedApps, config) {
  const { driver, database } = neo4jService.getDriver(config);
  const session = driver.session({ database });

  try {
    for (const app of analyzedApps) {
      const appCypher = `
        MERGE (a:Application {name: $name})
        SET a.annualCost = toInteger($annualCost),
            a.businessCriticality = $businessCriticality,
            a.architectureHealth = $architectureHealth,
            a.cloudReadiness = $cloudReadiness,
            a.activeUsers = toInteger($activeUsers),
            a.rationale = $rationale,
            a.actionPlan = $actionPlan,
            a.description = $description,
            a.vendor = $vendor,
            a.hosting = $hosting,
            a.department = $department,
            a.classification = $classification

        WITH a
        MERGE (c:Classification {name: $classification})
        MERGE (a)-[rClass:CLASSIFIED_AS]->(c)
        SET rClass.confidence = $confidence,
            rClass.rationale = $rationale,
            rClass.actionPlan = $actionPlan

        WITH a
        MERGE (d:Department {name: $department})
        MERGE (a)-[:OWNED_BY]->(d)

        WITH a
        MERGE (p:Platform {name: $hosting})
        MERGE (a)-[:HOSTED_ON]->(p)

        WITH a
        MERGE (v:Vendor {name: $vendor})
        MERGE (a)-[:PROVIDED_BY]->(v)
      `;

      await session.run(appCypher, {
        name: app.name,
        annualCost: app.annualCost || 0,
        businessCriticality: app.businessCriticality || 'Medium',
        architectureHealth: app.architectureHealth || 'Stable',
        cloudReadiness: app.cloudReadiness || 'Cloud Ready',
        activeUsers: app.activeUsers || 0,
        rationale: app.rationale || '',
        actionPlan: app.actionPlan || '',
        description: app.description || '',
        vendor: app.vendor || 'Unknown',
        hosting: app.hosting || 'On-Premises',
        department: app.department || 'General IT',
        classification: app.classification || 'RETAIN',
        confidence: app.confidence || 0.90
      });

      if (Array.isArray(app.technologies)) {
        for (const tech of app.technologies) {
          const tName = typeof tech === 'string' ? tech : tech.name;
          if (!tName) continue;
          await session.run(`
            MATCH (a:Application {name: $appName})
            MERGE (t:Technology {name: $techName})
            SET t.isLegacy = $isLegacy
            MERGE (a)-[:USES_TECH]->(t)
          `, {
            appName: app.name,
            techName: tName,
            isLegacy: Boolean(tech.isLegacy)
          });
        }
      }

      if (Array.isArray(app.dependencies)) {
        for (const dep of app.dependencies) {
          const depName = typeof dep === 'string' ? dep.trim() : dep.name;
          if (!depName || depName.toLowerCase() === 'none') continue;
          await session.run(`
            MATCH (a:Application {name: $appName})
            MERGE (depApp:Application {name: $depName})
            MERGE (a)-[:DEPENDS_ON]->(depApp)
          `, {
            appName: app.name,
            depName
          });
        }
      }
    }
    return { success: true, count: analyzedApps.length };
  } finally {
    await session.close();
  }
}

/**
 * Universal Multi-Domain Knowledge Graph Orchestrator
 */
async function buildGraphFromExcel({ 
  fileBuffer, 
  rows, 
  mode, // 'auto' | 'universal' | 'application'
  llmConfig = {}, 
  neo4jConfig = {}, 
  onProgress = () => {} 
}) {
  const logs = [];
  const addLog = (stage, message, meta = {}) => {
    const entry = { stage, message, time: new Date().toISOString(), ...meta };
    logs.push(entry);
    onProgress(entry);
  };

  addLog('PARSE', 'Reading spreadsheet workbook and parsing tabular structure...');
  let parsedRows = rows;
  if (fileBuffer) {
    const parsed = parseExcelBuffer(fileBuffer);
    parsedRows = parsed.rows;
  }

  if (!parsedRows || parsedRows.length === 0) {
    throw new Error('Spreadsheet is empty or contains no parseable rows.');
  }

  // Determine mode
  const detectedDomain = mode && mode !== 'auto' ? mode : detectSpreadsheetDomain(parsedRows);
  const isApplicationMode = detectedDomain === 'application';

  addLog('DOMAIN_DETECT', `Identified spreadsheet type: ${isApplicationMode ? 'Application Portfolio Rationalization' : 'Universal Knowledge Graph (Any Domain)'}.`);
  addLog('PARSE', `Discovered ${parsedRows.length} data records across ${Object.keys(parsedRows[0] || {}).length} columns.`);

  const hasLlmKey = (llmConfig.provider === 'azure' && (llmConfig.azureApiKey || process.env.AZURE_OPENAI_API_KEY)) ||
                     (llmConfig.provider === 'gemini' && (llmConfig.geminiApiKey || process.env.GEMINI_API_KEY));

  // ==========================================
  // CASE A: Universal Mode (Any Spreadsheet!)
  // ==========================================
  if (!isApplicationMode) {
    addLog('LLM_EXTRACTION', `Starting Universal Graph Entity & Relationship Extraction using ${hasLlmKey ? llmConfig.provider.toUpperCase() : 'Universal Schema Extractor'}...`);
    
    let allNodes = [];
    let allRelationships = [];

    if (hasLlmKey) {
      try {
        const chunkSize = 6;
        for (let i = 0; i < parsedRows.length; i += chunkSize) {
          const chunk = parsedRows.slice(i, i + chunkSize);
          addLog('LLM_EXTRACTION', `Extracting entities & relations for records ${i + 1} to ${Math.min(i + chunkSize, parsedRows.length)}...`);

          const result = await llmService.generateCompletion({
            systemPrompt: UNIVERSAL_GRAPH_PROMPT,
            userPrompt: `Extract knowledge graph nodes and relationships from this data batch:\n\n${JSON.stringify(chunk, null, 2)}`,
            temperature: 0.1,
            jsonMode: true,
            config: llmConfig
          });

          if (result && Array.isArray(result.nodes)) {
            allNodes.push(...result.nodes);
          }
          if (result && Array.isArray(result.relationships)) {
            allRelationships.push(...result.relationships);
          }
        }
      } catch (err) {
        addLog('WARNING', `LLM notice (${err.message}). Applied Universal Schema Extractor.`);
      }
    }

    // Fallback if LLM empty or not configured
    if (allNodes.length === 0) {
      addLog('SCHEMA_ENGINE', 'Analyzing column topology and linking entity nodes...');
      const heuristic = heuristicUniversalParser(parsedRows);
      allNodes = heuristic.nodes;
      allRelationships = heuristic.relationships;
    }

    // Format nodes for Vis Network
    const formattedNodes = allNodes.map(n => ({
      id: n.id,
      label: n.name || n.label || n.id,
      category: n.label || 'Entity',
      properties: n.properties || {}
    }));

    const formattedEdges = allRelationships.map(r => ({
      id: `${r.from}_${r.type}_${r.to}`,
      from: r.from,
      to: r.to,
      label: r.type,
      properties: r.properties || {}
    }));

    // Save in Universal Memory Store
    neo4jService.saveUniversalGraph({
      nodes: formattedNodes,
      edges: formattedEdges,
      rawRows: parsedRows
    });

    addLog('GRAPH_INGEST', `Injecting ${formattedNodes.length} nodes and ${formattedEdges.length} semantic relationships into Neo4j...`);
    try {
      await ingestUniversalToNeo4j(allNodes, allRelationships, neo4jConfig);
      addLog('NEO4J_PERSIST', `Persisted graph directly into Neo4j Desktop DBMS.`);
    } catch (neoErr) {
      addLog('NOTICE', `Neo4j Desktop is offline (${neoErr.message}). Graph loaded into active Memory Preview.`);
    }

    const stats = await neo4jService.getGraphStats(neo4jConfig);
    const graphData = await neo4jService.getGraphData(400, neo4jConfig);

    addLog('COMPLETE', `Universal Knowledge Graph built successfully! Mapped ${stats.totalNodes || formattedNodes.length} nodes across ${stats.labels?.length || 'multiple'} entity categories.`);

    return {
      success: true,
      mode: 'universal',
      totalProcessed: parsedRows.length,
      stats,
      graphData,
      logs
    };
  }

  // ==========================================
  // CASE B: Application Rationalization Mode
  // ==========================================
  addLog('INIT_NEO4J', 'Initializing Application Portfolio schema constraints...');
  try {
    await neo4jService.initConstraints(neo4jConfig);
  } catch (err) {}

  const chunkSize = 5;
  const chunks = [];
  for (let i = 0; i < parsedRows.length; i += chunkSize) {
    chunks.push(parsedRows.slice(i, i + chunkSize));
  }

  const allAnalyzedApps = [];
  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    addLog('LLM_EXTRACTION', `Classifying application stack batch ${cIdx + 1}/${chunks.length}...`);

    if (hasLlmKey) {
      try {
        const userPrompt = `Classify this application inventory batch into RETAIN, RETIRE, or OPTIMIZE:\n\n${JSON.stringify(chunk, null, 2)}`;
        const result = await llmService.generateCompletion({
          systemPrompt: APP_RATIONALIZATION_PROMPT,
          userPrompt,
          temperature: 0.1,
          jsonMode: true,
          config: llmConfig
        });

        if (result && Array.isArray(result.applications)) {
          allAnalyzedApps.push(...result.applications);
        } else {
          allAnalyzedApps.push(...llmService.heuristicApplicationAnalysis(chunk));
        }
      } catch (err) {
        allAnalyzedApps.push(...llmService.heuristicApplicationAnalysis(chunk));
      }
    } else {
      allAnalyzedApps.push(...llmService.heuristicApplicationAnalysis(chunk));
    }
  }

  neo4jService.saveToInMemoryStore(allAnalyzedApps);

  addLog('GRAPH_INGEST', `Injecting ${allAnalyzedApps.length} applications and relationships into Neo4j graph database...`);
  try {
    await ingestApplicationsToNeo4j(allAnalyzedApps, neo4jConfig);
    addLog('NEO4J_PERSIST', `Persisted ${allAnalyzedApps.length} applications into Neo4j Desktop DBMS.`);
  } catch (neoErr) {
    addLog('NOTICE', `Neo4j Desktop is currently offline (${neoErr.message}). Loaded into active Memory Preview.`);
  }

  const stats = await neo4jService.getGraphStats(neo4jConfig);
  const graphData = await neo4jService.getGraphData(400, neo4jConfig);

  addLog('COMPLETE', `Application Portfolio Graph complete! ${stats.totalApps} applications mapped (${stats.retainCount} Retain, ${stats.retireCount} Retire, ${stats.optimizeCount} Optimize).`);

  return {
    success: true,
    mode: 'application',
    totalProcessed: allAnalyzedApps.length,
    stats,
    graphData,
    logs,
    applications: allAnalyzedApps
  };
}

module.exports = {
  buildGraphFromExcel,
  parseExcelBuffer,
  detectSpreadsheetDomain
};
