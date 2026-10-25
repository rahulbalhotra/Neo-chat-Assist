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

// 2. PROMPT FOR MULTI-FILE CHUNK KNOWLEDGE GRAPH EXTRACTION
const MULTI_FILE_CHUNK_PROMPT = `
You are an Advanced Multi-File Knowledge Graph Builder (similar to Neo4j LLM Graph Builder).
You are processing a Document Chunk from an uploaded file.
Your job is to:
1. Extract chunk metadata:
   - summary: 1-2 sentence description of what this chunk covers
   - keyTopics: array of 2-5 main concepts or tags (e.g. ["Inventory", "Logistics", "SAP Integration"])
2. Extract real-world Entity Nodes:
   - id: Unique clean string identifier (e.g. "Part_PRT101", "Supplier_Panasonic", "App_SAP_ERP", "Patient_SarahJenkins")
   - label: TitleCase entity type (e.g. "Part", "Supplier", "Warehouse", "Application", "Department", "Patient", "Doctor", "Technology")
   - name: Clear display name
   - properties: Clean object of all descriptive properties from the records
3. Extract meaningful Semantic Directed Relationships:
   - from: Source node id
   - fromLabel: Source node label
   - to: Target node id
   - toLabel: Target node label
   - type: UPPERCASE_SNAKE_CASE verb (e.g. "SUPPLIED_BY", "DEPENDS_ON", "USES_TECH", "HOSTED_ON", "LOCATED_IN", "TREATED_BY", "MANUFACTURED_AT")
   - properties: Edge metadata (cost, date, status, role, etc.)

Respond STRICTLY in valid JSON:
{
  "chunkMetadata": {
    "summary": "...",
    "keyTopics": ["...", "..."]
  },
  "nodes": [
    { "id": "...", "label": "...", "name": "...", "properties": { ... } }
  ],
  "relationships": [
    { "from": "...", "fromLabel": "...", "to": "...", "toLabel": "...", "type": "...", "properties": { ... } }
  ]
}
`.trim();

/**
 * Parse any file (Excel, CSV, JSON, TXT, MD)
 */
function parseFile(file) {
  const fileName = file.originalname || 'uploaded_file';
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const buffer = file.buffer;

  if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    return {
      fileName,
      fileType: ext,
      size: file.size || buffer.length,
      type: 'tabular',
      records: rows,
      sheetName: firstSheetName
    };
  }

  if (ext === 'json') {
    try {
      const text = buffer.toString('utf-8');
      const data = JSON.parse(text);
      const records = Array.isArray(data) ? data : [data];
      return {
        fileName,
        fileType: 'json',
        size: file.size || buffer.length,
        type: 'tabular',
        records
      };
    } catch (e) {
      // Fallback to text
    }
  }

  // Text or Markdown
  const textContent = buffer.toString('utf-8');
  return {
    fileName,
    fileType: ext || 'txt',
    size: file.size || buffer.length,
    type: 'text',
    textContent
  };
}

/**
 * Split a parsed file into semantic chunks
 */
