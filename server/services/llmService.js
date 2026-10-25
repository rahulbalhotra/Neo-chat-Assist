const axios = require('axios');

/**
 * Normalizes JSON response from LLM text (handling markdown code blocks if any)
 */
function cleanAndParseJSON(rawText) {
  if (!rawText) return null;
  let text = rawText.trim();
  // Strip ```json and ``` if present
  if (text.startsWith('```')) {
    const firstNewline = text.indexOf('\n');
    const lastBackticks = text.lastIndexOf('```');
    if (firstNewline !== -1 && lastBackticks > firstNewline) {
      text = text.substring(firstNewline + 1, lastBackticks).trim();
    }
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    // Attempt regex extraction of first {...} or [...]
    const jsonMatch = text.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
    if (jsonMatch) {
      const candidate = jsonMatch[0];
      try {
        return JSON.parse(candidate);
      } catch (e1) {
        try {
          // Replace raw unescaped newlines inside strings
          const sanitized = candidate.replace(/(?<=:\s*"[^"]*)\n(?=[^"]*")/g, '\\n');
          return JSON.parse(sanitized);
        } catch (e2) {}
      }
    }

    // Attempt regex extraction for cypher
    const cypherMatch = text.match(/"cypher"\s*:\s*"([\s\S]*?)"(?:\s*,\s*"explanation"\s*:\s*"([\s\S]*?)")?/);
    if (cypherMatch) {
      return {
        cypher: cypherMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n'),
        explanation: cypherMatch[2] || 'Generated Cypher query'
      };
    }

    throw new Error(`Invalid JSON returned by LLM: ${err.message}\nRaw text: ${text.substring(0, 300)}...`);
  }
}

/**
 * Call Azure OpenAI Chat Completion API
 */
async function callAzureOpenAI({ messages, temperature = 0.2, jsonMode = false, config }) {
  let endpoint = (config.azureEndpoint || process.env.AZURE_OPENAI_ENDPOINT || '').trim().replace(/\/$/, '');
  const apiKey = config.azureApiKey || process.env.AZURE_OPENAI_API_KEY;
  const deployment = (config.azureDeployment || process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o').trim();
  const apiVersion = config.azureApiVersion || process.env.AZURE_OPENAI_API_VERSION || '2024-06-01';

  if (!endpoint || !apiKey) {
    throw new Error('Azure OpenAI configuration incomplete. Please provide Azure Endpoint and API Key.');
  }

  // If user pasted a full URL with /openai/deployments..., normalize to origin
  try {
    const urlObj = new URL(endpoint);
    endpoint = urlObj.origin;
  } catch (e) {}

  const url = `${endpoint}/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${apiVersion}`;
  
  const payload = {
    messages,
    temperature,
    max_tokens: 4000
  };

  if (jsonMode) {
    payload.response_format = { type: 'json_object' };
    // Azure OpenAI strictly requires the word 'json' in messages when json_object response format is active
    const hasJsonWord = messages.some(m => /json/i.test(m.content));
    if (!hasJsonWord) {
      messages.unshift({ role: 'system', content: 'You must respond strictly in JSON format.' });
    }
  }

  const response = await axios.post(url, payload, {
    headers: {
      'Content-Type': 'application/json',
      'api-key': apiKey
    },
    timeout: 60000
  });

  const content = response.data?.choices?.[0]?.message?.content;
  return content;
}

/**
 * Call Google Gemini GenerateContent API
 */
async function callGemini({ systemInstruction, userPrompt, temperature = 0.2, jsonMode = false, config }) {
  const apiKey = config.geminiApiKey || process.env.GEMINI_API_KEY;
  const model = config.geminiModel || process.env.GEMINI_MODEL || 'gemini-3.6';

  if (!apiKey) {
    throw new Error('Google Gemini API Key is missing. Please provide a Gemini API Key.');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = [
    {
      role: 'user',
      parts: [{ text: userPrompt }]
    }
  ];

  const payload = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens: 4000
    }
  };

  if (systemInstruction) {
    payload.systemInstruction = {
      parts: [{ text: systemInstruction }]
    };
  }

  if (jsonMode) {
    payload.generationConfig.responseMimeType = 'application/json';
  }

  const response = await axios.post(url, payload, {
    headers: { 'Content-Type': 'application/json' },
    timeout: 60000
  });

  const candidate = response.data?.candidates?.[0];
  const content = candidate?.content?.parts?.[0]?.text;
  return content;
}

/**
 * Rule-based heuristic fallback if neither Azure nor Gemini key is supplied
 * (Allows seamless instant demo & testing!)
 */
