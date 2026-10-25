const XLSX = require('xlsx');
const neo4jService = require('./neo4jService');
const llmService = require('./llmService');

const SYSTEM_PROMPT = `
You are a Principal Enterprise Architect and Application Portfolio Rationalization Expert specializing in Knowledge Graphs.
Your task is to analyze application inventory data and categorize each application into one of three strategic rationalization classifications:
1. "RETAIN": High business value, modern stack, cloud native/ready, cost-effective, mission-critical.
2. "RETIRE": Legacy, End-of-life (EOL), obsolete tech (COBOL, FoxPro, Perl, unmaintained PHP/Java/Access), duplicate capabilities, low user adoption, high security risk. Candidates for immediate decommissioning to save budget.
3. "OPTIMIZE": High business value but high maintenance cost, on-prem legacy infrastructure needing cloud migration, heavy monolithic architecture, or unoptimized enterprise software licenses.

For each application provided, extract:
- name: Exact application name
- classification: Exactly "RETAIN", "RETIRE", or "OPTIMIZE"
- rationale: 2-3 sentences explaining the architectural and business justification for the decision
- actionPlan: Concrete next steps (e.g., "Decommission within 6 months, migrate DB to warehouse", "Re-platform to AWS container service", "Continue enhancement")
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

Respond STRICTLY in valid JSON matching this schema:
{
  "applications": [
    { ... }
  ]
}
`.trim();

/**
 * Parse uploaded Excel or CSV buffer
 */
function parseExcelBuffer(buffer) {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
  return { sheetName: firstSheetName, rows };
}

/**
 * Initialize baseline classification nodes
 */
async function initializeClassificationNodes(config) {
  const cypher = `
    MERGE (r:Classification {name: 'RETAIN'})
    SET r.color = '#10b981',
        r.description = 'Modern, high-value strategic systems to keep and scale'

    MERGE (ret:Classification {name: 'RETIRE'})
    SET ret.color = '#ef4444',
        ret.description = 'Legacy, end-of-life, redundant systems targeted for decommissioning'

    MERGE (opt:Classification {name: 'OPTIMIZE'})
    SET opt.color = '#f59e0b',
        opt.description = 'High-cost systems requiring cloud re-platforming or license consolidation'
  `;
  await neo4jService.executeCypher(cypher, {}, config);
}

/**
 * Ingest classified applications into Neo4j
 */
