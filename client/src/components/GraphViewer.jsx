import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { Network } from 'vis-network';
import { DataSet } from 'vis-data';
import { 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2,
  Filter, 
  Search, 
  Play, 
  Pause, 
  Layers, 
  Info,
  Sparkles,
  Sliders,
  Crosshair,
  RefreshCw,
  GitBranch,
  Grid
} from 'lucide-react';

// Curated harmonious palettes for dynamic entity categories
const CATEGORY_PALETTES = [
  { bg: '#e0f2fe', border: '#0284c7', text: '#0369a1' }, // Sky Blue
  { bg: '#ecfdf5', border: '#059669', text: '#047857' }, // Emerald
  { bg: '#f5f3ff', border: '#7c3aed', text: '#6d28d9' }, // Violet
  { bg: '#fffbeb', border: '#d97706', text: '#b45309' }, // Amber
  { bg: '#fdf2f8', border: '#db2777', text: '#be185d' }, // Pink
  { bg: '#f0fdf4', border: '#16a34a', text: '#15803d' }, // Forest Green
  { bg: '#fef2f2', border: '#dc2626', text: '#b91c1c' }, // Rose Red
  { bg: '#ecfeff', border: '#0891b2', text: '#0e7490' }, // Cyan
  { bg: '#f8fafc', border: '#475569', text: '#1e293b' }  // Slate
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
  const wrapperRef = useRef(null);
  const networkRef = useRef(null);
  
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [physicsEnabled, setPhysicsEnabled] = useState(true);
  const [spreadMode, setSpreadMode] = useState('spacious'); // 'compact' | 'spacious' | 'panoramic'
  const [layoutMode, setLayoutMode] = useState('organic'); // 'organic' | 'hierarchical'
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedNodeDetails, setSelectedNodeDetails] = useState(null);

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

  // Spring & repulsion values based on spreadMode
  const physicsParams = useMemo(() => {
    if (spreadMode === 'compact') {
      return { springLength: 140, gravitationalConstant: -10000, centralGravity: 0.12 };
    }
    if (spreadMode === 'panoramic') {
      return { springLength: 320, gravitationalConstant: -28000, centralGravity: 0.04 };
    }
    // 'spacious' default: generous spread, no overlapping, beautiful distribution
    return { springLength: 220, gravitationalConstant: -18000, centralGravity: 0.07 };
  }, [spreadMode]);

  // Node visual appearance builder
  const getNodeStyle = useCallback((rawNode) => {
    const label = rawNode.label || rawNode.id;
    const cat = rawNode.category || 'Entity';
    const props = rawNode.properties || {};
    const cls = (props.classification || '').toUpperCase();

    // Strategic Classification Core Hubs
    if (cat === 'Classification' || label === 'RETAIN' || label === 'RETIRE' || label === 'OPTIMIZE') {
      if (label === 'RETAIN') {
        return {
          color: { background: '#10b981', border: '#047857', highlight: { background: '#059669', border: '#065f46' } },
          shape: 'diamond',
          size: 44,
          font: { color: '#ffffff', size: 15, bold: true, face: 'Inter, system-ui, sans-serif' }
        };
      }
      if (label === 'RETIRE') {
        return {
          color: { background: '#ef4444', border: '#b91c1c', highlight: { background: '#dc2626', border: '#991b1b' } },
          shape: 'diamond',
          size: 44,
          font: { color: '#ffffff', size: 15, bold: true, face: 'Inter, system-ui, sans-serif' }
        };
      }
      if (label === 'OPTIMIZE') {
        return {
          color: { background: '#f59e0b', border: '#b45309', highlight: { background: '#d97706', border: '#78350f' } },
          shape: 'diamond',
          size: 44,
          font: { color: '#ffffff', size: 15, bold: true, face: 'Inter, system-ui, sans-serif' }
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
        color: { background: bg, border: border, highlight: { background: '#f0f9ff', border: '#0284c7' } },
        shape: 'box',
        shapeProperties: { borderRadius: 8 },
        borderWidth: 2,
        margin: { top: 9, bottom: 9, left: 14, right: 14 },
        font: { color: fontColor, size: 13, bold: true, face: 'Inter, system-ui, sans-serif' }
      };
    }

    // Document nodes (File provenance)
    if (cat === 'Document') {
      return {
        color: { background: '#0f172a', border: '#0284c7', highlight: { background: '#1e293b', border: '#38bdf8' } },
        shape: 'box',
        shapeProperties: { borderRadius: 10 },
        borderWidth: 2.5,
        margin: { top: 10, bottom: 10, left: 16, right: 16 },
        font: { color: '#ffffff', size: 13, bold: true, face: 'Inter, system-ui, sans-serif' }
      };
    }

    // Chunk nodes (Semantic partition)
    if (cat === 'Chunk') {
      return {
        color: { background: '#fef3c7', border: '#d97706', highlight: { background: '#fef9c3', border: '#b45309' } },
        shape: 'box',
        shapeProperties: { borderRadius: 6 },
        borderWidth: 1.5,
        margin: { top: 6, bottom: 6, left: 10, right: 10 },
        font: { color: '#92400e', size: 11, bold: true, face: 'Inter, system-ui, sans-serif' }
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
      shapeProperties: { borderRadius: 8 },
      borderWidth: 2,
      margin: { top: 8, bottom: 8, left: 12, right: 12 },
      font: { color: palette.text, size: 12, bold: true, face: 'Inter, system-ui, sans-serif' }
    };
  }, []);

  // Initialize or re-render Vis Network
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
        title: `${n.category}: ${n.label}${n.properties?.annualCost ? `\nAnnual Cost: $${Number(n.properties.annualCost).toLocaleString()}` : ''}${n.properties?.summary ? `\nSummary: ${n.properties.summary}` : ''}`,
        ...style,
        borderWidth: isHighlighted ? 4 : style.borderWidth || 2,
        color: isHighlighted 
          ? { background: '#fef08a', border: '#ca8a04', highlight: { background: '#fef9c3', border: '#a16207' } } 
          : style.color,
        rawNode: n
      };
    });

    const activeNodeIds = new Set(visNodes.map(n => n.id));
    const visEdges = (graphData.edges || [])
      .filter(e => activeNodeIds.has(e.from) && activeNodeIds.has(e.to))
      .map(e => {
        const isShares = e.label?.includes('SHARES') || e.type === 'SHARES_ENTITIES';
        const isHasChunk = e.label === 'HAS_CHUNK';
        const isExtracts = e.label === 'EXTRACTS' || e.label === 'EXTRACTS_ENTITY';

        let edgeColor = '#94a3b8';
        let dashes = false;
        let width = 1.6;

        if (isShares) {
          edgeColor = '#059669';
          width = 3.2;
        } else if (isHasChunk) {
          edgeColor = '#0284c7';
          dashes = [4, 4];
        } else if (isExtracts) {
          edgeColor = '#d97706';
          dashes = [2, 4];
        }

        return {
          id: e.id,
          from: e.from,
          to: e.to,
          label: e.label,
          dashes,
          width,
          arrows: {
            to: { enabled: true, scaleFactor: isShares ? 0.9 : 0.65 }
          },
          color: { 
            color: edgeColor, 
            highlight: '#0284c7',
            hover: '#0ea5e9'
          },
          font: { 
            color: isShares ? '#059669' : '#475569', 
            size: 10, 
            align: 'middle',
            background: '#ffffff',
            strokeWidth: 2,
            strokeColor: '#ffffff'
          },
          smooth: { type: 'continuous', roundness: 0.25 }
        };
      });

    const data = {
      nodes: new DataSet(visNodes),
      edges: new DataSet(visEdges)
    };

    // Layout configuration
    const layoutConfig = layoutMode === 'hierarchical' ? {
      hierarchical: {
        enabled: true,
        direction: 'UD',
        sortMethod: 'directed',
        nodeSpacing: 220,
        levelSeparation: 180,
        treeSpacing: 200
      }
    } : {
      hierarchical: { enabled: false },
      improvedLayout: true
    };

    const options = {
      layout: layoutConfig,
      nodes: {
        shadow: { 
          enabled: true, 
          color: 'rgba(15, 23, 42, 0.08)', 
          size: 8, 
          x: 0, 
          y: 3 
        }
      },
      edges: {
        width: 1.6,
        shadow: false
      },
      physics: {
        enabled: physicsEnabled && layoutMode !== 'hierarchical',
        solver: 'barnesHut',
        barnesHut: {
          gravitationalConstant: physicsParams.gravitationalConstant,
          centralGravity: physicsParams.centralGravity,
          springLength: physicsParams.springLength,
          springConstant: 0.045,
          damping: 0.12,
          avoidOverlap: 1.0 // Strictly avoid overlapping node boxes!
        },
        stabilization: { 
          iterations: 200,
          updateInterval: 25,
          fit: true
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 80,
        zoomView: true,
        dragView: true,
        navigationButtons: false,
        keyboard: true
      }
    };

    const network = new Network(containerRef.current, data, options);
    networkRef.current = network;

    // Auto-fit to viewport nicely once graph stabilizes
    network.once('stabilizationIterationsDone', () => {
      network.fit({
        animation: { duration: 500, easingFunction: 'easeInOutQuad' }
      });
    });

    // Also auto-fit after brief drawing tick
    const fitTimer = setTimeout(() => {
      if (networkRef.current) {
        networkRef.current.fit({ animation: false });
      }
    }, 200);

    // Node click handler
    network.on('click', (params) => {
      if (params.nodes && params.nodes.length > 0) {
        const selectedId = params.nodes[0];
        const selectedNode = visNodes.find(n => n.id === selectedId);
        if (selectedNode) {
          setSelectedNodeDetails(selectedNode.rawNode);
          if (onSelectNode) {
            onSelectNode(selectedNode.rawNode);
          }
        }
      } else {
        setSelectedNodeDetails(null);
      }
    });

    return () => {
      clearTimeout(fitTimer);
      network.destroy();
    };
  }, [
    graphData, 
    filterCategory, 
    (highlightNodeNames || []).join(','), 
    physicsEnabled, 
    physicsParams, 
    layoutMode,
    getNodeStyle, 
    onSelectNode
  ]);

  const handleZoomIn = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 1.35, animation: { duration: 250 } });
    }
  };

  const handleZoomOut = () => {
    if (networkRef.current) {
      const scale = networkRef.current.getScale();
      networkRef.current.moveTo({ scale: scale * 0.72, animation: { duration: 250 } });
    }
  };

  const handleFit = () => {
    if (networkRef.current) {
      networkRef.current.fit({ animation: { duration: 500, easingFunction: 'easeInOutQuad' } });
    }
  };

  const handleReset = () => {
    if (networkRef.current) {
      setFilterCategory('ALL');
      setSearchQuery('');
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
        scale: 1.3,
        animation: { duration: 600, easingFunction: 'easeInOutQuad' }
      });
      networkRef.current.selectNodes([target.id]);
      setSelectedNodeDetails(target);
      if (onSelectNode) {
        onSelectNode(target);
      }
    }
  };

  return (
    <div 
      ref={wrapperRef}
      style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        height: isFullscreen ? '100vh' : 'calc(100vh - 270px)',
        minHeight: '680px',
        position: isFullscreen ? 'fixed' : 'relative', 
        top: isFullscreen ? 0 : 'auto',
        left: isFullscreen ? 0 : 'auto',
        right: isFullscreen ? 0 : 'auto',
        bottom: isFullscreen ? 0 : 'auto',
        zIndex: isFullscreen ? 9999 : 1,
        background: '#ffffff' 
      }}
    >
      
      {/* Top Interactive Toolbar */}
      <div style={{
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        borderBottom: '1px solid #e2e8f0',
        background: '#ffffff',
        zIndex: 10
      }}>
        
        {/* Left: Dynamic Entity Category Filter Chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: '600' }}>
            <Filter size={14} /> Filter:
          </span>

          <button
            id="filter-all-btn"
            type="button"
            className="btn"
            onClick={() => setFilterCategory('ALL')}
            style={{
              padding: '5px 12px',
              fontSize: '0.75rem',
              borderRadius: '20px',
              fontWeight: '600',
              background: filterCategory === 'ALL' ? '#0f172a' : '#f1f5f9',
              color: filterCategory === 'ALL' ? '#ffffff' : '#475569',
              border: '1px solid #cbd5e1',
              transition: 'all 0.15s ease'
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
                  padding: '5px 12px',
                  fontSize: '0.75rem',
                  borderRadius: '20px',
                  fontWeight: '600',
                  background: isSelected ? palette.border : palette.bg,
                  color: isSelected ? '#ffffff' : palette.text,
                  border: `1px solid ${palette.border}`,
                  transition: 'all 0.15s ease'
                }}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {/* Right: Layout, Spacing, Search & Navigation Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Spacing / Spread Mode Pill Selector */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            background: '#f1f5f9',
            padding: '3px',
            borderRadius: '8px',
            gap: '2px'
          }}>
            <span style={{ fontSize: '0.72rem', color: '#64748b', padding: '0 6px', fontWeight: '600' }}>
              Spread:
            </span>
            <button
              type="button"
              onClick={() => setSpreadMode('compact')}
              title="Compact spacing"
              style={{
                border: 'none',
                background: spreadMode === 'compact' ? '#ffffff' : 'transparent',
                color: spreadMode === 'compact' ? '#0f172a' : '#64748b',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: spreadMode === 'compact' ? '700' : '500',
                cursor: 'pointer',
                boxShadow: spreadMode === 'compact' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Compact
            </button>
            <button
              type="button"
              onClick={() => setSpreadMode('spacious')}
              title="Spacious open layout (Recommended)"
              style={{
                border: 'none',
                background: spreadMode === 'spacious' ? '#ffffff' : 'transparent',
                color: spreadMode === 'spacious' ? '#008cc1' : '#64748b',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: spreadMode === 'spacious' ? '700' : '500',
                cursor: 'pointer',
                boxShadow: spreadMode === 'spacious' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Spacious
            </button>
            <button
              type="button"
              onClick={() => setSpreadMode('panoramic')}
              title="Wide panoramic layout"
              style={{
                border: 'none',
                background: spreadMode === 'panoramic' ? '#ffffff' : 'transparent',
                color: spreadMode === 'panoramic' ? '#0f172a' : '#64748b',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '0.72rem',
                fontWeight: spreadMode === 'panoramic' ? '700' : '500',
                cursor: 'pointer',
                boxShadow: spreadMode === 'panoramic' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none'
              }}
            >
              Panoramic
            </button>
          </div>

          {/* Layout Mode Toggle */}
          <button
            type="button"
            className="btn btn-outline"
            onClick={() => setLayoutMode(layoutMode === 'organic' ? 'hierarchical' : 'organic')}
            title={layoutMode === 'organic' ? 'Switch to Top-to-Bottom Tree layout' : 'Switch to Organic Force layout'}
            style={{ padding: '6px 10px', fontSize: '0.75rem', gap: '5px' }}
          >
            {layoutMode === 'organic' ? <GitBranch size={13} /> : <Grid size={13} />}
            <span>{layoutMode === 'organic' ? 'Organic' : 'Tree'}</span>
          </button>

          {/* Search Node */}
          <form onSubmit={handleSearch} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ position: 'relative' }}>
              <Search size={14} color="#64748b" style={{ position: 'absolute', left: '10px', top: '9px' }} />
              <input
                id="search-graph-input"
                type="text"
                placeholder="Find node or entity..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ paddingLeft: '32px', width: '190px', height: '32px', fontSize: '0.78rem', background: '#ffffff', borderColor: '#cbd5e1' }}
              />
            </div>
            <button id="search-graph-submit" type="submit" className="btn btn-outline" style={{ padding: '6px 10px', fontSize: '0.75rem' }}>
              Focus
            </button>
          </form>

          {/* Physics Float/Pause */}
          <button
            id="toggle-physics-btn"
            type="button"
            className="btn btn-outline"
            onClick={() => setPhysicsEnabled(!physicsEnabled)}
            title={physicsEnabled ? 'Freeze physics simulation' : 'Unfreeze organic physics floating'}
            style={{ padding: '6px 10px', fontSize: '0.75rem' }}
          >
            {physicsEnabled ? <Pause size={13} /> : <Play size={13} />}
            <span>{physicsEnabled ? 'Freeze' : 'Float'}</span>
          </button>

          {/* Zoom controls & Fit */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button id="zoom-in-btn" type="button" className="btn btn-outline" onClick={handleZoomIn} style={{ padding: '6px 8px' }} title="Zoom In">
              <ZoomIn size={14} />
            </button>
            <button id="zoom-out-btn" type="button" className="btn btn-outline" onClick={handleZoomOut} style={{ padding: '6px 8px' }} title="Zoom Out">
              <ZoomOut size={14} />
            </button>
            <button id="fit-graph-btn" type="button" className="btn btn-outline" onClick={handleFit} style={{ padding: '6px 10px', fontSize: '0.75rem', gap: '4px' }} title="Fit to Screen">
              <Crosshair size={14} />
              <span>Fit</span>
            </button>
            <button 
              type="button" 
              className="btn btn-outline" 
              onClick={() => setIsFullscreen(!isFullscreen)} 
              style={{ padding: '6px 8px' }}
              title={isFullscreen ? 'Exit Fullscreen' : 'View Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
          </div>

        </div>

      </div>

      {/* Vis Network Canvas Container */}
      <div 
        ref={containerRef} 
        style={{ 
          flex: 1, 
          width: '100%', 
          height: '100%',
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
        borderRadius: '10px',
        padding: '10px 16px',
        fontSize: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '14px',
        zIndex: 10,
        boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
        color: '#334155'
      }}>
        <span style={{ fontWeight: '700', color: '#0f172a' }}>Entity Categories:</span>
        {availableCategories.slice(0, 5).map(cat => {
          const palette = getCategoryColor(cat);
          return (
            <div key={cat} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ 
                width: '12px', 
                height: '12px', 
                background: palette.bg, 
                border: `2px solid ${palette.border}`, 
                borderRadius: '3px', 
                display: 'inline-block' 
              }} />
              <span style={{ fontWeight: '500' }}>{cat}</span>
            </div>
          );
        })}
        <button
          type="button"
          onClick={handleFit}
          style={{
            marginLeft: 'auto',
            border: 'none',
            background: 'transparent',
            color: '#008cc1',
            cursor: 'pointer',
            fontSize: '0.72rem',
            fontWeight: '600',
            display: 'flex',
            alignItems: 'center',
            gap: '3px'
          }}
        >
          <Crosshair size={12} />
          Center Graph
        </button>
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
