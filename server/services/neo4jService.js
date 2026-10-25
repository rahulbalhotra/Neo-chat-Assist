const neo4j = require('neo4j-driver');

let activeDriver = null;
let currentConfig = {
  uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  username: process.env.NEO4J_USERNAME || 'neo4j',
  password: process.env.NEO4J_PASSWORD || 'password',
  database: process.env.NEO4J_DATABASE || 'neo4j'
};

// In-Memory Fallback Cache for ANY Graph
let inMemoryStore = {
  nodes: [],
  edges: [],
  applications: [],
  hasData: false,
  mode: 'universal' // 'universal' | 'application'
};

function getDriver(overrideConfig = {}) {
  const config = { ...currentConfig, ...overrideConfig };
  
  if (!activeDriver || 
      config.uri !== currentConfig.uri || 
      config.username !== currentConfig.username || 
      config.password !== currentConfig.password) {
    if (activeDriver) {
      activeDriver.close().catch(() => {});
    }
    activeDriver = neo4j.driver(
      config.uri,
      neo4j.auth.basic(config.username, config.password),
      { disableLosslessIntegers: true }
    );
    currentConfig = config;
  }
  return { driver: activeDriver, database: config.database || 'neo4j' };
}

async function testConnection(config = {}) {
  try {
    const { driver, database } = getDriver(config);
    const session = driver.session({ database });
    try {
      const result = await session.run('RETURN 1 AS connected, datetime() AS serverTime');
      const serverInfo = await driver.getServerInfo();
      return {
        success: true,
        server: serverInfo.address,
        version: serverInfo.agent || 'Neo4j 5.x',
        time: result.records[0].get('serverTime').toString()
      };
    } finally {
      await session.close();
    }
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

async function initConstraints(config = {}) {
  try {
    const { driver, database } = getDriver(config);
    const session = driver.session({ database });
    try {
      const constraints = [
        'CREATE CONSTRAINT application_name_unique IF NOT EXISTS FOR (a:Application) REQUIRE a.name IS UNIQUE',
        'CREATE CONSTRAINT classification_name_unique IF NOT EXISTS FOR (c:Classification) REQUIRE c.name IS UNIQUE',
        'CREATE CONSTRAINT department_name_unique IF NOT EXISTS FOR (d:Department) REQUIRE d.name IS UNIQUE',
        'CREATE CONSTRAINT tech_name_unique IF NOT EXISTS FOR (t:Technology) REQUIRE t.name IS UNIQUE'
      ];
      for (const cypher of constraints) {
        try {
          await session.run(cypher);
        } catch (err) {}
      }
      return { success: true };
    } finally {
      await session.close();
    }
  } catch (err) {
    return { success: false, offline: true, error: err.message };
  }
}

async function executeCypher(query, params = {}, config = {}) {
  try {
    const { driver, database } = getDriver(config);
    const session = driver.session({ database });
    try {
      const result = await session.run(query, params);
      const records = result.records.map(record => {
        const obj = {};
        record.keys.forEach(key => {
          let val = record.get(key);
          if (neo4j.isInt(val)) {
            val = val.toNumber();
          } else if (val && typeof val === 'object' && val.properties) {
            val = {
              id: val.identity ? val.identity.toString() : val.elementId,
              labels: val.labels,
              type: val.type,
              properties: val.properties
            };
          }
          obj[key] = val;
        });
        return obj;
      });
      return { success: true, records, summary: result.summary };
    } finally {
      await session.close();
    }
  } catch (error) {
    if (inMemoryStore.hasData) {
      const fallbackRecords = queryInMemoryStore(query);
      return { success: true, records: fallbackRecords, inMemory: true };
    }
    return { success: false, error: error.message };
  }
}

function queryInMemoryStore(query) {
  const upper = query.toUpperCase();
  const nodes = inMemoryStore.nodes || [];
  const edges = inMemoryStore.edges || [];
  const apps = inMemoryStore.applications || [];

  if (apps.length > 0) {
    if (upper.includes("RETIRE")) {
      return apps
        .filter(a => a.classification === 'RETIRE')
        .map(a => ({
          application: a.name,
          annualCost: a.annualCost,
          health: a.architectureHealth,
          rationale: a.rationale,
          actionPlan: a.actionPlan,
          department: a.department,
          classification: 'RETIRE'
        }))
        .sort((a, b) => b.annualCost - a.annualCost);
    }

    if (upper.includes("OPTIMIZE")) {
      return apps
        .filter(a => a.classification === 'OPTIMIZE')
        .map(a => ({
          application: a.name,
          annualCost: a.annualCost,
          cloudReadiness: a.cloudReadiness,
          hosting: a.hosting,
          rationale: a.rationale,
          actionPlan: a.actionPlan,
          department: a.department,
          classification: 'OPTIMIZE'
        }))
        .sort((a, b) => b.annualCost - a.annualCost);
    }

    if (upper.includes("RETAIN")) {
      return apps
        .filter(a => a.classification === 'RETAIN')
        .map(a => ({
          application: a.name,
          annualCost: a.annualCost,
          criticality: a.businessCriticality,
          users: a.activeUsers,
          department: a.department,
          rationale: a.rationale,
          classification: 'RETAIN'
        }))
        .sort((a, b) => b.users - a.users);
    }
  }

  // Universal query fallback: return nodes and connections
  return nodes.slice(0, 25).map(n => ({
    name: n.label,
    category: n.category,
    properties: n.properties,
    connectedRelationships: edges.filter(e => e.from === n.id || e.to === n.id).map(e => `${e.from} -[${e.label}]-> ${e.to}`)
  }));
}

/**
 * Universal Store Saver for ANY graph
 */
function saveUniversalGraph({ nodes = [], edges = [], rawRows = [] }) {
  inMemoryStore = {
    nodes,
    edges,
    applications: [],
    hasData: true,
    mode: 'universal'
  };
}

/**
 * Specialized Store Saver for Application Portfolio
 */
function saveToInMemoryStore(analyzedApps) {
  const nodesMap = new Map();
  const edgesMap = new Map();

  nodesMap.set('RETAIN', {
    id: 'RETAIN',
    label: 'RETAIN',
    category: 'Classification',
    properties: { name: 'RETAIN', color: '#10b981', description: 'Core strategic systems' }
  });
  nodesMap.set('RETIRE', {
    id: 'RETIRE',
    label: 'RETIRE',
    category: 'Classification',
    properties: { name: 'RETIRE', color: '#ef4444', description: 'Decommissioning targets' }
  });
  nodesMap.set('OPTIMIZE', {
    id: 'OPTIMIZE',
    label: 'OPTIMIZE',
    category: 'Classification',
    properties: { name: 'OPTIMIZE', color: '#f59e0b', description: 'Modernization candidates' }
  });

  analyzedApps.forEach(app => {
    const appId = `app_${app.name.replace(/[^a-zA-Z0-9]/g, '_')}`;
    nodesMap.set(appId, {
      id: appId,
      label: app.name,
      category: 'Application',
      properties: {
        name: app.name,
        annualCost: app.annualCost,
        businessCriticality: app.businessCriticality,
        architectureHealth: app.architectureHealth,
        cloudReadiness: app.cloudReadiness,
        activeUsers: app.activeUsers,
        rationale: app.rationale,
        actionPlan: app.actionPlan,
        department: app.department,
        vendor: app.vendor,
        hosting: app.hosting,
        classification: app.classification
      }
    });

    if (app.classification) {
      const edgeId = `${appId}_CLASSIFIED_AS_${app.classification}`;
      edgesMap.set(edgeId, {
        id: edgeId,
        from: appId,
        to: app.classification,
        label: 'CLASSIFIED_AS',
        properties: { rationale: app.rationale }
      });
    }

    if (app.department) {
      const deptId = `dept_${app.department.replace(/[^a-zA-Z0-9]/g, '_')}`;
      if (!nodesMap.has(deptId)) {
        nodesMap.set(deptId, {
          id: deptId,
          label: app.department,
          category: 'Department',
          properties: { name: app.department }
        });
      }
      const deptEdgeId = `${appId}_OWNED_BY_${deptId}`;
      edgesMap.set(deptEdgeId, {
        id: deptEdgeId,
        from: appId,
        to: deptId,
        label: 'OWNED_BY'
      });
    }

    if (Array.isArray(app.technologies)) {
      app.technologies.forEach(t => {
        const tName = typeof t === 'string' ? t : t.name;
        if (!tName) return;
        const techId = `tech_${tName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (!nodesMap.has(techId)) {
          nodesMap.set(techId, {
            id: techId,
            label: tName,
            category: 'Technology',
            properties: { name: tName, isLegacy: Boolean(t.isLegacy) }
          });
        }
        const techEdgeId = `${appId}_USES_TECH_${techId}`;
        edgesMap.set(techEdgeId, {
          id: techEdgeId,
          from: appId,
          to: techId,
          label: 'USES_TECH'
        });
      });
    }

    if (Array.isArray(app.dependencies)) {
      app.dependencies.forEach(depName => {
        if (!depName || depName.toLowerCase() === 'none') return;
        const depId = `app_${depName.replace(/[^a-zA-Z0-9]/g, '_')}`;
        if (!nodesMap.has(depId)) {
          nodesMap.set(depId, {
            id: depId,
            label: depName,
            category: 'Application',
            properties: { name: depName }
          });
        }
        const depEdgeId = `${appId}_DEPENDS_ON_${depId}`;
        edgesMap.set(depEdgeId, {
          id: depEdgeId,
          from: appId,
          to: depId,
          label: 'DEPENDS_ON'
        });
      });
    }
  });

  inMemoryStore = {
    nodes: Array.from(nodesMap.values()),
    edges: Array.from(edgesMap.values()),
    applications: analyzedApps,
    hasData: true,
    mode: 'application'
  };
}

/**
 * Universal Graph Data Fetcher (Matches ANY labels in Neo4j)
 */
async function getGraphData(limit = 400, config = {}) {
  try {
    const { driver, database } = getDriver(config);
    const session = driver.session({ database });
    try {
      // UNIVERSAL QUERY: matches ANY nodes and ANY relationships in database
      const query = `
        MATCH (n)
        OPTIONAL MATCH (n)-[r]->(m)
        RETURN n, r, m
        LIMIT $limit
      `;
      const result = await session.run(query, { limit: neo4j.int(limit) });

      const nodesMap = new Map();
      const edgesMap = new Map();

      result.records.forEach(record => {
        const n = record.get('n');
        const r = record.get('r');
        const m = record.get('m');

        if (n) {
          const id = n.elementId || (n.identity ? n.identity.toString() : n.properties.id || n.properties.name);
          if (!nodesMap.has(id)) {
            const label = n.labels && n.labels.length > 0 ? n.labels[0] : 'Node';
            nodesMap.set(id, {
              id,
              label: n.properties.name || n.properties.title || n.properties.id || id,
              category: label,
              properties: n.properties
            });
          }
        }

        if (m) {
          const id = m.elementId || (m.identity ? m.identity.toString() : m.properties.id || m.properties.name);
          if (!nodesMap.has(id)) {
            const label = m.labels && m.labels.length > 0 ? m.labels[0] : 'Node';
            nodesMap.set(id, {
              id,
              label: m.properties.name || m.properties.title || m.properties.id || id,
              category: label,
              properties: m.properties
            });
          }
        }

        if (r && n && m) {
          const fromId = n.elementId || (n.identity ? n.identity.toString() : n.properties.id || n.properties.name);
          const toId = m.elementId || (m.identity ? m.identity.toString() : m.properties.id || m.properties.name);
          const edgeId = r.elementId || `${fromId}_${r.type}_${toId}`;
          if (!edgesMap.has(edgeId)) {
            edgesMap.set(edgeId, {
              id: edgeId,
              from: fromId,
              to: toId,
              label: r.type,
              properties: r.properties
            });
          }
        }
      });

      if (nodesMap.size > 0) {
        return {
          nodes: Array.from(nodesMap.values()),
          edges: Array.from(edgesMap.values()),
          isNeo4jLive: true
        };
      }
    } finally {
      await session.close();
    }
  } catch (err) {}

  return {
    nodes: inMemoryStore.nodes || [],
    edges: inMemoryStore.edges || [],
    isNeo4jLive: false
  };
}

/**
 * Universal Graph Stats (Counts nodes, relationships, and distinct labels)
 */
async function getGraphStats(config = {}) {
  try {
    const { driver, database } = getDriver(config);
    const session = driver.session({ database });
    try {
      const statsQuery = `
        CALL {
          MATCH (n) RETURN count(n) AS totalNodes
        }
        CALL {
          MATCH ()-[r]->() RETURN count(r) AS totalEdges
        }
        CALL {
          OPTIONAL MATCH (a:Application) RETURN count(a) AS totalApps, sum(coalesce(a.annualCost, 0)) AS totalCost
        }
        CALL {
          OPTIONAL MATCH (retainApp:Application)-[:CLASSIFIED_AS]->(:Classification {name: 'RETAIN'})
          RETURN count(retainApp) AS retainCount
        }
        CALL {
          OPTIONAL MATCH (retireApp:Application)-[:CLASSIFIED_AS]->(:Classification {name: 'RETIRE'})
          RETURN count(retireApp) AS retireCount, sum(coalesce(retireApp.annualCost, 0)) AS retireSavings
        }
        CALL {
          OPTIONAL MATCH (optApp:Application)-[:CLASSIFIED_AS]->(:Classification {name: 'OPTIMIZE'})
          RETURN count(optApp) AS optimizeCount
        }
        CALL {
          CALL db.labels() YIELD label RETURN collect(label) AS labels
        }
        CALL {
          CALL db.relationshipTypes() YIELD relationshipType RETURN collect(relationshipType) AS relTypes
        }
        RETURN totalNodes, totalEdges, totalApps, totalCost, retainCount, retireCount, optimizeCount, retireSavings, labels, relTypes
      `;
      const result = await session.run(statsQuery);
      const rec = result.records[0];
      if (rec && rec.get('totalNodes') > 0) {
        return {
          totalNodes: rec.get('totalNodes'),
          totalEdges: rec.get('totalEdges'),
          totalApps: rec.get('totalApps') || 0,
          totalCost: rec.get('totalCost') || 0,
          retainCount: rec.get('retainCount') || 0,
          retireCount: rec.get('retireCount') || 0,
          optimizeCount: rec.get('optimizeCount') || 0,
          retireSavings: rec.get('retireSavings') || 0,
          labels: rec.get('labels') || [],
          relTypes: rec.get('relTypes') || []
        };
      }
    } finally {
      await session.close();
    }
  } catch (err) {}

  // Fallback to in-memory stats
  const nodes = inMemoryStore.nodes || [];
  const edges = inMemoryStore.edges || [];
  const apps = inMemoryStore.applications || [];

  const labels = Array.from(new Set(nodes.map(n => n.category).filter(Boolean)));
  const relTypes = Array.from(new Set(edges.map(e => e.label).filter(Boolean)));

  const retainApps = apps.filter(a => a.classification === 'RETAIN');
  const retireApps = apps.filter(a => a.classification === 'RETIRE');
  const optimizeApps = apps.filter(a => a.classification === 'OPTIMIZE');
  const totalCost = apps.reduce((sum, a) => sum + (Number(a.annualCost) || 0), 0);
  const retireSavings = retireApps.reduce((sum, a) => sum + (Number(a.annualCost) || 0), 0);

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    totalApps: apps.length,
    totalCost,
    retainCount: retainApps.length,
    retireCount: retireApps.length,
    optimizeCount: optimizeApps.length,
    retireSavings,
    labels,
    relTypes
  };
}

/**
 * Universal Dynamic Schema Inspector for Chat with Graph
 */
async function getSchema(config = {}) {
  try {
    const { driver, database } = getDriver(config);
    const session = driver.session({ database });
    try {
      const nodeLabelsResult = await session.run('CALL db.labels() YIELD label RETURN label');
      const labels = nodeLabelsResult.records.map(r => r.get('label'));

      const relTypesResult = await session.run('CALL db.relationshipTypes() YIELD relationshipType RETURN relationshipType');
      const relationships = relTypesResult.records.map(r => r.get('relationshipType'));

      return {
        labels,
        relationships,
        schemaSummary: `Live Knowledge Graph Schema:\nNode Labels: ${labels.join(', ')}\nRelationship Types: ${relationships.join(', ')}`
      };
    } finally {
      await session.close();
    }
  } catch (err) {}

  const nodes = inMemoryStore.nodes || [];
  const edges = inMemoryStore.edges || [];
  const labels = Array.from(new Set(nodes.map(n => n.category).filter(Boolean)));
  const relationships = Array.from(new Set(edges.map(e => e.label).filter(Boolean)));

  return {
    labels: labels.length > 0 ? labels : ['Application', 'Classification', 'Department', 'Technology'],
    relationships: relationships.length > 0 ? relationships : ['CLASSIFIED_AS', 'OWNED_BY', 'USES_TECH'],
    schemaSummary: `In-Memory Graph Schema:\nNode Labels: ${labels.join(', ')}\nRelationship Types: ${relationships.join(', ')}`
  };
}

async function clearGraph(config = {}) {
  inMemoryStore = { nodes: [], edges: [], applications: [], hasData: false, mode: 'universal' };
  try {
    const { driver, database } = getDriver(config);
    const session = driver.session({ database });
    try {
      await session.run('MATCH (n) DETACH DELETE n');
    } finally {
      await session.close();
    }
  } catch (e) {}
  return { success: true };
}

module.exports = {
  getDriver,
  testConnection,
  initConstraints,
  executeCypher,
  getGraphData,
  getGraphStats,
  getSchema,
  clearGraph,
  saveToInMemoryStore,
  saveUniversalGraph
};
