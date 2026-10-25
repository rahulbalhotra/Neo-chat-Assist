const neo4j = require('neo4j-driver');

let activeDriver = null;
let currentConfig = {
  uri: process.env.NEO4J_URI || 'bolt://localhost:7687',
  username: process.env.NEO4J_USERNAME || 'neo4j',
  password: process.env.NEO4J_PASSWORD || 'password',
  database: process.env.NEO4J_DATABASE || 'neo4j'
};

// In-Memory Fallback Cache if Neo4j Desktop is temporarily offline
let inMemoryStore = {
  nodes: [],
  edges: [],
  applications: [],
  hasData: false
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
        'CREATE CONSTRAINT tech_name_unique IF NOT EXISTS FOR (t:Technology) REQUIRE t.name IS UNIQUE',
        'CREATE CONSTRAINT vendor_name_unique IF NOT EXISTS FOR (v:Vendor) REQUIRE v.name IS UNIQUE',
        'CREATE CONSTRAINT platform_name_unique IF NOT EXISTS FOR (p:Platform) REQUIRE p.name IS UNIQUE'
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
    // Neo4j offline
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
    // If Neo4j is offline, check if we can query from in-memory store
    if (inMemoryStore.hasData) {
      const fallbackRecords = queryInMemoryStore(query);
      return { success: true, records: fallbackRecords, inMemory: true };
    }
    return { success: false, error: error.message };
  }
}

function queryInMemoryStore(query) {
  const upper = query.toUpperCase();
  const apps = inMemoryStore.applications || [];

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

  // Default return top applications
  return apps.map(a => ({
    application: a.name,
    classification: a.classification,
    annualCost: a.annualCost,
    department: a.department,
    criticality: a.businessCriticality,
    rationale: a.rationale
  })).sort((a, b) => b.annualCost - a.annualCost);
}

function saveToInMemoryStore(analyzedApps) {
  const nodesMap = new Map();
  const edgesMap = new Map();

  // Add classification hubs
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

    // Edge to classification
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

    // Department node & edge
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

    // Technology nodes & edges
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

    // Dependencies
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
    hasData: true
  };
}

async function getGraphData(limit = 350, config = {}) {
  try {
    const { driver, database } = getDriver(config);
    const session = driver.session({ database });
    try {
      const query = `
        MATCH (n)
        WHERE n:Application OR n:Classification OR n:Department OR n:Technology OR n:Vendor OR n:Platform
        OPTIONAL MATCH (n)-[r]->(m)
        WHERE m:Application OR m:Classification OR m:Department OR m:Technology OR m:Vendor OR m:Platform
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
          const id = n.elementId || (n.identity ? n.identity.toString() : n.properties.name);
          if (!nodesMap.has(id)) {
            const label = n.labels ? n.labels[0] : 'Node';
            nodesMap.set(id, {
              id,
              label: n.properties.name || id,
              category: label,
              properties: n.properties
            });
          }
        }

        if (m) {
          const id = m.elementId || (m.identity ? m.identity.toString() : m.properties.name);
          if (!nodesMap.has(id)) {
            const label = m.labels ? m.labels[0] : 'Node';
            nodesMap.set(id, {
              id,
              label: m.properties.name || id,
              category: label,
              properties: m.properties
            });
          }
        }

        if (r && n && m) {
          const fromId = n.elementId || (n.identity ? n.identity.toString() : n.properties.name);
          const toId = m.elementId || (m.identity ? m.identity.toString() : m.properties.name);
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
  } catch (err) {
    // If Neo4j query fails, fallback to in-memory store
  }

  // Return in-memory fallback
  return {
    nodes: inMemoryStore.nodes || [],
    edges: inMemoryStore.edges || [],
    isNeo4jLive: false
  };
}

async function getGraphStats(config = {}) {
  try {
    const { driver, database } = getDriver(config);
    const session = driver.session({ database });
    try {
      const statsQuery = `
        OPTIONAL MATCH (a:Application)
        WITH count(a) AS totalApps, sum(coalesce(a.annualCost, 0)) AS totalCost
        OPTIONAL MATCH (retainApp:Application)-[:CLASSIFIED_AS]->(:Classification {name: 'RETAIN'})
        WITH totalApps, totalCost, count(retainApp) AS retainCount
        OPTIONAL MATCH (retireApp:Application)-[:CLASSIFIED_AS]->(:Classification {name: 'RETIRE'})
        WITH totalApps, totalCost, retainCount, count(retireApp) AS retireCount, sum(coalesce(retireApp.annualCost, 0)) AS retireSavings
        OPTIONAL MATCH (optApp:Application)-[:CLASSIFIED_AS]->(:Classification {name: 'OPTIMIZE'})
        WITH totalApps, totalCost, retainCount, retireCount, retireSavings, count(optApp) AS optimizeCount
        OPTIONAL MATCH (t:Technology)
        WITH totalApps, totalCost, retainCount, retireCount, retireSavings, optimizeCount, count(t) AS totalTech
        OPTIONAL MATCH (d:Department)
        RETURN totalApps, totalCost, retainCount, retireCount, optimizeCount, retireSavings, totalTech, count(d) AS totalDepts
      `;
      const result = await session.run(statsQuery);
      const rec = result.records[0];
      if (rec && rec.get('totalApps') > 0) {
        return {
          totalApps: rec.get('totalApps'),
          totalCost: rec.get('totalCost'),
          retainCount: rec.get('retainCount'),
          retireCount: rec.get('retireCount'),
          optimizeCount: rec.get('optimizeCount'),
          retireSavings: rec.get('retireSavings'),
          totalTech: rec.get('totalTech'),
          totalDepts: rec.get('totalDepts')
        };
      }
    } finally {
      await session.close();
    }
  } catch (err) {}

  // Compute from in-memory store
  const apps = inMemoryStore.applications || [];
  const retainApps = apps.filter(a => a.classification === 'RETAIN');
  const retireApps = apps.filter(a => a.classification === 'RETIRE');
  const optimizeApps = apps.filter(a => a.classification === 'OPTIMIZE');

  const totalCost = apps.reduce((sum, a) => sum + (Number(a.annualCost) || 0), 0);
  const retireSavings = retireApps.reduce((sum, a) => sum + (Number(a.annualCost) || 0), 0);

  const depts = new Set(apps.map(a => a.department).filter(Boolean));
  const techs = new Set();
  apps.forEach(a => {
    (a.technologies || []).forEach(t => techs.add(typeof t === 'string' ? t : t.name));
  });

  return {
    totalApps: apps.length,
    totalCost,
    retainCount: retainApps.length,
    retireCount: retireApps.length,
    optimizeCount: optimizeApps.length,
    retireSavings,
    totalTech: techs.size,
    totalDepts: depts.size
  };
}

async function clearGraph(config = {}) {
  inMemoryStore = { nodes: [], edges: [], applications: [], hasData: false };
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
  clearGraph,
  saveToInMemoryStore
};
