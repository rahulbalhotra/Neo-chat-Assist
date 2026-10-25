const neo4jService = require('./neo4jService');
const llmService = require('./llmService');

/**
 * Build dynamic schema prompt based on actual Neo4j / In-Memory database content
 */
async function buildDynamicCypherPrompt(neo4jConfig) {
  let labels = ['Application', 'Classification', 'Department', 'Technology', 'Platform', 'Vendor'];
  let relationships = ['CLASSIFIED_AS', 'OWNED_BY', 'USES_TECH', 'HOSTED_ON', 'PROVIDED_BY', 'DEPENDS_ON'];
  let sampleProps = '';

  try {
    const schema = await neo4jService.getSchema(neo4jConfig);
    if (schema.labels && schema.labels.length > 0) labels = schema.labels;
    if (schema.relationships && schema.relationships.length > 0) relationships = schema.relationships;
  } catch (err) {}

  const hasApplication = labels.includes('Application');
  const hasEntity = labels.includes('Entity') || labels.includes('Chunk');

  let domainContext = '';
  if (hasApplication) {
    domainContext += `
- (:Application {name: string, annualCost: integer, businessCriticality: string, architectureHealth: string, cloudReadiness: string, activeUsers: integer, rationale: string, actionPlan: string, department: string, classification: string})
- (:Classification {name: "RETAIN"|"RETIRE"|"OPTIMIZE"})
- (:Department {name: string}), (:Technology {name: string}), (:Platform {name: string}), (:Vendor {name: string})
Relationships: (:Application)-[:CLASSIFIED_AS]->(:Classification), (:Application)-[:OWNED_BY]->(:Department), (:Application)-[:USES_TECH]->(:Technology), (:Application)-[:HOSTED_ON]->(:Platform), (:Application)-[:DEPENDS_ON]->(:Application)
`;
  }
  if (hasEntity) {
    domainContext += `
- (:Document {fileName: string, fileType: string, totalChunks: integer})
- (:Chunk {chunkId: string, chunkIndex: integer, text: string, fileName: string})
- (:Entity {name: string, type: string, description: string, sourceFile: string})
Relationships: (:Document)-[:HAS_CHUNK]->(:Chunk), (:Chunk)-[:MENTIONS]->(:Entity), (:Entity)-[:RELATED_TO]->(:Entity)
`;
  }

  return `
You are an expert Neo4j Cypher architect. Given a user question, translate it into an efficient, syntactically correct, READ-ONLY Cypher query matching the connected Knowledge Graph.

Active Graph Schema:
Node Labels: ${labels.join(', ')}
Relationship Types: ${relationships.join(', ')}
${domainContext ? `Known Graph Entities & Structure:${domainContext}` : ''}

Strict Cypher Rules:
1. ONLY generate READ-ONLY queries starting with MATCH or OPTIONAL MATCH.
2. NEVER write or mutate (NO CREATE, MERGE, SET, DELETE, REMOVE, DROP).
3. Case-Insensitive Matching: For string filters, use toLower() or regex (?i), e.g. toLower(n.name) CONTAINS toLower('...')
4. Flexible Matching: If target label is uncertain, query generic (n) or match across available labels (${labels.join('|')}).
5. Always return meaningful properties (e.g. name, type, cost, rationale, classification, connected relationships).
6. Limit to at most 25 rows (LIMIT 25) unless all records are explicitly requested.
7. Return ONLY a valid JSON object with keys "cypher" and "explanation". Do NOT output markdown backticks or any conversational text.

Output JSON Format:
{
  "cypher": "MATCH (n) WHERE toLower(n.name) CONTAINS 'finance' RETURN n LIMIT 15",
  "explanation": "Brief explanation of query intent"
}
`.trim();
}

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

  if (q.includes('document') || q.includes('chunk') || q.includes('file')) {
    return {
      cypher: `
        MATCH (d:Document)
        OPTIONAL MATCH (d)-[:HAS_CHUNK]->(c:Chunk)
        RETURN d.fileName AS document, d.fileType AS fileType, count(c) AS chunkCount
        LIMIT 20
      `.trim(),
      explanation: 'Matches uploaded documents and chunk statistics.'
    };
  }

  if (q.includes('entity') || q.includes('entities') || q.includes('cross')) {
    return {
      cypher: `
        MATCH (e:Entity)
        OPTIONAL MATCH (e)-[r:RELATED_TO]-(other:Entity)
        RETURN e.name AS entity, e.type AS type, count(r) AS connections, e.sourceFile AS file
        ORDER BY connections DESC
        LIMIT 20
      `.trim(),
      explanation: 'Finds top interconnected entities in knowledge graph.'
    };
  }

  // Universal general overview
  return {
    cypher: `
      MATCH (n)
      OPTIONAL MATCH (n)-[r]->(m)
      RETURN coalesce(n.name, n.title, n.id, labels(n)[0]) AS item, labels(n)[0] AS type, count(r) AS connections
      ORDER BY connections DESC
      LIMIT 15
    `.trim(),
    explanation: 'General graph overview returning most connected items.'
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

  // 1. Generate Cypher query with dynamic schema introspection
  if (hasLlmKey) {
    try {
      const dynamicPrompt = await buildDynamicCypherPrompt(neo4jConfig);
      const cypherRes = await llmService.generateCompletion({
        systemPrompt: dynamicPrompt,
        userPrompt: `User question: "${question}". Generate a Cypher query. Respond in JSON with keys "cypher" and "explanation".`,
        temperature: 0.0,
        jsonMode: true,
        config: llmConfig
      });
      if (cypherRes && cypherRes.cypher) {
        cypherQuery = cypherRes.cypher;
        queryExplanation = cypherRes.explanation || 'Custom generated Cypher query';
      }
    } catch (err) {
      console.warn('LLM Cypher generation warning, using semantic mapper:', err.message);
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
  let execResult = { records: [] };
  try {
    execResult = await neo4jService.executeCypher(cypherQuery, {}, neo4jConfig);
  } catch (dbErr) {
    // If custom query threw a syntax error in Neo4j, fallback to heuristic
    const heuristic = heuristicChatHandler(question);
    cypherQuery = heuristic.cypher;
    queryExplanation = heuristic.explanation;
    execResult = await neo4jService.executeCypher(cypherQuery, {}, neo4jConfig);
  }
  const records = execResult.records || [];

  // 3. Synthesize natural language answer with clean Markdown
  let answerText = '';
  let highlightApps = [];

  if (hasLlmKey && records.length > 0) {
    try {
      const synthesisPrompt = `
You are an Enterprise Knowledge Graph Advisor. You have queried the connected Neo4j database to answer the user's question.

User Question: "${question}"
Executed Cypher: ${cypherQuery}
Database Results (${records.length} records):
${JSON.stringify(records.slice(0, 20), null, 2)}

Provide a clear, professional, executive-ready response:
- Directly answer the question with specific names, metrics, relationships, and rationale from the records.
- Format cleanly using standard Markdown: '## Heading', '### Subheading', '**bold text**', '*italic text*', and clean bullet points.
- If presenting multi-field records, a concise Markdown table is recommended.
- Highlight total budget impact, counts, or key takeaways when applicable.
- STRICT FORMATTING CONSTRAINT: Do NOT use triple asterisks '***' anywhere for headings or horizontal rules. Use clean headings ('### Heading') and standard bold ('**Text**').
      `.trim();

      const synthRes = await llmService.generateCompletion({
        systemPrompt: 'You are an executive graph intelligence advisor. Respond directly with clean, structured Markdown. Do NOT use triple asterisks.',
        userPrompt: synthesisPrompt,
        temperature: 0.2,
        jsonMode: false, // Natural Markdown output prevents JSON string escaping errors
        config: llmConfig
      });

      if (synthRes && typeof synthRes === 'string') {
        answerText = synthRes.trim();
      }
    } catch (err) {
      console.warn('Synthesis warning, formatting answer directly:', err.message);
    }
  }

  // Fallback synthesis if no LLM or synthesis failed
  if (!answerText) {
    if (records.length === 0) {
      answerText = `No matching records or relationships were found in the knowledge graph for your query.\n\n*Executed Cypher:*\n\`\`\`cypher\n${cypherQuery}\n\`\`\``;
    } else {
      let totalCostSum = 0;
      records.forEach(r => {
        const c = Number(r.annualCost || r['a.annualCost'] || r.cost || 0);
        if (!isNaN(c)) totalCostSum += c;
      });

      answerText = `### Graph Query Results\n\nFound **${records.length}** records matching your query.\n\n`;
      if (totalCostSum > 0) {
        answerText += `* **Total Cumulative Annual Maintenance:** $${totalCostSum.toLocaleString()}\n\n`;
      }
      answerText += `#### Top Identified Records:\n`;
      records.slice(0, 10).forEach((r, idx) => {
        const name = r.application || r.item || r.entity || r.name || r['a.name'] || r['n.name'] || `Item ${idx+1}`;
        const cost = (r.annualCost || r['a.annualCost']) ? `$${Number(r.annualCost || r['a.annualCost']).toLocaleString()}` : '';
        const cls = r.classification || r.type || r['c.name'] || '';
        const rationale = r.rationale || r.actionPlan || r['a.rationale'] || '';
        answerText += `- **${name}** ${cls ? `\`[${cls}]\`` : ''} ${cost ? `— *${cost}/yr*` : ''}\n  ${rationale ? `> ${rationale}\n` : ''}`;
      });
    }
  }

  // Clean any stray *** artifacts from LLM output
  answerText = answerText
    .replace(/\*\*\*([^*]+)\*\*\*/g, '**$1**')
    .replace(/^\s*\*{3,}(?:\s+\*{3,})*\s*$/gm, '---')
    .replace(/\*\*\*\s*/g, '**');

  // Extract highlight entities from records
  highlightApps = Array.from(new Set(
    records.flatMap(r => [
      r.application,
      r.name,
      r.entity,
      r.item,
      r['a.name'],
      r['n.name'],
      r.a?.name,
      r.n?.name
    ]).filter(Boolean)
  )).slice(0, 8);

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
