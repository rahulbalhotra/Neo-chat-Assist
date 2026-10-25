import axios from 'axios';

const API_BASE = '/api';

// Retrieve saved configs from localStorage
export function getSavedConfig() {
  try {
    const raw = localStorage.getItem('neo4j_assist_config');
    if (raw) return JSON.parse(raw);
  } catch (e) {}

  return {
    provider: 'gemini',
    geminiApiKey: '',
    geminiModel: 'gemini-3.6',
    azureEndpoint: '',
    azureApiKey: '',
    azureDeployment: 'gpt-4o',
    azureApiVersion: '2024-06-01',
    neo4jUri: 'bolt://localhost:7687',
    neo4jUsername: 'neo4j',
    neo4jPassword: 'password',
    neo4jDatabase: 'neo4j'
  };
}

export function saveConfig(config) {
  try {
    localStorage.setItem('neo4j_assist_config', JSON.stringify(config));
  } catch (e) {}
}

function getHeaders() {
  const cfg = getSavedConfig();
  return {
    'x-llm-provider': cfg.provider,
    'x-gemini-api-key': cfg.geminiApiKey || '',
    'x-gemini-model': cfg.geminiModel || 'gemini-1.5-flash',
    'x-azure-endpoint': cfg.azureEndpoint || '',
    'x-azure-api-key': cfg.azureApiKey || '',
    'x-azure-deployment': cfg.azureDeployment || 'gpt-4o',
    'x-azure-api-version': cfg.azureApiVersion || '2024-06-01',
    'x-neo4j-uri': cfg.neo4jUri || 'bolt://localhost:7687',
    'x-neo4j-username': cfg.neo4jUsername || 'neo4j',
    'x-neo4j-password': cfg.neo4jPassword || 'password',
    'x-neo4j-database': cfg.neo4jDatabase || 'neo4j'
  };
}

export const api = {
  getHealth: async () => {
    const res = await axios.get(`${API_BASE}/health`);
    return res.data;
  },

  testNeo4j: async (neo4jConfig) => {
    const cfg = neo4jConfig || getSavedConfig();
    const res = await axios.post(`${API_BASE}/neo4j/test`, {
      neo4jUri: cfg.neo4jUri,
      neo4jUsername: cfg.neo4jUsername,
      neo4jPassword: cfg.neo4jPassword,
      neo4jDatabase: cfg.neo4jDatabase
    });
    return res.data;
  },

  testLlm: async (llmConfig) => {
    const cfg = llmConfig || getSavedConfig();
    const res = await axios.post(`${API_BASE}/llm/test`, cfg);
    return res.data;
  },

  getGraphData: async (limit = 350) => {
    const res = await axios.get(`${API_BASE}/graph/data?limit=${limit}`, {
      headers: getHeaders()
    });
    return res.data;
  },

  getGraphStats: async () => {
    const res = await axios.get(`${API_BASE}/graph/stats`, {
      headers: getHeaders()
    });
    return res.data;
  },

  clearGraph: async () => {
    const res = await axios.post(`${API_BASE}/graph/clear`, {}, {
      headers: getHeaders()
    });
    return res.data;
  },

  buildGraph: async (formData) => {
    const res = await axios.post(`${API_BASE}/graph/build`, formData, {
      headers: {
        ...getHeaders(),
        'Content-Type': 'multipart/form-data'
      }
    });
    return res.data;
  },

  getProgress: async (jobId) => {
    const res = await axios.get(`${API_BASE}/graph/progress/${jobId}`);
    return res.data;
  },

  chatWithGraph: async (question, history = []) => {
    const res = await axios.post(`${API_BASE}/chat`, { question, history }, {
      headers: getHeaders()
    });
    return res.data;
  },

  runCypher: async (query, params = {}) => {
    const res = await axios.post(`${API_BASE}/cypher/run`, { query, params }, {
      headers: getHeaders()
    });
    return res.data;
  }
};