async function ingestApplicationsToNeo4j(analyzedApps, config) {
  const { driver, database } = neo4jService.getDriver(config);
  const session = driver.session({ database });

  try {
    for (const app of analyzedApps) {
      // 1. Create Application and Classification link
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
        MERGE (a)-[:HOSTED_ON]->(plat:Platform {name: $hosting})

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

      // 2. Link Technologies
      if (Array.isArray(app.technologies) && app.technologies.length > 0) {
        for (const tech of app.technologies) {
          if (!tech.name) continue;
          await session.run(`
            MATCH (a:Application {name: $appName})
            MERGE (t:Technology {name: $techName})
            SET t.isLegacy = $isLegacy
            MERGE (a)-[:USES_TECH]->(t)
          `, {
            appName: app.name,
            techName: typeof tech === 'string' ? tech : tech.name,
            isLegacy: Boolean(tech.isLegacy)
          });
        }
      }

      // 3. Link Dependencies
      if (Array.isArray(app.dependencies) && app.dependencies.length > 0) {
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
 * Main Orchestration Pipeline (neo4j-graph-builder model)
 */
async function buildGraphFromExcel({ fileBuffer, rows, llmConfig = {}, neo4jConfig = {}, onProgress = () => {} }) {
  const logs = [];
  const addLog = (stage, message, meta = {}) => {
    const entry = { stage, message, time: new Date().toISOString(), ...meta };
    logs.push(entry);
    onProgress(entry);
  };

  addLog('PARSE', 'Reading and validating spreadsheet data...');
  let parsedRows = rows;
  if (fileBuffer) {
    const parsed = parseExcelBuffer(fileBuffer);
    parsedRows = parsed.rows;
  }

  if (!parsedRows || parsedRows.length === 0) {
    throw new Error('Spreadsheet is empty or contains no parseable rows.');
  }

  addLog('PARSE', `Discovered ${parsedRows.length} application rows in spreadsheet.`);

  // Prepare chunks for LLM processing
  const chunkSize = 5;
  const chunks = [];
  for (let i = 0; i < parsedRows.length; i += chunkSize) {
    chunks.push(parsedRows.slice(i, i + chunkSize));
  }

  addLog('INIT_NEO4J', 'Initializing Neo4j schema constraints and strategic classification labels...');
  try {
    await neo4jService.initConstraints(neo4jConfig);
    await initializeClassificationNodes(neo4jConfig);
  } catch (err) {
    addLog('NOTICE', 'Neo4j Desktop is offline or starting; skipping DBMS constraint registration.');
  }

  const allAnalyzedApps = [];
  const hasLlmKey = (llmConfig.provider === 'azure' && (llmConfig.azureApiKey || process.env.AZURE_OPENAI_API_KEY)) ||
                     (llmConfig.provider === 'gemini' && (llmConfig.geminiApiKey || process.env.GEMINI_API_KEY));

  addLog('LLM_EXTRACTION', `Starting LLM Knowledge Graph extraction using ${hasLlmKey ? llmConfig.provider.toUpperCase() : 'Architectural Knowledge Engine'}...`);

  for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
    const chunk = chunks[cIdx];
    addLog('LLM_EXTRACTION', `Processing batch ${cIdx + 1}/${chunks.length} (${chunk.length} applications)...`);

    if (hasLlmKey) {
      try {
        const userPrompt = `Analyze the following application inventory batch and classify into RETAIN, RETIRE, or OPTIMIZE:\n\n${JSON.stringify(chunk, null, 2)}`;
        const result = await llmService.generateCompletion({
          systemPrompt: SYSTEM_PROMPT,
          userPrompt,
          temperature: 0.1,
          jsonMode: true,
          config: llmConfig
        });

        if (result && Array.isArray(result.applications)) {
          allAnalyzedApps.push(...result.applications);
        } else {
          // Fallback if LLM output format had slight deviation
          const fallback = llmService.heuristicApplicationAnalysis(chunk);
          allAnalyzedApps.push(...fallback);
        }
      } catch (err) {
        addLog('WARNING', `LLM call encountered notice: ${err.message}. Applied architectural expert classifier.`);
        const fallback = llmService.heuristicApplicationAnalysis(chunk);
        allAnalyzedApps.push(...fallback);
      }
    } else {
      // Direct heuristic analysis
      const analyzed = llmService.heuristicApplicationAnalysis(chunk);
      allAnalyzedApps.push(...analyzed);
    }
  }

  // Always save in memory store for instant preview & fallback
  neo4jService.saveToInMemoryStore(allAnalyzedApps);

  addLog('GRAPH_INGEST', `Injecting ${allAnalyzedApps.length} applications and relationships into Neo4j graph database...`);
  try {
    await ingestApplicationsToNeo4j(allAnalyzedApps, neo4jConfig);
    addLog('NEO4J_PERSIST', `Persisted ${allAnalyzedApps.length} applications into Neo4j Desktop DBMS.`);
  } catch (neoErr) {
    addLog('NOTICE', `Neo4j Desktop is currently offline or unreachable (${neoErr.message}). Applications loaded into active Memory Preview.`);
  }

  addLog('GRAPH_STATS', 'Computing graph statistics and rationalization metrics...');
  const stats = await neo4jService.getGraphStats(neo4jConfig);
  const graphData = await neo4jService.getGraphData(300, neo4jConfig);

  addLog('COMPLETE', `Graph construction complete! ${stats.totalApps} applications mapped (${stats.retainCount} Retain, ${stats.retireCount} Retire, ${stats.optimizeCount} Optimize).`);

  return {
    success: true,
    totalProcessed: allAnalyzedApps.length,
    stats,
    graphData,
    logs,
    applications: allAnalyzedApps
  };
}

module.exports = {
  buildGraphFromExcel,
  parseExcelBuffer
};