function heuristicApplicationAnalysis(apps) {
  return apps.map(app => {
    const name = app['Application Name'] || app.name || 'Unknown Application';
    const health = (app['Architecture Health'] || app.health || '').toLowerCase();
    const readiness = (app['Cloud Readiness'] || '').toLowerCase();
    const cost = Number(app['Annual Maintenance Cost'] || app.cost || 0);
    const tech = (app['Tech Stack'] || '').toLowerCase();
    const criticality = (app['Business Criticality'] || '').toLowerCase();
    const dept = app['Department'] || 'General IT';
    const vendor = app['Vendor'] || 'Internal';
    const hosting = app['Hosting'] || 'On-Premises';
    const users = Number(app['Active Users'] || 100);

    let classification = 'RETAIN';
    let rationale = '';
    let actionPlan = '';
    let confidence = 0.90;

    if (health.includes('eol') || health.includes('fragile') || tech.includes('cobol') || tech.includes('foxpro') || tech.includes('lotus') || tech.includes('perl') || readiness.includes('incompatible')) {
      classification = 'RETIRE';
      confidence = 0.95;
      rationale = `Legacy architecture (${app['Architecture Health'] || 'End-of-life'}) with outdated stack (${app['Tech Stack']}). Poses high operational fragility, security exposure, and diminishing talent pool.`;
      actionPlan = `Decommission application within 6 months. Migrate critical historical records to central data warehouse or cloud archive. De-allocate $${cost.toLocaleString()} annual maintenance.`;
    } else if (cost > 300000 && (health.includes('tech debt') || hosting.includes('bare metal') || hosting.includes('vm') || readiness.includes('heavy') || readiness.includes('ready'))) {
      classification = 'OPTIMIZE';
      confidence = 0.88;
      rationale = `High maintenance footprint ($${cost.toLocaleString()}/yr) with technical debt or unoptimized on-premises infrastructure. Holds high business value but needs modernization.`;
      actionPlan = `Re-platform to cloud or consolidate enterprise licenses. Target 35-50% operational cost reduction through containerization and automated CI/CD.`;
    } else {
      classification = 'RETAIN';
      confidence = 0.92;
      rationale = `Strategic modern platform supporting critical business capabilities with strong user adoption (${users.toLocaleString()} users).`;
      actionPlan = `Continue core enhancements, maintain automated health monitoring, and expand cross-department integrations.`;
    }

    // Extract technologies
    const rawTechList = (app['Tech Stack'] || '').split(/[,;]/).map(t => t.trim()).filter(Boolean);
    const techEntities = rawTechList.map(t => ({
      name: t,
      isLegacy: t.toLowerCase().includes('cobol') || t.toLowerCase().includes('rpg') || t.toLowerCase().includes('foxpro') || t.toLowerCase().includes('perl') || t.toLowerCase().includes('domino') || t.toLowerCase().includes('5.6') || t.toLowerCase().includes('11i')
    }));

    // Extract dependencies
    const rawDeps = (app['Dependencies'] || '').split(/[,;]/).map(d => d.trim()).filter(d => d && d.toLowerCase() !== 'none');

    return {
      name,
      department: dept,
      classification,
      rationale,
      actionPlan,
      confidence,
      annualCost: cost,
      businessCriticality: app['Business Criticality'] || 'Medium',
      architectureHealth: app['Architecture Health'] || 'Stable',
      cloudReadiness: app['Cloud Readiness'] || 'Cloud Ready',
      activeUsers: users,
      vendor,
      hosting,
      description: app['Description'] || '',
      technologies: techEntities,
      dependencies: rawDeps
    };
  });
}

/**
 * Universal Unified Chat Completion Dispatcher
 */
async function generateCompletion({ systemPrompt, userPrompt, temperature = 0.2, jsonMode = false, config = {} }) {
  const provider = config.provider || 'gemini'; // 'azure' | 'gemini'

  // If Azure selected
  if (provider === 'azure') {
    if (!config.azureApiKey && !process.env.AZURE_OPENAI_API_KEY) {
      throw new Error('Azure OpenAI API Key is not configured. Please open Settings in the top bar to set your credentials.');
    }
    const messages = [];
    if (systemPrompt) messages.push({ role: 'system', content: systemPrompt });
    messages.push({ role: 'user', content: userPrompt });

    const rawResponse = await callAzureOpenAI({ messages, temperature, jsonMode, config });
    return jsonMode ? cleanAndParseJSON(rawResponse) : rawResponse;
  }

  // If Gemini selected
  if (provider === 'gemini') {
    if (!config.geminiApiKey && !process.env.GEMINI_API_KEY) {
      throw new Error('Google Gemini API Key is not configured. Please open Settings in the top bar to set your Gemini API Key.');
    }
    const rawResponse = await callGemini({
      systemInstruction: systemPrompt,
      userPrompt,
      temperature,
      jsonMode,
      config
    });
    return jsonMode ? cleanAndParseJSON(rawResponse) : rawResponse;
  }

  throw new Error(`Unsupported LLM provider: ${provider}. Choose 'azure' or 'gemini'.`);
}

module.exports = {
  generateCompletion,
  heuristicApplicationAnalysis,
  cleanAndParseJSON
};