function chunkFile(fileData, chunkSize = 6) {
  const chunks = [];
  const cleanDocId = `doc_${fileData.fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;

  if (fileData.type === 'tabular') {
    const records = fileData.records || [];
    for (let i = 0; i < records.length; i += chunkSize) {
      const chunkRecords = records.slice(i, i + chunkSize);
      const chunkIndex = Math.floor(i / chunkSize);
      const previewText = JSON.stringify(chunkRecords, null, 2);
      
      chunks.push({
        id: `chunk_${cleanDocId}_${chunkIndex}`,
        docId: cleanDocId,
        fileName: fileData.fileName,
        chunkIndex,
        records: chunkRecords,
        previewText: previewText.slice(0, 300),
        fullText: previewText,
        rowCount: chunkRecords.length,
        type: 'tabular'
      });
    }
  } else {
    // Text-based chunking by paragraphs/sections
    const text = fileData.textContent || '';
    const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);
    let currentChunkText = '';
    let currentIdx = 0;

    paragraphs.forEach((p) => {
      if ((currentChunkText + '\n\n' + p).length > 1200 && currentChunkText.length > 0) {
        chunks.push({
          id: `chunk_${cleanDocId}_${currentIdx}`,
          docId: cleanDocId,
          fileName: fileData.fileName,
          chunkIndex: currentIdx,
          previewText: currentChunkText.slice(0, 300),
          fullText: currentChunkText,
          rowCount: 1,
          type: 'text'
        });
        currentIdx++;
        currentChunkText = p;
      } else {
        currentChunkText = currentChunkText ? currentChunkText + '\n\n' + p : p;
      }
    });

    if (currentChunkText.trim().length > 0) {
      chunks.push({
        id: `chunk_${cleanDocId}_${currentIdx}`,
        docId: cleanDocId,
        fileName: fileData.fileName,
        chunkIndex: currentIdx,
        previewText: currentChunkText.slice(0, 300),
        fullText: currentChunkText,
        rowCount: 1,
        type: 'text'
      });
    }
  }

  return chunks;
}

/**
 * Universal Rule-Based Heuristic Parser for a chunk (fallback when LLM key not configured)
 */
function heuristicChunkParser(chunk) {
  const nodesMap = new Map();
  const edgesMap = new Map();

  const records = chunk.records || [];
  records.forEach((row, rowIdx) => {
    const keys = Object.keys(row);
    if (keys.length === 0) return;

    const primaryKey = keys[0];
    const primaryVal = String(row[primaryKey] || `Record_${chunk.chunkIndex}_${rowIdx + 1}`).trim();
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

    keys.slice(1).forEach(colKey => {
      const val = row[colKey];
      if (val === null || val === undefined || val === '') return;

      const strVal = String(val).trim();
      const numVal = Number(strVal);

      if (isNaN(numVal) && strVal.length > 1 && strVal.length < 60) {
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

        let relType = `HAS_${entityLabel.toUpperCase()}`;
        const lowerKey = colKey.toLowerCase();
        if (lowerKey.includes('supplier')) relType = 'SUPPLIED_BY';
        else if (lowerKey.includes('factory')) relType = 'MANUFACTURED_AT';
        else if (lowerKey.includes('warehouse')) relType = 'STORED_IN';
        else if (lowerKey.includes('department')) relType = 'OWNED_BY';
        else if (lowerKey.includes('host') || lowerKey.includes('platform')) relType = 'HOSTED_ON';
        else if (lowerKey.includes('doctor') || lowerKey.includes('physician')) relType = 'TREATED_BY';
        else if (lowerKey.includes('hospital')) relType = 'ADMITTED_TO';
        else if (lowerKey.includes('tech')) relType = 'USES_TECH';
        else if (lowerKey.includes('depend')) relType = 'DEPENDS_ON';

        const edgeId = `${primaryId}_${relType}_${entityId}`;
        if (!edgesMap.has(edgeId)) {
          edgesMap.set(edgeId, {
            id: edgeId,
            from: primaryId,
            fromLabel: primaryCleanLabel,
            to: entityId,
            toLabel: entityLabel,
            type: relType,
            label: relType,
            properties: {}
          });
        }
      }
    });
  });

  return {
    chunkMetadata: {
      summary: `Batch ${chunk.chunkIndex + 1} with ${records.length} records.`,
      keyTopics: ['Records', chunk.fileName]
    },
    nodes: Array.from(nodesMap.values()),
    relationships: Array.from(edgesMap.values())
  };
}

/**
 * Universal Neo4j Ingestion (Ingests Document, Chunk, and Entity nodes + relationships)
 */
async function ingestUniversalToNeo4j(nodes, relationships, config) {
  const { driver, database } = neo4jService.getDriver(config);
  const session = driver.session({ database });

  try {
    // 1. Ingest all Nodes
    for (const node of nodes) {
      const safeLabel = (node.label || node.category || 'Entity').replace(/[^a-zA-Z0-9_]/g, '');
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
      const safeType = (rel.type || rel.label || 'CONNECTED_TO').replace(/[^a-zA-Z0-9_]/g, '');
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
 * MULTI-FILE KNOWLEDGE GRAPH BUILDER
 * Ingests multiple files, generates Document + Chunk nodes, extracts entities, and cross-connects them!
 */
async function buildGraphFromMultiFiles({
  files = [],
  rows = null,
  mode = 'auto',
  includeLineage = true,
  resolveCrossFile = true,
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

  addLog('INIT', `Starting Multi-File Ingestion Pipeline (${files.length || (rows ? 1 : 0)} files queued)...`);
  addLog('CONFIG', `LLM Provider: ${llmConfig.provider.toUpperCase()} (${llmConfig.geminiModel || llmConfig.azureDeployment || 'Default'})`);

  const hasLlmKey = (llmConfig.provider === 'azure' && (llmConfig.azureApiKey || process.env.AZURE_OPENAI_API_KEY)) ||
                    (llmConfig.provider === 'gemini' && (llmConfig.geminiApiKey || process.env.GEMINI_API_KEY));

  // If no files passed but raw rows passed (legacy single row upload)
  let rawFiles = [...files];
  if (rawFiles.length === 0 && rows) {
    rawFiles = [{
      originalname: 'spreadsheet_data.json',
      buffer: Buffer.from(JSON.stringify(rows)),
      size: JSON.stringify(rows).length
    }];
  }

  if (rawFiles.length === 0) {
    throw new Error('No files provided for multi-file graph construction.');
  }

  const allDocNodes = [];
  const allChunkNodes = [];
  const allEntityNodesMap = new Map();
  const allEdgesMap = new Map();
  const docEntityIndex = new Map(); // docId -> Set of entityIds

  let totalChunksCount = 0;
  let totalRecordsCount = 0;

  // Process each file
  for (let fIdx = 0; fIdx < rawFiles.length; fIdx++) {
    const file = rawFiles[fIdx];
    const parsed = parseFile(file);
    const docId = `doc_${parsed.fileName.replace(/[^a-zA-Z0-9]/g, '_')}`;
    const chunks = chunkFile(parsed, 6);

    totalChunksCount += chunks.length;
    totalRecordsCount += (parsed.records ? parsed.records.length : 1);

    addLog('FILE_PARSE', `[File ${fIdx + 1}/${rawFiles.length}: ${parsed.fileName}] Parsed ${(parsed.records ? `${parsed.records.length} records` : 'text content')} ➔ partitioned into ${chunks.length} chunks.`);

    // 1. Document Node
    const docNode = {
      id: docId,
      label: parsed.fileName,
      category: 'Document',
      name: parsed.fileName,
      properties: {
        fileName: parsed.fileName,
        fileType: parsed.fileType,
        fileSize: parsed.size,
        totalChunks: chunks.length,
        recordCount: parsed.records ? parsed.records.length : 1,
        uploadedAt: new Date().toISOString()
      }
    };
    allDocNodes.push(docNode);
    docEntityIndex.set(docId, new Set());

    // 2. Process each Chunk
    let prevChunkId = null;
    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunk = chunks[cIdx];
      addLog('CHUNKING', `[${parsed.fileName}] Extracting entities from Chunk ${cIdx + 1}/${chunks.length}...`);

      let extracted = null;
      if (hasLlmKey) {
        try {
          const userPrompt = `Extract knowledge graph metadata, entities, and relationships for Chunk ${cIdx + 1}/${chunks.length} of file "${parsed.fileName}":\n\n${chunk.fullText}`;
          extracted = await llmService.generateCompletion({
            systemPrompt: MULTI_FILE_CHUNK_PROMPT,
            userPrompt,
            temperature: 0.1,
            jsonMode: true,
            config: llmConfig
          });
        } catch (err) {
          addLog('WARNING', `LLM extraction note for chunk ${cIdx + 1}: ${err.message}. Applying heuristic extractor.`);
        }
      }

      if (!extracted || !Array.isArray(extracted.nodes) || extracted.nodes.length === 0) {
        extracted = heuristicChunkParser(chunk);
      }

      const meta = extracted.chunkMetadata || { summary: `Chunk ${cIdx + 1}`, keyTopics: [] };

      // Chunk Node
      const chunkNode = {
        id: chunk.id,
        label: `Chunk ${cIdx + 1} (${parsed.fileName.slice(0, 15)})`,
        category: 'Chunk',
        name: `Chunk ${cIdx + 1}`,
        properties: {
          docId,
          documentName: parsed.fileName,
          chunkIndex: cIdx,
          summary: meta.summary || '',
          keyTopics: (meta.keyTopics || []).join(', '),
          preview: chunk.previewText
        }
      };
      allChunkNodes.push(chunkNode);

      // Lineage Link: Document -> Chunk
      if (includeLineage) {
        const docChunkEdgeId = `${docId}_HAS_CHUNK_${chunk.id}`;
        allEdgesMap.set(docChunkEdgeId, {
          id: docChunkEdgeId,
          from: docId,
          to: chunk.id,
          type: 'HAS_CHUNK',
          label: 'HAS_CHUNK',
          properties: { index: cIdx }
        });

        // Sequential Chaining: Chunk -> Next Chunk
        if (prevChunkId) {
          const nextEdgeId = `${prevChunkId}_NEXT_CHUNK_${chunk.id}`;
          allEdgesMap.set(nextEdgeId, {
            id: nextEdgeId,
            from: prevChunkId,
            to: chunk.id,
            type: 'NEXT_CHUNK',
            label: 'NEXT_CHUNK',
            properties: {}
          });
        }
      }
      prevChunkId = chunk.id;

      // Extracted Entity Nodes
      (extracted.nodes || []).forEach(n => {
        const entityId = n.id || `${n.label}_${n.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
        
        // Track document provenance
        if (!allEntityNodesMap.has(entityId)) {
          allEntityNodesMap.set(entityId, {
            id: entityId,
            label: n.name || n.label || entityId,
            category: n.label || 'Entity',
            name: n.name || n.label || entityId,
            properties: {
              ...n.properties,
              sourceDocuments: [parsed.fileName]
            }
          });
        } else {
          // Entity already exists from another chunk or file! Merge properties & provenance
          const existing = allEntityNodesMap.get(entityId);
          const srcDocs = new Set(existing.properties.sourceDocuments || []);
          srcDocs.add(parsed.fileName);
          existing.properties = {
            ...existing.properties,
            ...n.properties,
            sourceDocuments: Array.from(srcDocs)
          };
        }

        docEntityIndex.get(docId).add(entityId);

        // Lineage Link: Chunk -> Extracted Entity
        if (includeLineage) {
          const chunkEntityEdgeId = `${chunk.id}_EXTRACTS_${entityId}`;
          allEdgesMap.set(chunkEntityEdgeId, {
            id: chunkEntityEdgeId,
            from: chunk.id,
            to: entityId,
            type: 'EXTRACTS_ENTITY',
            label: 'EXTRACTS',
            properties: { sourceFile: parsed.fileName }
          });
        }
      });

      // Extracted Inter-Entity Relationships
      (extracted.relationships || []).forEach(r => {
        const relType = (r.type || 'RELATED_TO').toUpperCase().replace(/[^a-zA-Z0-9_]/g, '');
        const edgeId = `${r.from}_${relType}_${r.to}`;
        if (!allEdgesMap.has(edgeId)) {
          allEdgesMap.set(edgeId, {
            id: edgeId,
            from: r.from,
            to: r.to,
            type: relType,
            label: relType,
            properties: {
              ...(r.properties || {}),
              sourceFile: parsed.fileName,
              chunkId: chunk.id
            }
          });
        }
      });
    }
  }

  // 3. Cross-File Entity Resolution & Document Connectivity
  let crossFileLinksCount = 0;
  if (resolveCrossFile && rawFiles.length > 1) {
    addLog('CROSS_CONNECT', 'Analyzing multi-file entity overlap and establishing cross-file connections...');

    const docIds = Array.from(docEntityIndex.keys());
    for (let i = 0; i < docIds.length; i++) {
      for (let j = i + 1; j < docIds.length; j++) {
        const docA = docIds[i];
        const docB = docIds[j];
        const setA = docEntityIndex.get(docA);
        const setB = docEntityIndex.get(docB);

        const sharedEntities = [];
        setA.forEach(eId => {
          if (setB.has(eId)) sharedEntities.push(eId);
        });

        if (sharedEntities.length > 0) {
          crossFileLinksCount++;
          const crossDocEdgeId = `${docA}_SHARES_${docB}`;
          allEdgesMap.set(crossDocEdgeId, {
            id: crossDocEdgeId,
            from: docA,
            to: docB,
            type: 'SHARES_ENTITIES',
            label: `SHARES (${sharedEntities.length})`,
            properties: {
              sharedCount: sharedEntities.length,
              sharedEntities: sharedEntities.slice(0, 10)
            }
          });
          addLog('CROSS_CONNECT', `Connected [${docA}] and [${docB}] via ${sharedEntities.length} shared entities (${sharedEntities.slice(0, 3).join(', ')}).`);
        }
      }
    }
  }

  // Assemble all nodes for visualization and database
  const combinedNodes = [
    ...(includeLineage ? allDocNodes : []),
    ...(includeLineage ? allChunkNodes : []),
    ...Array.from(allEntityNodesMap.values())
  ];

  const combinedEdges = Array.from(allEdgesMap.values());

  // Save to Universal In-Memory Store
  neo4jService.saveUniversalGraph({
    nodes: combinedNodes,
    edges: combinedEdges,
    rawRows: []
  });

  // Ingest to live Neo4j Desktop
  addLog('NEO4J_PERSIST', `Injecting ${combinedNodes.length} nodes and ${combinedEdges.length} connections across ${rawFiles.length} files into Neo4j Desktop...`);
  try {
    await ingestUniversalToNeo4j(combinedNodes, combinedEdges, neo4jConfig);
    addLog('SUCCESS', `Multi-file Knowledge Graph successfully committed to Neo4j Desktop DBMS!`);
  } catch (err) {
    addLog('NOTICE', `Neo4j Desktop is offline (${err.message}). Active Memory Store ready with full multi-file graph.`);
  }

  const stats = await neo4jService.getGraphStats(neo4jConfig);
  const graphData = await neo4jService.getGraphData(600, neo4jConfig);

  addLog('COMPLETE', `Pipeline finished! Processed ${rawFiles.length} files into ${totalChunksCount} chunks, mapping ${allEntityNodesMap.size} unique entities and ${combinedEdges.length} connections.`);

  return {
    success: true,
    totalFiles: rawFiles.length,
    totalChunks: totalChunksCount,
    totalProcessed: totalRecordsCount,
    totalEntities: allEntityNodesMap.size,
    totalConnections: combinedEdges.length,
    crossFileLinks: crossFileLinksCount,
    documents: allDocNodes.map(d => ({
      name: d.name,
      chunks: d.properties.totalChunks,
      size: d.properties.fileSize
    })),
    stats,
    graphData,
    logs
  };
}

/**
 * Backward compatibility wrapper for single Excel build
 */
async function buildGraphFromExcel(args) {
  const { fileBuffer, rows, mode, llmConfig, neo4jConfig, onProgress } = args;
  const files = [];
  if (fileBuffer) {
    files.push({
      originalname: 'spreadsheet.xlsx',
      buffer: fileBuffer,
      size: fileBuffer.length
    });
  }
  return buildGraphFromMultiFiles({
    files,
    rows,
    mode,
    llmConfig,
    neo4jConfig,
    onProgress
  });
}

module.exports = {
  buildGraphFromMultiFiles,
  buildGraphFromExcel,
  parseFile,
  chunkFile
};
