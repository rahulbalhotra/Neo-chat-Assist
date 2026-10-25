import React, { useState, useEffect } from 'react';
import { 
  FileSpreadsheet, 
  Network, 
  MessageSquare, 
  Terminal, 
  Sparkles, 
  Database, 
  Layers,
  ArrowRight,
  Play
} from 'lucide-react';
import { api, getSavedConfig, saveConfig } from './services/api';
import Header from './components/Header';
import PortfolioSummary from './components/PortfolioSummary';
import ExcelUploader from './components/ExcelUploader';
import GraphViewer from './components/GraphViewer';
import GraphChat from './components/GraphChat';
import ConfigModal from './components/ConfigModal';
import NodeDetailsModal from './components/NodeDetailsModal';

export default function App() {
  const [config, setConfig] = useState(getSavedConfig());
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('upload'); // 'upload' | 'graph' | 'chat' | 'cypher'

  const [neo4jStatus, setNeo4jStatus] = useState({ connected: false, error: 'Checking Neo4j Desktop...' });
  const [stats, setStats] = useState(null);
  const [graphData, setGraphData] = useState({ nodes: [], edges: [] });
  const [selectedNode, setSelectedNode] = useState(null);
  const [highlightApps, setHighlightApps] = useState([]);
  const [loading, setLoading] = useState(false);

  // Cypher Console state
  const [cypherInput, setCypherInput] = useState(`MATCH (a:Application)-[:CLASSIFIED_AS]->(c:Classification)\nOPTIONAL MATCH (a)-[:OWNED_BY]->(d:Department)\nRETURN a.name, c.name AS decision, a.annualCost AS cost, d.name AS dept\nORDER BY a.annualCost DESC\nLIMIT 15`);
  const [cypherResult, setCypherResult] = useState(null);
  const [runningCypher, setRunningCypher] = useState(false);

  // Check Neo4j and load graph on startup
  const checkNeo4jAndLoadData = async (cfg = config) => {
    setLoading(true);
    try {
      const conn = await api.testNeo4j(cfg);
      setNeo4jStatus({
        connected: conn.success,
        server: conn.server,
        version: conn.version,
        error: conn.error
      });

      if (conn.success) {
        // Load stats & graph
        const [statsRes, graphRes] = await Promise.all([
          api.getGraphStats(),
          api.getGraphData(350)
        ]);
        setStats(statsRes);
        setGraphData(graphRes);
      }
    } catch (err) {
      setNeo4jStatus({ connected: false, error: err.response?.data?.error || err.message });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    checkNeo4jAndLoadData();
  }, []);

  const handleConfigChange = (newConfig) => {
    setConfig(newConfig);
    saveConfig(newConfig);
  };

  const handleGraphBuilt = (result) => {
    if (result.stats) setStats(result.stats);
    if (result.graphData) setGraphData(result.graphData);
    setActiveTab('graph');
  };

  const handleClearGraph = async () => {
    if (!window.confirm('Are you sure you want to clear the Neo4j Application Rationalization graph?')) {
      return;
    }
    try {
      setLoading(true);
      await api.clearGraph();
      await checkNeo4jAndLoadData();
    } catch (err) {
      alert(`Error clearing graph: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRunCypher = async () => {
    if (!cypherInput.trim()) return;
    setRunningCypher(true);
    setCypherResult(null);
    try {
      const res = await api.runCypher(cypherInput);
      setCypherResult(res);
    } catch (err) {
      setCypherResult({ success: false, error: err.response?.data?.error || err.message });
    } finally {
      setRunningCypher(false);
    }
  };

  const handleFocusAppFromChat = (appName) => {
    setHighlightApps([appName]);
    setActiveTab('graph');
  };

  return (
    <div className="app-container" style={{ background: '#f8fafc' }}>
      {/* Top Header */}
      <Header
        config={config}
        onConfigChange={handleConfigChange}
        onOpenSettings={() => setIsConfigOpen(true)}
        neo4jStatus={neo4jStatus}
        onRefresh={() => checkNeo4jAndLoadData()}
        onClearGraph={handleClearGraph}
        loading={loading}
      />

      {/* Portfolio Rationalization Summary KPI Bar */}
      <PortfolioSummary stats={stats} />

      {/* Main Tab Navigation */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        margin: '18px 24px 0 24px',
        borderBottom: '1px solid #e2e8f0',
        paddingBottom: '2px'
      }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          
          {/* Tab 1: Upload & Build */}
          <button
            id="tab-upload"
            type="button"
            className="btn"
            onClick={() => setActiveTab('upload')}
            style={{
              padding: '10px 18px',
              fontSize: '0.85rem',
              borderRadius: '8px 8px 0 0',
              background: activeTab === 'upload' ? '#ffffff' : 'transparent',
              borderBottom: activeTab === 'upload' ? '2px solid #008cc1' : '2px solid transparent',
              color: activeTab === 'upload' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'upload' ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTop: activeTab === 'upload' ? '1px solid #e2e8f0' : 'none',
              borderLeft: activeTab === 'upload' ? '1px solid #e2e8f0' : 'none',
              borderRight: activeTab === 'upload' ? '1px solid #e2e8f0' : 'none'
            }}
          >
            <FileSpreadsheet size={16} color={activeTab === 'upload' ? '#008cc1' : 'currentColor'} />
            1. Excel Ingestion & LLM Classifier
          </button>

          {/* Tab 2: Knowledge Graph */}
          <button
            id="tab-graph"
            type="button"
            className="btn"
            onClick={() => setActiveTab('graph')}
            style={{
              padding: '10px 18px',
              fontSize: '0.85rem',
              borderRadius: '8px 8px 0 0',
              background: activeTab === 'graph' ? '#ffffff' : 'transparent',
              borderBottom: activeTab === 'graph' ? '2px solid #008cc1' : '2px solid transparent',
              color: activeTab === 'graph' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'graph' ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTop: activeTab === 'graph' ? '1px solid #e2e8f0' : 'none',
              borderLeft: activeTab === 'graph' ? '1px solid #e2e8f0' : 'none',
              borderRight: activeTab === 'graph' ? '1px solid #e2e8f0' : 'none'
            }}
          >
            <Network size={16} color={activeTab === 'graph' ? '#008cc1' : 'currentColor'} />
            2. Interactive Knowledge Graph ({graphData?.nodes?.length || 0} Nodes)
          </button>

          {/* Tab 3: Chat with Graph */}
          <button
            id="tab-chat"
            type="button"
            className="btn"
            onClick={() => setActiveTab('chat')}
            style={{
              padding: '10px 18px',
              fontSize: '0.85rem',
              borderRadius: '8px 8px 0 0',
              background: activeTab === 'chat' ? '#ffffff' : 'transparent',
              borderBottom: activeTab === 'chat' ? '2px solid #7c3aed' : '2px solid transparent',
              color: activeTab === 'chat' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'chat' ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTop: activeTab === 'chat' ? '1px solid #e2e8f0' : 'none',
              borderLeft: activeTab === 'chat' ? '1px solid #e2e8f0' : 'none',
              borderRight: activeTab === 'chat' ? '1px solid #e2e8f0' : 'none'
            }}
          >
            <MessageSquare size={16} color={activeTab === 'chat' ? '#7c3aed' : 'currentColor'} />
            3. Chat with Graph (Text-to-Cypher AI)
          </button>

          {/* Tab 4: Direct Cypher Console */}
          <button
            id="tab-cypher"
            type="button"
            className="btn"
            onClick={() => setActiveTab('cypher')}
            style={{
              padding: '10px 18px',
              fontSize: '0.85rem',
              borderRadius: '8px 8px 0 0',
              background: activeTab === 'cypher' ? '#ffffff' : 'transparent',
              borderBottom: activeTab === 'cypher' ? '2px solid #008cc1' : '2px solid transparent',
              color: activeTab === 'cypher' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'cypher' ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              borderTop: activeTab === 'cypher' ? '1px solid #e2e8f0' : 'none',
              borderLeft: activeTab === 'cypher' ? '1px solid #e2e8f0' : 'none',
              borderRight: activeTab === 'cypher' ? '1px solid #e2e8f0' : 'none'
            }}
          >
            <Terminal size={16} color={activeTab === 'cypher' ? '#008cc1' : 'currentColor'} />
            Cypher Console
          </button>
        </div>

        {/* Quick status pill */}
        <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span>Active LLM:</span>
          <span className={`badge ${config.provider === 'azure' ? 'badge-azure' : 'badge-gemini'}`} style={{ fontSize: '0.7rem' }}>
            {config.provider === 'azure' ? 'Azure OpenAI' : 'Gemini'}
          </span>
        </div>
      </div>

      {/* Main View Area */}
      <main style={{ flex: 1, margin: '16px 24px 24px 24px', display: 'flex', flexDirection: 'column' }}>
        
        {/* TAB 1: UPLOAD & BUILD */}
        {activeTab === 'upload' && (
          <div className="glass-panel" style={{ flex: 1, background: '#ffffff', overflow: 'hidden' }}>
            <ExcelUploader
              config={config}
              onGraphBuilt={handleGraphBuilt}
              onSwitchToGraph={() => setActiveTab('graph')}
            />
          </div>
        )}

        {/* TAB 2: KNOWLEDGE GRAPH EXPLORER */}
        {activeTab === 'graph' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: '720px', height: 'calc(100vh - 240px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>
            <GraphViewer
              graphData={graphData}
              onSelectNode={(node) => setSelectedNode(node)}
              highlightNodeNames={highlightApps}
              loading={loading}
            />
          </div>
        )}

        {/* TAB 3: CHAT WITH GRAPH */}
        {activeTab === 'chat' && (
          <div className="glass-panel" style={{ flex: 1, minHeight: '620px', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#ffffff' }}>
            <GraphChat
              config={config}
              onFocusApp={handleFocusAppFromChat}
            />
          </div>
        )}

        {/* TAB 4: CYPHER QUERY CONSOLE */}
        {activeTab === 'cypher' && (
          <div className="glass-panel" style={{ flex: 1, padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px', background: '#ffffff' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Terminal size={18} color="#008cc1" />
                  Direct Neo4j Cypher Query Console
                </h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
                  Execute arbitrary read queries against your connected Neo4j Desktop database.
                </p>
              </div>

              <button
                id="run-cypher-btn"
                type="button"
                className="btn btn-primary"
                onClick={handleRunCypher}
                disabled={runningCypher}
                style={{ padding: '8px 18px', gap: '6px' }}
              >
                <Play size={15} />
                <span>{runningCypher ? 'Executing...' : 'Run Query'}</span>
              </button>
            </div>

            <textarea
              id="cypher-query-textarea"
              rows={5}
              value={cypherInput}
              onChange={(e) => setCypherInput(e.target.value)}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.85rem',
                color: '#0f172a',
                background: '#f8fafc',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1'
              }}
            />

            {cypherResult && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span>Query Results ({cypherResult.records?.length || 0} records returned)</span>
                  {cypherResult.summary && (
                    <span style={{ color: '#059669', fontWeight: '600' }}>Executed in {cypherResult.summary.resultAvailableAfter || 1}ms</span>
                  )}
                </div>

                <div style={{
                  background: '#0f172a',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  padding: '14px',
                  maxHeight: '380px',
                  overflowY: 'auto',
                  fontFamily: 'var(--font-mono)',
                  fontSize: '0.78rem',
                  color: cypherResult.success ? '#94a3b8' : '#f87171'
                }}>
                  <pre>{JSON.stringify(cypherResult.records || cypherResult.error, null, 2)}</pre>
                </div>
              </div>
            )}
          </div>
        )}

      </main>

      {/* Node Details Drawer Modal */}
      <NodeDetailsModal
        node={selectedNode}
        onClose={() => setSelectedNode(null)}
        onQueryRelated={(label) => {
          setSelectedNode(null);
          setActiveTab('chat');
        }}
      />

      {/* Config / Credentials Modal */}
      <ConfigModal
        isOpen={isConfigOpen}
        onClose={() => setIsConfigOpen(false)}
        config={config}
        onSaveConfig={(newConfig) => {
          setConfig(newConfig);
          checkNeo4jAndLoadData(newConfig);
        }}
        onNeo4jConnected={(status) => {
          setNeo4jStatus(status);
        }}
      />

    </div>
  );
}
