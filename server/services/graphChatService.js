const neo4jService = require('./neo4jService');
const llmService = require('./llmService');

const CYPHER_GENERATION_PROMPT = `
You are a Neo4j Cypher expert. Given a user question about an enterprise Application Portfolio Rationalization Knowledge Graph, translate the question into an efficient, read-only Cypher query.

Graph Schema:
- (:Application {name: string, annualCost: integer, businessCriticality: string, architectureHealth: string, cloudReadiness: string, activeUsers: integer, rationale: string, actionPlan: string, department: string, classification: string})
- (:Classification {name: "RETAIN"|"RETIRE"|"OPTIMIZE", color: string, description: string})
- (:Department {name: string})
- (:Technology {name: string, isLegacy: boolean})
- (:Platform {name: string})
- (:Vendor {name: string})

Relationships:
- (:Application)-[:CLASSIFIED_AS]->(:Classification)
- (:Application)-[:OWNED_BY]->(:Department)
- (:Application)-[:USES_TECH]->(:Technology)
- (:Application)-[:HOSTED_ON]->(:Platform)
- (:Application)-[:PROVIDED_BY]->(:Vendor)
- (:Application)-[:DEPENDS_ON]->(:Application)

Rules:
1. ONLY generate READ-ONLY queries starting with MATCH or OPTIONAL MATCH.
2. NEVER generate write queries (NO CREATE, MERGE, SET, DELETE, REMOVE, DROP).
3. Always return relevant application names and attributes (e.g. annualCost, rationale, department, classification).
4. Limit results to at most 25 items unless specifically asked for all.
5. Return ONLY a JSON object in this format:
{
  "cypher": "MATCH (a:Application)-[:CLASSIFIED_AS]->(c:Classification {name: 'RETIRE'}) RETURN a.name, a.annualCost, a.rationale ORDER BY a.annualCost DESC LIMIT 10",
  "explanation": "Finds all applications classified to Retire sorted by highest annual cost"
}
`.trim();

const ANSWER_SYNTHESIS_PROMPT = `
You are an Enterprise Application Rationalization Advisor. You have queried the Neo4j Knowledge Graph to answer a user's question.

Given:
1. The User's Question
2. The Cypher query executed
3. The Graph query results (data rows)

Provide a clear, professional, executive-ready response:
- Directly answer the question with specific application names, costs, tech stacks, and rationale.
- Highlight total budget impact or savings when relevant.
- Format with clean markdown (bullet points, bold text).
- Include a list of key application names mentioned so the UI can highlight them in the interactive graph.

Return STRICTLY JSON:
{
  "answer": "markdown text answer...",
  "highlightApps": ["App 1", "App 2"]
}
`.trim();

/**
 * Rule-based fallback for common questions if LLM keys are not supplied
 */
