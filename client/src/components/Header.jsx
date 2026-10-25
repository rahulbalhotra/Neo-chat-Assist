import React from 'react';
import { 
  Network, 
  Sparkles, 
  Cpu, 
  Settings, 
  RefreshCw, 
  Trash2, 
  CheckCircle2, 
  AlertCircle,
  Database
} from 'lucide-react';

export default function Header({ 
  config, 
  onConfigChange, 
  onOpenSettings, 
  neo4jStatus, 
  onRefresh, 
  onClearGraph,
  loading 
}) {
  const isAzure = config.provider === 'azure';

  return (
    <header className="glass-panel" style={{ margin: '16px 24px 0 24px', padding: '14px 24px', background: '#ffffff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
        
        {/* Brand / Title */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #008cc1 0%, #6366f1 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(0, 140, 193, 0.25)'
          }}>
            <Network size={24} color="#ffffff" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a' }}>
                Enterprise Graph Architect
              </h1>
              <span className="badge badge-neo4j" style={{ fontSize: '0.65rem' }}>
                Neo4j Desktop
              </span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
              LLM Application Portfolio Rationalization (Retain • Retire • Optimize)
            </p>
          </div>
        </div>

        {/* Center: Model Selector */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          background: '#f1f5f9',
          padding: '4px',
          borderRadius: '10px',
          border: '1px solid #e2e8f0',
          gap: '4px'
        }}>
          <button
            id="select-gemini-btn"
            type="button"
            className="btn"
            onClick={() => onConfigChange({ ...config, provider: 'gemini' })}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              borderRadius: '7px',
              background: !isAzure ? 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)' : 'transparent',
              color: !isAzure ? '#ffffff' : '#64748b',
              border: 'none',
              fontWeight: !isAzure ? '600' : '500',
              boxShadow: !isAzure ? '0 2px 6px rgba(99, 102, 241, 0.3)' : 'none'
            }}
          >
            <Sparkles size={14} color={!isAzure ? '#ffffff' : '#6366f1'} />
            Google Gemini
          </button>

          <button
            id="select-azure-btn"
            type="button"
            className="btn"
            onClick={() => onConfigChange({ ...config, provider: 'azure' })}
            style={{
              padding: '6px 14px',
              fontSize: '0.8rem',
              borderRadius: '7px',
              background: isAzure ? 'linear-gradient(135deg, #0078d4 0%, #005a9e 100%)' : 'transparent',
              color: isAzure ? '#ffffff' : '#64748b',
              border: 'none',
              fontWeight: isAzure ? '600' : '500',
              boxShadow: isAzure ? '0 2px 6px rgba(0, 120, 212, 0.3)' : 'none'
            }}
          >
            <Cpu size={14} color={isAzure ? '#ffffff' : '#0078d4'} />
            Azure OpenAI
          </button>
        </div>

        {/* Right Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          
          {/* Neo4j Desktop status pill */}
          <div 
            id="neo4j-status-pill"
            onClick={onOpenSettings}
            title={neo4jStatus?.connected ? `Connected to ${neo4jStatus.server || 'Neo4j Desktop'}` : `Disconnected: ${neo4jStatus?.error || 'Click to configure Neo4j Desktop'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '8px',
              background: neo4jStatus?.connected ? '#ecfdf5' : '#fef2f2',
              border: `1px solid ${neo4jStatus?.connected ? '#a7f3d0' : '#fecaca'}`,
              fontSize: '0.78rem',
              cursor: 'pointer'
            }}
          >
            <Database size={14} color={neo4jStatus?.connected ? '#059669' : '#dc2626'} />
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontWeight: '600', color: neo4jStatus?.connected ? '#047857' : '#b91c1c' }}>
                {neo4jStatus?.connected ? 'Neo4j Desktop Online' : 'Neo4j Offline'}
              </span>
              <span style={{ fontSize: '0.68rem', color: '#64748b' }}>
                {config.neo4jUri || 'bolt://localhost:7687'}
              </span>
            </div>
            {neo4jStatus?.connected ? (
              <CheckCircle2 size={13} color="#059669" />
            ) : (
              <AlertCircle size={13} color="#dc2626" />
            )}
          </div>

          {/* Refresh Graph */}
          <button
            id="refresh-graph-btn"
            type="button"
            className="btn btn-outline"
            onClick={onRefresh}
            disabled={loading}
            title="Refresh Knowledge Graph and Metrics"
            style={{ padding: '8px 12px' }}
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>

          {/* Clear Graph */}
          <button
            id="clear-graph-btn"
            type="button"
            className="btn btn-danger"
            onClick={onClearGraph}
            title="Clear Current Graph Data in Neo4j"
            style={{ padding: '8px 12px' }}
          >
            <Trash2 size={15} />
          </button>

          {/* Settings modal trigger */}
          <button
            id="open-settings-btn"
            type="button"
            className="btn btn-outline"
            onClick={onOpenSettings}
            title="Configure Azure OpenAI, Gemini, and Neo4j Desktop credentials"
            style={{ padding: '8px 14px', gap: '6px' }}
          >
            <Settings size={15} />
            <span>Settings</span>
          </button>
        </div>

      </div>
    </header>
  );
}
