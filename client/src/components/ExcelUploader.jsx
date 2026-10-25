import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
  FileText,
  FileCode,
  Sparkles, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  Terminal, 
  Layers,
  ArrowRight,
  Database,
  Globe,
  Briefcase,
  Boxes,
  HeartPulse,
  Plus,
  Trash2,
  X,
  FileCheck,
  GitMerge,
  Cpu
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';

export default function ExcelUploader({ config, onGraphBuilt, onSwitchToGraph }) {
  const [files, setFiles] = useState([]);
  const [selectedSamples, setSelectedSamples] = useState([]);
  const [mode, setMode] = useState('universal'); // 'universal' | 'application'
  const [includeLineage, setIncludeLineage] = useState(true);
  const [resolveCrossFile, setResolveCrossFile] = useState(true);

  const [building, setBuilding] = useState(false);
  const [progressLogs, setProgressLogs] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successResult, setSuccessResult] = useState(null);
  const fileInputRef = useRef(null);

  // Format file size
  const formatBytes = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
  };

  // Get appropriate file icon
  const getFileIcon = (fileName) => {
    const ext = (fileName.split('.').pop() || '').toLowerCase();
    if (ext === 'xlsx' || ext === 'xls' || ext === 'csv') {
      return <FileSpreadsheet size={18} color="#059669" />;
    }
    if (ext === 'json') {
      return <FileCode size={18} color="#d97706" />;
    }
    return <FileText size={18} color="#0284c7" />;
  };

  // Add files to queue (preventing exact duplicates)
  const addFilesToQueue = (newFiles) => {
    const valid = Array.from(newFiles).filter(f => 
      !files.some(existing => existing.name === f.name && existing.size === f.size)
    );
    if (valid.length > 0) {
      setFiles(prev => [...prev, ...valid]);
      setErrorMsg('');
      setSuccessResult(null);
    }
  };

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFilesToQueue(e.dataTransfer.files);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      addFilesToQueue(e.target.files);
    }
    // Reset input so same file can be re-selected if removed
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRemoveFile = (index) => {
    setFiles(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleClearAll = () => {
    setFiles([]);
    setSelectedSamples([]);
    setErrorMsg('');
    setSuccessResult(null);
  };

  // Add a sample dataset to queue
  const handleToggleSample = (sampleType) => {
    setSelectedSamples(prev => {
      if (prev.includes(sampleType)) {
        return prev.filter(t => t !== sampleType);
      }
      return [...prev, sampleType];
    });
    setErrorMsg('');
    setSuccessResult(null);
  };

  const handleAddAllSamples = () => {
    setSelectedSamples(['applications', 'supply_chain', 'healthcare']);
    setErrorMsg('');
    setSuccessResult(null);
  };

  const hasFilesToProcess = files.length > 0 || selectedSamples.length > 0;

  const handleStartBuild = async () => {
    if (!hasFilesToProcess) {
      setErrorMsg('Please upload one or more files or select built-in sample datasets.');
      return;
    }

    setBuilding(true);
    setErrorMsg('');
    setProgressLogs([]);
    setSuccessResult(null);

    const logs = [];
    const pushLog = (msg) => {
      const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
      logs.push(entry);
      setProgressLogs([...logs]);
    };

    const totalFileCount = files.length + selectedSamples.length;
    pushLog(`Initializing Multi-File Knowledge Graph Pipeline (${totalFileCount} files queued)...`);
    pushLog(`Target LLM Provider: ${config.provider.toUpperCase()} (${config.geminiModel || config.azureDeployment || 'gemini-3.6'})`);
    pushLog(`Neo4j Desktop Endpoint: ${config.neo4jUri || 'bolt://localhost:7687'}`);
    pushLog(`Chunk Lineage: ${includeLineage ? 'ENABLED (Document ➔ Chunk ➔ Entity)' : 'Disabled'}`);
    pushLog(`Cross-File Entity Linking: ${resolveCrossFile ? 'ENABLED' : 'Disabled'}`);

    try {
      const formData = new FormData();
      
      // Append all user uploaded files
      files.forEach(f => {
        formData.append('files', f);
      });

      // Append samples if any
      if (selectedSamples.length > 0) {
        formData.append('useSample', 'true');
        formData.append('sampleTypes', JSON.stringify(selectedSamples));
      }

      formData.append('mode', mode);
      formData.append('includeLineage', String(includeLineage));
      formData.append('resolveCrossFile', String(resolveCrossFile));

      pushLog(`Partitioning documents into semantic chunks and extracting metadata...`);
      
      const res = await api.buildGraph(formData);

      if (res.success) {
        if (Array.isArray(res.logs)) {
          res.logs.forEach(l => pushLog(`${l.stage}: ${l.message}`));
        }
        pushLog(`SUCCESS: ${res.totalFiles || totalFileCount} files processed into ${res.totalChunks || 0} chunks with ${res.totalEntities || 0} entities!`);
        if (res.crossFileLinks > 0) {
          pushLog(`CROSS-FILE: Established ${res.crossFileLinks} cross-file relationship bridges!`);
        }
        setSuccessResult(res);
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
        if (onGraphBuilt) {
          onGraphBuilt(res);
        }
      } else {
        throw new Error(res.error || 'Failed to construct multi-file graph');
      }
    } catch (err) {
      const errTxt = err.response?.data?.error || err.message;
      setErrorMsg(errTxt);
      pushLog(`ERROR: ${errTxt}`);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px', background: '#ffffff' }}>
      
      {/* Mode Switcher Tabs */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{
          display: 'flex',
          gap: '8px',
          background: '#f1f5f9',
          padding: '5px',
          borderRadius: '10px',
          width: 'fit-content'
        }}>
          <button
            type="button"
            onClick={() => setMode('universal')}
            style={{
              padding: '8px 18px',
              fontSize: '0.85rem',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: mode === 'universal' ? '#ffffff' : 'transparent',
              color: mode === 'universal' ? '#008cc1' : '#64748b',
              boxShadow: mode === 'universal' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Globe size={16} />
            <span>Universal Multi-File Graph Builder</span>
          </button>

          <button
            type="button"
            onClick={() => setMode('application')}
            style={{
              padding: '8px 18px',
              fontSize: '0.85rem',
              fontWeight: '600',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: mode === 'application' ? '#ffffff' : 'transparent',
              color: mode === 'application' ? '#7c3aed' : '#64748b',
              boxShadow: mode === 'application' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
              transition: 'all 0.15s ease'
            }}
          >
            <Briefcase size={16} />
            <span>Application Stack Rationalization</span>
          </button>
        </div>

        {/* Feature Highlights Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.75rem', color: '#64748b' }}>
          <span className="badge" style={{ background: '#f0fdf4', color: '#16a34a', border: '1px solid #bbf7d0', gap: '4px' }}>
            <FileCheck size={12} /> Multi-File Upload
          </span>
          <span className="badge" style={{ background: '#f5f3ff', color: '#7c3aed', border: '1px solid #ddd6fe', gap: '4px' }}>
            <Cpu size={12} /> Semantic Chunking
          </span>
          <span className="badge" style={{ background: '#f0f9ff', color: '#0284c7', border: '1px solid #bae6fd', gap: '4px' }}>
            <GitMerge size={12} /> Cross-File Linking
          </span>
        </div>
      </div>

      {/* Intro Banner */}
      <div className="glass-panel" style={{
        padding: '20px 24px',
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ maxWidth: '680px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Layers size={22} color="#008cc1" />
            Upload Multiple Files • Chunks & Cross-File Knowledge Graph
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#475569', marginTop: '6px', lineHeight: 1.5 }}>
            Upload <strong>multiple files at once</strong> (Excel spreadsheets, CSVs, JSON, or text documents).
            The LLM partitions each document into <strong>semantic chunks</strong>, extracts entity nodes and properties, and creates <strong>inter-document connections</strong> linking related entities across all files!
          </p>
        </div>

        {/* Multi-Sample Quick Add Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
            Quick Add Built-in Multi-File Samples:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleToggleSample('supply_chain')}
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                background: selectedSamples.includes('supply_chain') ? '#e0f2fe' : '#ffffff',
                borderColor: selectedSamples.includes('supply_chain') ? '#0284c7' : '#cbd5e1',
                color: selectedSamples.includes('supply_chain') ? '#0369a1' : '#334155'
              }}
            >
              <Boxes size={13} color="#0284c7" />
              <span>{selectedSamples.includes('supply_chain') ? '✓ Supply Chain' : '+ Supply Chain'}</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleToggleSample('healthcare')}
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                background: selectedSamples.includes('healthcare') ? '#fdf2f8' : '#ffffff',
                borderColor: selectedSamples.includes('healthcare') ? '#db2777' : '#cbd5e1',
                color: selectedSamples.includes('healthcare') ? '#be185d' : '#334155'
              }}
            >
              <HeartPulse size={13} color="#db2777" />
              <span>{selectedSamples.includes('healthcare') ? '✓ Healthcare' : '+ Healthcare'}</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={() => handleToggleSample('applications')}
              style={{
                fontSize: '0.75rem',
                padding: '6px 12px',
                background: selectedSamples.includes('applications') ? '#f5f3ff' : '#ffffff',
                borderColor: selectedSamples.includes('applications') ? '#7c3aed' : '#cbd5e1',
                color: selectedSamples.includes('applications') ? '#6d28d9' : '#334155'
              }}
            >
              <Briefcase size={13} color="#7c3aed" />
              <span>{selectedSamples.includes('applications') ? '✓ IT Apps' : '+ IT Apps'}</span>
            </button>

            <button
              type="button"
              className="btn btn-outline"
              onClick={handleAddAllSamples}
              style={{ fontSize: '0.75rem', padding: '6px 12px', background: '#f0fdf4', borderColor: '#86efac', color: '#15803d' }}
            >
              <Sparkles size={13} />
              <span>+ Add All 3 (Cross-Connect Demo)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Upload Dropzone (Multi-file) */}
      <div
        id="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed #cbd5e1',
          borderRadius: '12px',
          padding: '36px 24px',
          textAlign: 'center',
          background: hasFilesToProcess ? '#f0f9ff' : '#f8fafc',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".xlsx, .xls, .csv, .json, .txt, .md"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: '#e0f2fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 12px auto'
        }}>
          <UploadCloud size={28} color="#008cc1" />
        </div>

        <div style={{ fontSize: '1rem', fontWeight: '700', color: '#0f172a' }}>
          Drag & Drop MULTIPLE Files Here, or Click to Browse
        </div>
        <p style={{ fontSize: '0.82rem', color: '#64748b', marginTop: '6px' }}>
          Supports simultaneous upload of <strong>.xlsx, .xls, .csv, .json, .txt, .md</strong>
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '10px' }}>
          <span className="badge" style={{ background: '#ffffff', color: '#475569', border: '1px solid #e2e8f0' }}>
            Multi-file ingestion
          </span>
          <span className="badge" style={{ background: '#ffffff', color: '#475569', border: '1px solid #e2e8f0' }}>
            Automatic chunking & metadata
          </span>
          <span className="badge" style={{ background: '#ffffff', color: '#475569', border: '1px solid #e2e8f0' }}>
            Cross-file entity resolution
          </span>
        </div>
      </div>

      {/* Queued Files & Samples List */}
      {hasFilesToProcess && (
        <div className="glass-panel" style={{ padding: '16px 20px', background: '#ffffff', border: '1px solid #e2e8f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={16} color="#008cc1" />
              <span>Queued Files for Knowledge Graph Construction ({files.length + selectedSamples.length})</span>
            </div>
            
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => fileInputRef.current?.click()}
                style={{ fontSize: '0.75rem', padding: '5px 10px', gap: '4px' }}
              >
                <Plus size={13} />
                <span>Add More Files</span>
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleClearAll}
                style={{ fontSize: '0.75rem', padding: '5px 10px', color: '#dc2626', borderColor: '#fecaca' }}
              >
                <Trash2 size={13} />
                <span>Clear All</span>
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '220px', overflowY: 'auto' }}>
            {/* User files */}
            {files.map((f, idx) => (
              <div 
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  {getFileIcon(f.name)}
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0f172a' }}>
                      {f.name}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                      {formatBytes(f.size)} • {(f.name.split('.').pop() || '').toUpperCase()}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleRemoveFile(idx)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title="Remove file"
                >
                  <X size={16} />
                </button>
              </div>
            ))}

            {/* Selected samples */}
            {selectedSamples.map(st => (
              <div 
                key={st}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 12px',
                  background: '#f0f9ff',
                  border: '1px solid #bae6fd',
                  borderRadius: '8px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <FileSpreadsheet size={18} color="#0284c7" />
                  <div>
                    <div style={{ fontSize: '0.82rem', fontWeight: '600', color: '#0369a1' }}>
                      {st === 'supply_chain' ? 'supply_chain_logistics.xlsx (Built-in Sample)' :
                       st === 'healthcare' ? 'healthcare_clinical_network.xlsx (Built-in Sample)' :
                       'enterprise_application_stack.xlsx (Built-in Sample)'}
                    </div>
                    <div style={{ fontSize: '0.72rem', color: '#0284c7' }}>
                      Built-in Multi-Domain Dataset • Ready to Chunk
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleToggleSample(st)}
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: '#0284c7',
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            ))}
          </div>

          {/* Graph Construction Configuration Checkboxes */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '20px',
            marginTop: '14px',
            paddingTop: '12px',
            borderTop: '1px solid #e2e8f0',
            flexWrap: 'wrap'
          }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#334155', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={includeLineage} 
                onChange={(e) => setIncludeLineage(e.target.checked)} 
              />
              <span style={{ fontWeight: '600' }}>Generate Document & Chunk Lineage</span>
              <span style={{ color: '#64748b' }}>(Creates Document ➔ Chunk ➔ Entity nodes)</span>
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', color: '#334155', cursor: 'pointer' }}>
              <input 
                type="checkbox" 
                checked={resolveCrossFile} 
                onChange={(e) => setResolveCrossFile(e.target.checked)} 
              />
              <span style={{ fontWeight: '600' }}>Cross-File Entity Resolution</span>
              <span style={{ color: '#64748b' }}>(Auto-connect matching entities across files)</span>
            </label>
          </div>
        </div>
      )}

      {/* Build Action Row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Extraction Engine:</span>
          <span className={`badge ${config.provider === 'azure' ? 'badge-azure' : 'badge-gemini'}`}>
            {config.provider === 'azure' ? `Azure OpenAI (${config.azureDeployment || 'gpt-4o'})` : `Google Gemini (${config.geminiModel || 'gemini-3.6'})`}
          </span>
          <span className="badge badge-neo4j">
            Target: Neo4j Desktop ({config.neo4jDatabase || 'neo4j'})
          </span>
          <span className="badge" style={{ background: '#f1f5f9', color: '#334155', border: '1px solid #cbd5e1' }}>
            Queued: {files.length + selectedSamples.length} files
          </span>
        </div>

        <button
          id="build-graph-btn"
          type="button"
          className="btn btn-primary"
          onClick={handleStartBuild}
          disabled={building || !hasFilesToProcess}
          style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: '600', gap: '8px' }}
        >
          {building ? (
            <>
              <Database size={18} className="animate-spin" />
              <span>Extracting Chunks & Constructing Graph...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} />
              <span>Generate Multi-File Knowledge Graph</span>
            </>
          )}
        </button>
      </div>

      {/* Error notification */}
      {errorMsg && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          color: '#b91c1c',
          fontSize: '0.85rem',
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          <AlertCircle size={18} style={{ flexShrink: 0 }} />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Multi-File Success Banner */}
      {successResult && (
        <div className="glass-panel" style={{
          padding: '16px 20px',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <CheckCircle2 size={28} color="#059669" />
            <div>
              <div style={{ fontWeight: '700', color: '#065f46', fontSize: '1rem' }}>
                Multi-File Knowledge Graph Built Successfully!
              </div>
              <div style={{ fontSize: '0.82rem', color: '#047857', marginTop: '2px' }}>
                Processed <strong>{successResult.totalFiles} files</strong> into <strong>{successResult.totalChunks} chunks</strong>. 
                Extracted <strong>{successResult.totalEntities} entities</strong> with <strong>{successResult.totalConnections} connections</strong>
                {successResult.crossFileLinks > 0 ? ` and ${successResult.crossFileLinks} cross-file relationship bridges!` : '.'}
              </div>
            </div>
          </div>

          <button
            id="view-graph-now-btn"
            type="button"
            className="btn btn-primary"
            onClick={onSwitchToGraph}
            style={{ padding: '8px 18px', fontSize: '0.85rem', gap: '6px' }}
          >
            <span>Explore Knowledge Graph</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Real-time Execution Logs (Terminal) */}
      {progressLogs.length > 0 && (
        <div className="glass-panel" style={{ padding: '16px 20px', background: '#0f172a', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8' }}>
              <Terminal size={15} color="#38bdf8" />
              <span>Multi-File Graph Builder Real-Time Execution Log</span>
            </div>
            {building && (
              <span className="badge badge-neo4j" style={{ fontSize: '0.65rem', background: 'rgba(0,140,193,0.2)', color: '#38bdf8' }}>
                Processing Chunks
              </span>
            )}
          </div>

          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '0.75rem',
            lineHeight: 1.6,
            color: '#cbd5e1',
            maxHeight: '180px',
            overflowY: 'auto',
            background: '#070b14',
            padding: '12px 14px',
            borderRadius: '6px',
            border: '1px solid rgba(255, 255, 255, 0.08)'
          }}>
            {progressLogs.map((log, idx) => (
              <div key={idx} style={{ 
                color: log.includes('SUCCESS') ? '#34d399' : log.includes('ERROR') ? '#f87171' : log.includes('WARNING') ? '#fbbf24' : log.includes('CROSS-FILE') ? '#38bdf8' : '#cbd5e1' 
              }}>
                {log}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}
