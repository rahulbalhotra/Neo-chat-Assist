import React, { useEffect, useRef, useState } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Filter, 
  Search, 
  Play, 
  Pause, 
  Layers, 
  Info,
  Sparkles
} from 'lucide-react';

export default function GraphViewer({ 
  graphData, 
  onSelectNode, 
  highlightNodeNames = [],
  loading 
}) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [filterClass, setFilterClass] = useState('ALL'); // 'ALL' | 'RETAIN' | 'RETIRE' | 'OPTIMIZE'
  const [searchQuery, setSearchQuery] = useState('');
  const [physicsEnabled, setPhysicsEnabled] = useState(true);

  // Helper to determine node visual appearance
  const getNodeStyle = (rawNode) => {
    const label = rawNode.label || rawNode.id;
    const cat = rawNode.category || 'Application';
    const props = rawNode.properties || {};
    const cls = (props.classification || '').toUpperCase();

    // Classification hubs
    if (cat === 'Classification' || label === 'RETAIN' || label === 'RETIRE' || label === 'OPTIMIZE') {
      if (label === 'RETAIN') {
        return {
          color: { background: '#10b981', border: '#047857', highlight: { background: '#059669', border: '#065f46' } },
          shape: 'diamond',
          size: 38,
          font: { color: '#ffffff', size: 14, bold: true }
        };
      }
      if (label === 'RETIRE') {
        return {
          color: { background: '#ef4444', border: '#b91c1c', highlight: { background: '#dc2626', border: '#991b1b' } },
          shape: 'diamond',
          size: 38,
          font: { color: '#ffffff', size: 14, bold: true }
        };
      }
      if (label === 'OPTIMIZE') {
        return {
          color: { background: '#f59e0b', border: '#b45309', highlight: { background: '#d97706', border: '#78350f' } },
          shape: 'diamond',
          size: 38,
          font: { color: '#ffffff', size: 14, bold: true }
        };
      }
    }

    // Application nodes
    if (cat === 'Application') {
      let bg = '#ffffff';
      let border = '#008cc1';
      let fontColor = '#0f172a';

      if (cls === 'RETAIN') {
        bg = '#ecfdf5';
        border = '#10b981';
        fontColor = '#065f46';
      } else if (cls === 'RETIRE') {
        bg = '#fef2f2';
        border = '#ef4444';
        fontColor = '#991b1b';
      } else if (cls === 'OPTIMIZE') {
        bg = '#fffbeb';
        border = '#f59e0b';
        fontColor = '#92400e';
      }

      return {
        color: { background: bg, border: border, highlight: { background: '#e0f2fe', border: '#008cc1' } },
        shape: 'box',
        borderWidth: 2,
        margin: 10,
        font: { color: fontColor, size: 13, bold: true }
      };
    }

    // Department nodes
    if (cat === 'Department') {
      return {
        color: { background: '#eff6ff', border: '#3b82f6', highlight: { background: '#dbeafe', border: '#1d4ed8' } },
        shape: 'ellipse',
        size: 26,
        font: { color: '#1e40af', size: 12, bold: true }
      };
    }

    // Technology nodes
    if (cat === 'Technology') {
      const isLegacy = props.isLegacy;
      return {
        color: { 
          background: isLegacy ? '#fef2f2' : '#f5f3ff', 
          border: isLegacy ? '#ef4444' : '#8b5cf6', 
          highlight: { background: isLegacy ? '#fee2e2' : '#ede9fe', border: isLegacy ? '#dc2626' : '#7c3aed' } 
        },
        shape: 'ellipse',
        size: 20,
        font: { color: isLegacy ? '#991b1b' : '#6b21a8', size: 11 }
      };
    }

    // Platform nodes
    if (cat === 'Platform') {
      return {
        color: { background: '#ecfeff', border: '#06b6d4', highlight: { background: '#cffafe', border: '#0891b2' } },
        shape: 'box',
        margin: 8,
        font: { color: '#0e7490', size: 11, bold: true }
      };
    }

    // Default
    return {
      color: { background: '#f1f5f9', border: '#cbd5e1' },
      shape: 'dot',
      size: 16,
      font: { color: '#334155', size: 11 }
    };
  };

  useEffect(() => {
    if (!containerRef.current || !graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return;
    }

    // Apply filtering
    let filteredNodes = graphData.nodes;
    if (filterClass !== 'ALL') {
      filteredNodes = graphData.nodes.filter(n => {
        if (n.category === 'Classification') return n.label === filterClass;
        if (n.category === 'Application') {
          return (n.properties?.classification || '').toUpperCase() === filterClass;
        }
        return true;
      });
    }

    // Convert nodes to Vis format
    const visNodes = filteredNodes.map(n => {
      const style = getNodeStyle(n);
      const isHighlighted = highlightNodeNames.some(hn => 
        (n.label || '').toLowerCase().includes(hn.toLowerCase())
      );

      return {
        id: n.id,
        label: n.label,
        title: `${n.category}: ${n.label}${n.properties?.annualCost ? `\nCost: $${Number(n.properties.annualCost).toLocaleString()}` : ''}`,
        ...style,
        borderWidth: isHighlighted ? 4 : style.borderWidth || 1,
        color: isHighlighted ? { background: '#fef08a', border: '#ca8a04' } : style.color,
        rawNode: n
      };
    });

    const activeNodeIds = new Set(visNodes.map(n => n.id));
    const visEdges = (graphData.edges || [])
      .filter(e => activeNodeIds.has(e.from) && activeNodeIds.has(e.to))
      .map(e => ({
        id: e.id,
        from: e.from,
        to: e.to,
        label: e.label,
        arrows: 'to',
        color: { color: '#94a3b8', highlight: '#008cc1' },
        font: { color: '#64748b', size: 10, align: 'middle' },
        smooth: { type: 'continuous', roundness: 0.2 }
      }));

    const data = {
      nodes: new DataSet(visNodes),
      edges: new DataSet(visEdges)
    };

    const options = {
      nodes: {
        shadow: { enabled: true, color: 'rgba(0,0,0,0.06)', size: 8, x: 2, y: 2 }
      },
      edges: {
        width: 1.5,
        shadow: false
      },
      physics: {
        enabled: physicsEnabled,
        barnesHut: {
          gravitationalConstant: -3500,
          centralGravity: 0.35,
          springLength: 95,
          springConstant: 0.04,
          damping: 0.09
        },
        stabilization: { iterations: 150 }
      },
      interaction: {
        hover: true,
        tooltipDelay: 100,
        zoomView: true,
        dragView: true,
        navigationButtons: false
      }
    };

    const network = new Network(containerRef.current, data, options);
    networkRef.current = network;

    // Node selection click handler
    network.on('click', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        const selectedId = params.nodes[0];
        const selectedNode = visNodes.find(n => n.id === selectedId);
        if (selectedNode && onSelectNode) {
          onSelectNode(selectedNode.rawNode);
        }
      }
    });

    return () => {
      network.destroy();
    };
  }, [graphData, filterClass, (highlightNodeNames || []).join(','), physicsEnabled]);

  const handleZoomIn = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 1.3, animation: { duration: 250 } });
    }
  };

  const handleZoomOut = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 0.7, animation: { duration: 250 } });
    }
  };

  const handleFit = () => {
    if (networkRef.current) {
      networkRef.current.fit({ animation: { duration: 400 } });
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    if (!searchQuery.trim() || !networkRef.current || !graphData?.nodes) return;
    
    const target = graphData.nodes.find(n => 
      (n.label || '').toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (target) {
      networkRef.current.focus(target.id, {
        scale: 1.2,
        animation: { duration: 500, easingFunction: 'easeInOutQuad' }
      });
      networkRef.current.selectNodes([target.id]);
      if (onSelectNode) {
        onSelectNode(target);
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative', background: '#ffffff' }}>
      
      {/* Top Toolbar */}
      <div style={{
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff'
      }}>
        
        {/* Left: Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={14} /> Filter:
          </span>

          <button
            id="filter-all-btn"
            type="button"
            className="btn"
            onClick={() => setFilterClass('ALL')}
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              background: filterClass === 'ALL' ? '#e2e8f0' : 'transparent',
              color: filterClass === 'ALL' ? '#0f172a' : '#64748b',
              border: '1px solid #cbd5e1'
            }}
          >
            All Nodes
          </button>

          <button
            id="filter-retain-btn"
            type="button"
            className="btn"
            onClick={() => setFilterClass('RETAIN')}
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              background: filterClass === 'RETAIN' ? 'var(--retain-bg)' : 'transparent',
              color: 'var(--retain-green)',
              border: filterClass === 'RETAIN' ? '1px solid var(--retain-green)' : '1px solid #cbd5e1'
            }}
          >
            Retain
          </button>

          <button
            id="filter-retire-btn"
            type="button"
            className="btn"
            onClick={() => setFilterClass('RETIRE')}
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              background: filterClass === 'RETIRE' ? 'var(--retire-bg)' : 'transparent',
              color: 'var(--retire-red)',
              border: filterClass === 'RETIRE' ? '1px solid var(--retire-red)' : '1px solid #cbd5e1'
            }}
          >
            Retire
          </button>

          <button
            id="filter-optimize-btn"
            type="button"
            className="btn"
            onClick={() => setFilterClass('OPTIMIZE')}
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              background: filterClass === 'OPTIMIZE' ? 'var(--optimize-bg)' : 'transparent',
              color: 'var(--optimize-amber)',
              border: filterClass === 'OPTIMIZE' ? '1px solid var(--optimize-amber)' : '1px solid #cbd5e1'
            }}
          >
            Optimize
          </button>
        </div>

        {/* Right: Search & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                id="search-graph-input"
                type="text"
                placeholder="Find application, tech..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', width: '210px', height: '32px', fontSize: '0.8rem', background: '#ffffff', borderColor: '#cbd5e1' }}
              />
            </div>
            <button id="search-graph-submit" type="submit" className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '0.78rem' }}>
              Focus
            </button>
          </form>

          {/* Physics toggle */}
          <button
            id="toggle-physics-btn"
            type="button"
            className="btn btn-outline"
            onClick={() => setPhysicsEnabled(!physicsEnabled)}
            title={physicsEnabled ? 'Pause physics layout' : 'Resume organic physics layout'}
            style={{ padding: '6px 10px', fontSize: '0.78rem' }}
          >
            {physicsEnabled ? <Pause size={14} /> : <Play size={14} />}
            <span>{physicsEnabled ? 'Pause' : 'Float'}</span>
          </button>

          {/* Zoom controls */}
          <button id="zoom-in-btn" type="button" className="btn btn-outline" onClick={handleZoomIn} style={{ padding: '6px 8px' }}>
            <ZoomIn size={14} />
          </button>
          <button id="zoom-out-btn" type="button" className="btn btn-outline" onClick={handleZoomOut} style={{ padding: '6px 8px' }}>
            <ZoomOut size={14} />
          </button>
          <button id="fit-graph-btn" type="button" className="btn btn-outline" onClick={handleFit} style={{ padding: '6px 8px' }} title="Fit to Screen">
            <Maximize2 size={14} />
          </button>
        </div>

      </div>

      {/* Vis Network Container */}
      <div 
        ref={containerRef} 
        style={{ 
          flex: 1, 
          width: '100%', 
          minHeight: '520px', 
          background: '#ffffff',
          cursor: 'grab' 
        }} 
      />

      {/* Floating Legend */}
      <div style={{
        position: 'absolute',
        bottom: '16px',
        left: '20px',
        background: 'rgba(255, 255, 255, 0.95)',
        backdropFilter: 'blur(10px)',
        border: '1px solid #e2e8f0',
        borderRadius: '8px',
        padding: '10px 14px',
        fontSize: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        pointerEvents: 'none',
        zIndex: 10,
        boxShadow: 'var(--shadow-md)',
        color: '#334155'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', background: '#10b981', borderRadius: '2px', display: 'inline-block' }} />
          <span>Retain App</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', background: '#ef4444', borderRadius: '2px', display: 'inline-block' }} />
          <span>Retire App</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', background: '#f59e0b', borderRadius: '2px', display: 'inline-block' }} />
          <span>Optimize App</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', background: '#3b82f6', borderRadius: '50%', display: 'inline-block' }} />
          <span>Department</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '10px', height: '10px', background: '#8b5cf6', borderRadius: '50%', display: 'inline-block' }} />
          <span>Technology</span>
        </div>
      </div>

      {/* Empty State */}
      {(!graphData || !graphData.nodes || graphData.nodes.length === 0) && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#64748b'
        }}>
          <Layers size={48} color="#008cc1" style={{ opacity: 0.5, marginBottom: '12px' }} />
          <h3 style={{ fontSize: '1.1rem', color: '#0f172a' }}>No Graph Data Loaded Yet</h3>
          <p style={{ fontSize: '0.85rem', marginTop: '6px', maxWidth: '380px' }}>
            Upload your application portfolio Excel sheet or load the built-in 20-app sample to construct the Neo4j Knowledge Graph.
          </p>
        </div>
      )}

    </div>
  );
}
