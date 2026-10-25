require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const neo4jService = require('./services/neo4jService');
const llmService = require('./services/llmService');
const graphBuilderService = require('./services/graphBuilderService');
const graphChatService = require('./services/graphChatService');

const app = express();
const PORT = process.env.PORT || 3001;

// Upload storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 } // 25 MB
});

app.use(cors());
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Helper to extract configs from headers or body
function getConfigs(req) {
  const llmConfig = {
    provider: req.headers['x-llm-provider'] || req.body.provider || 'gemini',
    geminiApiKey: req.headers['x-gemini-api-key'] || req.body.geminiApiKey || process.env.GEMINI_API_KEY,
    geminiModel: req.headers['x-gemini-model'] || req.body.geminiModel || process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    azureEndpoint: req.headers['x-azure-endpoint'] || req.body.azureEndpoint || process.env.AZURE_OPENAI_ENDPOINT,
    azureApiKey: req.headers['x-azure-api-key'] || req.body.azureApiKey || process.env.AZURE_OPENAI_API_KEY,
    azureDeployment: req.headers['x-azure-deployment'] || req.body.azureDeployment || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o',
    azureApiVersion: req.headers['x-azure-api-version'] || req.body.azureApiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-06-01'
  };

  const neo4jConfig = {
    uri: req.headers['x-neo4j-uri'] || req.body.neo4jUri || process.env.NEO4J_URI || 'bolt://localhost:7687',
    username: req.headers['x-neo4j-username'] || req.body.neo4jUsername || process.env.NEO4J_USERNAME || 'neo4j',
    password: req.headers['x-neo4j-password'] || req.body.neo4jPassword || process.env.NEO4J_PASSWORD || 'password',
    database: req.headers['x-neo4j-database'] || req.body.neo4jDatabase || process.env.NEO4J_DATABASE || 'neo4j'
  };

  return { llmConfig, neo4jConfig };
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'Neo4j Application Rationalization Graph Assist' });
});

// Test Neo4j connection
app.post('/api/neo4j/test', async (req, res) => {
  try {
    const { neo4jConfig } = getConfigs(req);
    const result = await neo4jService.testConnection(neo4jConfig);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Test LLM Connection (Azure or Gemini)
app.post('/api/llm/test', async (req, res) => {
  try {
    const { llmConfig } = getConfigs(req);
    const testResult = await llmService.generateCompletion({
      systemPrompt: 'You are a test agent. Respond in JSON.',
      userPrompt: 'Echo back {"status": "ok", "provider": "connected"}',
      temperature: 0,
      jsonMode: true,
      config: llmConfig
    });
    res.json({ success: true, result: testResult, provider: llmConfig.provider });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, provider: req.body.provider });
  }
});

// Get current graph data (nodes & edges)
app.get('/api/graph/data', async (req, res) => {
  try {
    const { neo4jConfig } = getConfigs(req);
    const limit = parseInt(req.query.limit || '400', 10);
    const data = await neo4jService.getGraphData(limit, neo4jConfig);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message, nodes: [], edges: [] });
  }
});

// Get portfolio metrics & statistics
app.get('/api/graph/stats', async (req, res) => {
  try {
    const { neo4jConfig } = getConfigs(req);
    const stats = await neo4jService.getGraphStats(neo4jConfig);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clear graph
app.post('/api/graph/clear', async (req, res) => {
  try {
    const { neo4jConfig } = getConfigs(req);
    await neo4jService.clearGraph(neo4jConfig);
    res.json({ success: true, message: 'Neo4j graph cleared successfully' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Download sample Excel file
app.get('/api/sample-excel', (req, res) => {
  const type = req.query.type || 'applications';
  let filename = 'enterprise_application_stack.xlsx';
  if (type === 'supply_chain') filename = 'supply_chain_logistics.xlsx';
  if (type === 'healthcare') filename = 'healthcare_clinical_network.xlsx';

  const samplePath = path.join(__dirname, '..', 'sampleData', filename);
  if (fs.existsSync(samplePath)) {
    res.download(samplePath, filename);
  } else {
    res.status(404).json({ error: `Sample file ${filename} not found.` });
  }
});

// Build graph from uploaded Excel or sample
app.post('/api/graph/build', upload.single('file'), async (req, res) => {
  try {
    const { llmConfig, neo4jConfig } = getConfigs(req);
    let fileBuffer = req.file ? req.file.buffer : null;

    // Check if user requested a built-in sample
    if (!fileBuffer && req.body.useSample === 'true') {
      const sampleType = req.body.sampleType || 'applications';
      let filename = 'enterprise_application_stack.xlsx';
      if (sampleType === 'supply_chain') filename = 'supply_chain_logistics.xlsx';
      if (sampleType === 'healthcare') filename = 'healthcare_clinical_network.xlsx';

      const samplePath = path.join(__dirname, '..', 'sampleData', filename);
      if (fs.existsSync(samplePath)) {
        fileBuffer = fs.readFileSync(samplePath);
      }
    }

    if (!fileBuffer && !req.body.rows) {
      return res.status(400).json({ error: 'No Excel file uploaded and no sample selected.' });
    }

    const result = await graphBuilderService.buildGraphFromExcel({
      fileBuffer,
      rows: req.body.rows ? JSON.parse(req.body.rows) : null,
      mode: req.body.mode || 'auto',
      llmConfig,
      neo4jConfig
    });

    res.json(result);
  } catch (error) {
    console.error('Error in /api/graph/build:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Chat with Graph
app.post('/api/chat', async (req, res) => {
  try {
    const { question, history } = req.body;
    if (!question || !question.trim()) {
      return res.status(400).json({ error: 'Question is required.' });
    }

    const { llmConfig, neo4jConfig } = getConfigs(req);
    const result = await graphChatService.chatWithGraph({
      question: question.trim(),
      conversationHistory: history || [],
      llmConfig,
      neo4jConfig
    });

    res.json(result);
  } catch (error) {
    console.error('Error in /api/chat:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run Cypher query directly (developer / query console)
app.post('/api/cypher/run', async (req, res) => {
  try {
    const { query, params } = req.body;
    const { neo4jConfig } = getConfigs(req);
    const result = await neo4jService.executeCypher(query, params || {}, neo4jConfig);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});