function heuristicChatHandler(question) {
  const q = question.toLowerCase();

  if (q.includes('retire') || q.includes('decommission') || q.includes('save') || q.includes('cost reduction')) {
    return {
      cypher: `
        MATCH (a:Application)-[:CLASSIFIED_AS]->(c:Classification {name: 'RETIRE'})
        OPTIONAL MATCH (a)-[:OWNED_BY]->(d:Department)
        OPTIONAL MATCH (a)-[:USES_TECH]->(t:Technology)
        RETURN a.name AS application, a.annualCost AS annualCost, a.architectureHealth AS health, 
               a.rationale AS rationale, a.actionPlan AS actionPlan, d.name AS department, 
               collect(t.name) AS technologies
        ORDER BY a.annualCost DESC
      `.trim(),
      explanation: 'Matches all applications recommended for retirement sorted by highest annual cost savings.'
    };
  }

  if (q.includes('optimize') || q.includes('modernize') || q.includes('cloud')) {
    return {
      cypher: `
        MATCH (a:Application)-[:CLASSIFIED_AS]->(c:Classification {name: 'OPTIMIZE'})
        OPTIONAL MATCH (a)-[:OWNED_BY]->(d:Department)
        OPTIONAL MATCH (a)-[:HOSTED_ON]->(p:Platform)
        RETURN a.name AS application, a.annualCost AS annualCost, a.cloudReadiness AS cloudReadiness, 
               p.name AS hosting, a.rationale AS rationale, a.actionPlan AS actionPlan, d.name AS department
        ORDER BY a.annualCost DESC
      `.trim(),
      explanation: 'Matches all applications flagged for optimization or cloud re-platforming.'
    };
  }

  if (q.includes('retain') || q.includes('keep') || q.includes('core')) {
    return {
      cypher: `
        MATCH (a:Application)-[:CLASSIFIED_AS]->(c:Classification {name: 'RETAIN'})
        OPTIONAL MATCH (a)-[:OWNED_BY]->(d:Department)
        RETURN a.name AS application, a.annualCost AS annualCost, a.businessCriticality AS criticality, 
               a.activeUsers AS users, d.name AS department, a.rationale AS rationale
        ORDER BY a.activeUsers DESC
      `.trim(),
      explanation: 'Matches core strategic applications to retain, ranked by user adoption.'
    };
  }

  if (q.includes('legacy') || q.includes('tech debt') || q.includes('cobol') || q.includes('fragile')) {
    return {
      cypher: `
        MATCH (a:Application)-[:USES_TECH]->(t:Technology)
        WHERE t.isLegacy = true OR a.architectureHealth CONTAINS 'EOL' OR a.architectureHealth CONTAINS 'Debt'
        OPTIONAL MATCH (a)-[:CLASSIFIED_AS]->(c:Classification)
        RETURN a.name AS application, a.architectureHealth AS health, collect(t.name) AS legacyTech, 
               c.name AS classification, a.annualCost AS annualCost
        ORDER BY a.annualCost DESC
      `.trim(),
      explanation: 'Identifies applications carrying legacy technologies or severe architectural technical debt.'
    };
  }

  if (q.includes('depend') || q.includes('dependency') || q.includes('blocker')) {
    return {
      cypher: `
        MATCH (a:Application)-[r:DEPENDS_ON]->(target:Application)
        OPTIONAL MATCH (target)-[:CLASSIFIED_AS]->(targetClass:Classification)
        RETURN a.name AS application, target.name AS dependsOn, targetClass.name AS targetClassification
        LIMIT 20
      `.trim(),
      explanation: 'Maps system dependencies and highlights if dependent systems are slated for retirement.'
    };
  }

  // Default general overview
  return {
    cypher: `
      MATCH (a:Application)-[:CLASSIFIED_AS]->(c:Classification)
      OPTIONAL MATCH (a)-[:OWNED_BY]->(d:Department)
      RETURN a.name AS application, c.name AS classification, a.annualCost AS annualCost, 
             d.name AS department, a.businessCriticality AS criticality
      ORDER BY a.annualCost DESC
      LIMIT 15
    `.trim(),
    explanation: 'General portfolio query returning top applications by annual maintenance cost and strategic classification.'
  };
}

/**
 * Handle natural language chat with graph
 */
