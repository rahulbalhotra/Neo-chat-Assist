import React, { useEffect, useRef, useState, useMemo } from 'react';
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

// Curated pastel/vibrant palette for universal dynamic node categories
const CATEGORY_PALETTES = [
  { bg: '#e0f2fe', border: '#0284c7', text: '#0369a1' }, // Sky
  { bg: '#ecfdf5', border: '#059669', text: '#047857' }, // Emerald
  { bg: '#f5f3ff', border: '#7c3aed', text: '#6d28d9' }, // Violet
  { bg: '#fffbeb', border: '#d97706', text: '#b45309' }, // Amber
  { bg: '#fdf2f8', border: '#db2777', text: '#be185d' }, // Pink
  { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' }, // Green
  { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c' }, // Red
  { bg: '#ecfeff', border: '#0891b2', text: '#0e7490' }, // Cyan
  { bg: '#f8fafc', border: '#475569', text: '#334155' }  // Slate
];

function getCategoryColor(category = 'Entity') {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = category.charCodeAt(i) + ((hash << 5) - hash);
  }
  const idx = Math.abs(hash) % CATEGORY_PALETTES.length;
  return CATEGORY_PALETTES[idx];
}

export default function GraphViewer({ 
  graphData, 
  onSelectNode, 
  highlightNodeNames = [],
  loading 
}) {
  const containerRef = useRef(null);
  const networkRef = useRef(null);
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [physicsEnabled, setPhysicsEnabled] = useState(true);

  // Discover distinct categories present in active graph
  const availableCategories = useMemo(() => {
    if (!graphData?.nodes) return [];
    const cats = new Set();
    graphData.nodes.forEach(n => {
      const c = n.category || (n.properties?.classification) || 'Entity';
      if (c) cats.add(c);
    });
    return Array.from(cats);
  }, [graphData]);

  // Helper to determine node visual appearance
  const getNodeStyle = (rawNode) => {
    const label = rawNode.label || rawNode.id;
    const cat = rawNode.category || 'Entity';
    const props = rawNode.properties || {};
    const cls = (props.classification || '').toUpperCase();

    // Strategic Classification hubs
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

    // Application portfolio nodes
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

    // Dynamic Universal Entity styling
    const palette = getCategoryColor(cat);
    return {
      color: { 
        background: palette.bg, 
        border: palette.border, 
        highlight: { background: '#ffffff', border: palette.border } 
      },
      shape: 'box',
      borderWidth: 1.5,
      margin: 8,
      font: { color: palette.text, size: 12, bold: true }
    };
  };

  useEffect(() => {
    if (!containerRef.current || !graphData || !graphData.nodes || graphData.nodes.length === 0) {
      return;
    }

    // Apply filtering
    let filteredNodes = graphData.nodes;
    if (filterCategory !== 'ALL') {
      filteredNodes = graphData.nodes.filter(n => {
        const cat = n.category || (n.properties?.classification) || '';
        return cat.toUpperCase() === filterCategory.toUpperCase() || n.label === filterCategory;
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
  }, [graphData, filterCategory, (highlightNodeNames || []).join(','), physicsEnabled]);

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
        
        {/* Left: Dynamic Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Filter size={14} /> Category:
          </span>

          <button
            id="filter-all-btn"
            type="button"
            className="btn"
            onClick={() => setFilterCategory('ALL')}
            style={{
              padding: '4px 10px',
              fontSize: '0.75rem',
              borderRadius: '6px',
              background: filterCategory === 'ALL' ? '#0f172a' : '#f1f5f9',
              color: filterCategory === 'ALL' ? '#ffffff' : '#475569',
              border: '1px solid #cbd5e1'
            }}
          >
            All Entities ({graphData?.nodes?.length || 0})
          </button>

          {availableCategories.slice(0, 6).map(cat => {
            const isSelected = filterCategory.toUpperCase() === cat.toUpperCase();
            const palette = getCategoryColor(cat);
            return (
              <button
                key={cat}
                type="button"
                className="btn"
                onClick={() => setFilterCategory(cat)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.75rem',
                  borderRadius: '6px',
                  background: isSelected ? palette.border : palette.bg,
                  color: isSelected ? '#ffffff' : palette.text,
                  border: `1px solid ${palette.border}`
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Right: Search & Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '10px' }} />
              <input
                id="search-graph-input"
                type="text"
                placeholder="Find node or entity..."
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

      {/* Dynamic Floating Legend */}
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
        flexWrap: 'wrap',
        gap: '12px',
        pointerEvents: 'none',
        zIndex: 10,
        boxShadow: 'var(--shadow-md)',
        color: '#334155'
      }}>
        <span style={{ fontWeight: '600', color: '#64748b' }}>Entity Legend:</span>
        {availableCategories.slice(0, 5).map(cat => {
          const palette = getCategoryColor(cat);
          return (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '10px', height: '10px', background: palette.border, borderRadius: '2px', display: 'inline-block' }} />
              <span>{cat}</span>
            </div>
          );
        })}
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
            Upload any Excel spreadsheet or load one of the built-in samples to construct your interactive Neo4j Knowledge Graph.
          </p>
        </div>
      )}

    </div>
  );
}
