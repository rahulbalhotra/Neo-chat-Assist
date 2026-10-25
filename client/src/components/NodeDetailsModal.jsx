import React from 'react';
import { 
  X, 
  Layers, 
  DollarSign, 
  ShieldAlert, 
  Cloud, 
  Users, 
  Building, 
  Cpu, 
  FileText, 
  ExternalLink,
  Target
} from 'lucide-react';

export default function NodeDetailsModal({ node, onClose, onQueryRelated }) {
  if (!node) return null;

  const props = node.properties || {};
  const category = node.category || 'Node';
  const label = node.label || node.id;
  const classification = (props.classification || '').toUpperCase();

  const getBadgeClass = (cls) => {
    if (cls === 'RETAIN') return 'badge-retain';
    if (cls === 'RETIRE') return 'badge-retire';
    if (cls === 'OPTIMIZE') return 'badge-optimize';
    return 'badge-neo4j';
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      right: 0,
      bottom: 0,
      width: '420px',
      maxWidth: '100vw',
      background: '#ffffff',
      borderLeft: '1px solid #e2e8f0',
      boxShadow: '-8px 0 30px rgba(15, 23, 42, 0.1)',
      zIndex: 9000,
      display: 'flex',
      flexDirection: 'column',
      animation: 'slideInRight 0.25s ease'
    }}>
      {/* Drawer Header */}
      <div style={{
        padding: '18px 20px',
        borderBottom: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#ffffff'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span className="badge badge-neo4j" style={{ fontSize: '0.68rem' }}>
            {category}
          </span>
          {classification && (
            <span className={`badge ${getBadgeClass(classification)}`} style={{ fontSize: '0.68rem' }}>
              {classification}
            </span>
          )}
        </div>

        <button 
          id="close-node-details-btn"
          onClick={onClose} 
          className="btn btn-outline" 
          style={{ padding: '6px' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Drawer Content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '20px', display: 'flex', flexDirection: 'column', gap: '18px', background: '#ffffff' }}>
        
        {/* Node Title */}
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: '700', color: '#0f172a', lineHeight: 1.3 }}>
            {label}
          </h2>
          {props.vendor && (
            <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
              Vendor: <strong style={{ color: '#0f172a' }}>{props.vendor}</strong>
            </div>
          )}
        </div>

        {/* Rationalization Decision Card */}
        {(props.rationale || props.actionPlan) && (
          <div className="glass-panel" style={{
            padding: '14px 16px',
            borderLeft: `4px solid ${classification === 'RETIRE' ? 'var(--retire-red)' : classification === 'OPTIMIZE' ? 'var(--optimize-amber)' : 'var(--retain-green)'}`,
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderLeftWidth: '4px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', fontWeight: '700', color: '#0f172a', textTransform: 'uppercase', marginBottom: '6px' }}>
              <Target size={14} color={classification === 'RETIRE' ? '#dc2626' : classification === 'OPTIMIZE' ? '#d97706' : '#059669'} />
              LLM Rationalization Assessment
            </div>
            {props.rationale && (
              <p style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.5, marginBottom: '8px' }}>
                {props.rationale}
              </p>
            )}
            {props.actionPlan && (
              <div style={{ fontSize: '0.78rem', color: '#475569', background: '#f1f5f9', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
                <strong style={{ color: '#008cc1' }}>Action Plan: </strong>
                {props.actionPlan}
              </div>
            )}
          </div>
        )}

        {/* Metrics Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
          {props.annualCost !== undefined && (
            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Annual Maintenance</div>
              <div style={{ fontSize: '1rem', fontWeight: '700', color: '#059669', marginTop: '2px' }}>
                ${Number(props.annualCost).toLocaleString()}
              </div>
            </div>
          )}

          {props.businessCriticality && (
            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Criticality</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                {props.businessCriticality}
              </div>
            </div>
          )}

          {props.architectureHealth && (
            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Tech Health</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: props.architectureHealth.includes('EOL') ? '#dc2626' : '#0f172a', marginTop: '2px' }}>
                {props.architectureHealth}
              </div>
            </div>
          )}

          {props.cloudReadiness && (
            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Cloud Readiness</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0284c7', marginTop: '2px' }}>
                {props.cloudReadiness}
              </div>
            </div>
          )}

          {props.activeUsers !== undefined && (
            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Active Users</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                {Number(props.activeUsers).toLocaleString()}
              </div>
            </div>
          )}

          {props.department && (
            <div style={{ background: '#f8fafc', padding: '10px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
              <div style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>Department</div>
              <div style={{ fontSize: '0.9rem', fontWeight: '600', color: '#0f172a', marginTop: '2px' }}>
                {props.department}
              </div>
            </div>
          )}
        </div>

        {/* Hosting / Platform */}
        {props.hosting && (
          <div style={{ fontSize: '0.82rem', color: '#475569' }}>
            <strong>Hosting Platform:</strong> <span style={{ color: '#0f172a', fontWeight: '500' }}>{props.hosting}</span>
          </div>
        )}

        {/* Description */}
        {props.description && (
          <div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', marginBottom: '4px', fontWeight: '600' }}>
              System Description
            </div>
            <p style={{ fontSize: '0.82rem', color: '#334155', lineHeight: 1.5 }}>
              {props.description}
            </p>
          </div>
        )}

        {/* Raw properties viewer */}
        <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid #e2e8f0' }}>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginBottom: '6px' }}>
            Neo4j Node ID: <code>{node.id}</code>
          </div>
          <button
            id="query-subgraph-btn"
            type="button"
            className="btn btn-outline"
            onClick={() => onQueryRelated && onQueryRelated(label)}
            style={{ width: '100%', fontSize: '0.8rem', gap: '6px', background: '#f8fafc' }}
          >
            <ExternalLink size={14} />
            Ask Chat about {label}
          </button>
        </div>

      </div>
    </div>
  );
}