async function chatWithGraph({ question, conversationHistory = [], llmConfig = {}, neo4jConfig = {} }) {
  const hasLlmKey = (llmConfig.provider === 'azure' && (llmConfig.azureApiKey || process.env.AZURE_OPENAI_API_KEY)) ||
                     (llmConfig.provider === 'gemini' && (llmConfig.geminiApiKey || process.env.GEMINI_API_KEY));

  let cypherQuery = '';
  let queryExplanation = '';

  // 1. Generate Cypher query
  if (hasLlmKey) {
    try {
      const cypherRes = await llmService.generateCompletion({
        systemPrompt: CYPHER_GENERATION_PROMPT,
        userPrompt: `Generate Cypher query for question: "${question}"`,
        temperature: 0.0,
        jsonMode: true,
        config: llmConfig
      });
      if (cypherRes && cypherRes.cypher) {
        cypherQuery = cypherRes.cypher;
        queryExplanation = cypherRes.explanation || 'Custom generated Cypher query';
      }
    } catch (err) {
      console.warn('LLM Cypher generation notice, using semantic mapper:', err.message);
    }
  }

  // Fallback to heuristic Cypher generator if no LLM or parsing failed
  if (!cypherQuery) {
    const heuristic = heuristicChatHandler(question);
    cypherQuery = heuristic.cypher;
    queryExplanation = heuristic.explanation;
  }

  // Sanitize: ensure no write commands
  const upper = cypherQuery.toUpperCase();
  if (upper.includes('DELETE') || upper.includes('CREATE ') || upper.includes('MERGE ') || upper.includes('SET ') || upper.includes('DROP ')) {
    throw new Error('Security policy: Only read-only queries (MATCH ... RETURN) are permitted in graph chat.');
  }

  // 2. Execute Cypher in Neo4j
  const execResult = await neo4jService.executeCypher(cypherQuery, {}, neo4jConfig);
  const records = execResult.records || [];

  // 3. Synthesize natural language answer
  let answerText = '';
  let highlightApps = [];

  if (hasLlmKey && records.length > 0) {
    try {
      const synthesisPrompt = `
User Question: "${question}"
Executed Cypher: ${cypherQuery}
Data Returned:
${JSON.stringify(records.slice(0, 20), null, 2)}
      `;

      const synthRes = await llmService.generateCompletion({
        systemPrompt: ANSWER_SYNTHESIS_PROMPT,
        userPrompt: synthesisPrompt,
        temperature: 0.2,
        jsonMode: true,
        config: llmConfig
      });

      if (synthRes && synthRes.answer) {
        answerText = synthRes.answer;
        highlightApps = synthRes.highlightApps || [];
      }
    } catch (err) {
      console.warn('Synthesis notice, formatting answer directly:', err.message);
    }
  }

  // Fallback synthesis if no LLM or synthesis failed
  if (!answerText) {
    if (records.length === 0) {
      answerText = `No matching applications or relationships were found in the knowledge graph for your query.\n\n*Executed Cypher:*\n\`\`\`cypher\n${cypherQuery}\n\`\`\``;
    } else {
      highlightApps = records.map(r => r.application || r['a.name'] || (r.a && r.a.name)).filter(Boolean);
      
      let totalCostSum = 0;
      records.forEach(r => {
        const c = Number(r.annualCost || r['a.annualCost'] || 0);
        if (!isNaN(c)) totalCostSum += c;
      });

      answerText = `### Portfolio Analysis Results\n\nFound **${records.length}** records matching your query.\n\n`;
      if (totalCostSum > 0) {
        answerText += `* **Total Cumulative Annual Maintenance:** $${totalCostSum.toLocaleString()}\n\n`;
      }
      answerText += `#### Top Applications Identified:\n`;
      records.slice(0, 10).forEach((r, idx) => {
        const appName = r.application || r['a.name'] || (r.a && r.a.name) || `Item ${idx+1}`;
        const cost = r.annualCost || r['a.annualCost'] ? `$${Number(r.annualCost || r['a.annualCost']).toLocaleString()}` : '';
        const cls = r.classification || r['c.name'] || '';
        const rationale = r.rationale || r['a.rationale'] || '';
        answerText += `- **${appName}** ${cls ? `\`[${cls}]\`` : ''} ${cost ? `— *${cost}/yr*` : ''}\n  ${rationale ? `> ${rationale}\n` : ''}`;
      });
    }
  }

  return {
    question,
    answer: answerText,
    cypher: cypherQuery,
    explanation: queryExplanation,
    recordsCount: records.length,
    records: records.slice(0, 25),
    highlightApps
  };
}

module.exports = {
  chatWithGraph
};
