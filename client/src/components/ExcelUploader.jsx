import React, { useState, useRef } from 'react';
import { 
  UploadCloud, 
  FileSpreadsheet, 
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
  Info
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { api } from '../services/api';

export default function ExcelUploader({ config, onGraphBuilt, onSwitchToGraph }) {
  const [file, setFile] = useState(null);
  const [fileName, setFileName] = useState('');
  const [isSample, setIsSample] = useState(false);
  const [sampleType, setSampleType] = useState('applications');
  const [mode, setMode] = useState('universal'); // 'universal' | 'application'
  const [building, setBuilding] = useState(false);
  const [progressLogs, setProgressLogs] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [successResult, setSuccessResult] = useState(null);
  const fileInputRef = useRef(null);

  const handleFileDrop = (e) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const f = e.dataTransfer.files[0];
      setFile(f);
      setFileName(f.name);
      setIsSample(false);
      setErrorMsg('');
      setSuccessResult(null);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      const f = e.target.files[0];
      setFile(f);
      setFileName(f.name);
      setIsSample(false);
      setErrorMsg('');
      setSuccessResult(null);
    }
  };

  const handleLoadSample = (type) => {
    setFile(null);
    setIsSample(true);
    setSampleType(type);
    setErrorMsg('');
    setSuccessResult(null);

    if (type === 'supply_chain') {
      setFileName('supply_chain_logistics.xlsx (Parts, Suppliers, Factories, Warehouses)');
      setMode('universal');
    } else if (type === 'healthcare') {
      setFileName('healthcare_clinical_network.xlsx (Patients, Doctors, Hospitals, Medications)');
      setMode('universal');
    } else {
      setFileName('enterprise_application_stack.xlsx (20 Applications IT Portfolio)');
      setMode('application');
    }
  };

  const handleStartBuild = async () => {
    if (!file && !isSample) {
      setErrorMsg('Please select an Excel file or load one of the built-in sample datasets.');
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

    pushLog(`Initializing Knowledge Graph extraction pipeline (Mode: ${mode.toUpperCase()})...`);
    pushLog(`Target LLM Provider: ${config.provider.toUpperCase()}`);
    pushLog(`Connecting to Neo4j Desktop at ${config.neo4jUri || 'bolt://localhost:7687'}...`);

    try {
      const formData = new FormData();
      if (file) {
        formData.append('file', file);
      }
      if (isSample) {
        formData.append('useSample', 'true');
        formData.append('sampleType', sampleType);
      }
      formData.append('mode', mode);

      pushLog(`Reading spreadsheet records and validating ${mode === 'universal' ? 'dynamic entities' : 'application stack'}...`);
      pushLog(mode === 'universal' 
        ? 'Extracting Entity Nodes, Properties & Directed Relationships via LLM Graph Builder...'
        : 'Sending chunks to LLM for Retain / Retire / Optimize architectural classification...'
      );
      
      const res = await api.buildGraph(formData);

      if (res.success) {
        if (Array.isArray(res.logs)) {
          res.logs.forEach(l => pushLog(`${l.stage}: ${l.message}`));
        }
        pushLog(`SUCCESS: ${res.totalProcessed} records mapped and linked into Neo4j!`);
        setSuccessResult(res);
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        if (onGraphBuilt) {
          onGraphBuilt(res);
        }
      } else {
        throw new Error(res.error || 'Failed to construct graph');
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
        gap: '12px',
        background: '#f1f5f9',
        padding: '6px',
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
          <span>Universal Graph Builder (Any Excel)</span>
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
          <span>Application Stack Rationalization (Retain/Retire/Optimize)</span>
        </button>
      </div>

      {/* Intro Banner */}
      <div className="glass-panel" style={{
        padding: '20px 24px',
        background: mode === 'universal' ? '#f0f9ff' : '#f5f3ff',
        border: mode === 'universal' ? '1px solid #bae6fd' : '1px solid #ddd6fe',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ maxWidth: '680px' }}>
          <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {mode === 'universal' ? (
              <>
                <Globe size={22} color="#008cc1" />
                Universal Knowledge Graph Builder
              </>
            ) : (
              <>
                <Briefcase size={22} color="#7c3aed" />
                Application Stack Rationalization
              </>
            )}
          </h2>
          <p style={{ fontSize: '0.85rem', color: '#334155', marginTop: '6px', lineHeight: 1.5 }}>
            {mode === 'universal' ? (
              <>
                <strong>Yes, this is a Universal Graph Builder!</strong> Upload <strong>ANY Excel or CSV</strong> from any domain (Supply Chain, Healthcare, CRM, Finance, Logistics, HR, E-Commerce, etc.). The selected LLM ({config.provider === 'azure' ? 'Azure OpenAI' : 'Google Gemini'}) automatically detects entities (Nodes), properties, and semantic connections (Relationships) and persists them in Neo4j Desktop.
              </>
            ) : (
              <>
                Upload your IT application portfolio spreadsheet. The LLM extracts system architectures, maps inter-dependencies, and classifies each system into <strong>Retain</strong>, <strong>Retire</strong>, or <strong>Optimize</strong> with cost savings analytics.
              </>
            )}
          </p>
        </div>

        {/* Quick Sample Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '0.75rem', fontWeight: '600', color: '#64748b' }}>
            Quick Load Built-in Samples:
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            <button
              id="load-supply-sample-btn"
              type="button"
              className="btn btn-outline"
              onClick={() => handleLoadSample('supply_chain')}
              style={{ fontSize: '0.75rem', padding: '6px 12px', background: '#ffffff', borderColor: '#cbd5e1' }}
            >
              <Boxes size={13} color="#008cc1" />
              Supply Chain (Universal)
            </button>

            <button
              id="load-health-sample-btn"
              type="button"
              className="btn btn-outline"
              onClick={() => handleLoadSample('healthcare')}
              style={{ fontSize: '0.75rem', padding: '6px 12px', background: '#ffffff', borderColor: '#cbd5e1' }}
            >
              <HeartPulse size={13} color="#e11d48" />
              Healthcare (Universal)
            </button>

            <button
              id="load-app-sample-btn"
              type="button"
              className="btn btn-outline"
              onClick={() => handleLoadSample('applications')}
              style={{ fontSize: '0.75rem', padding: '6px 12px', background: '#ffffff', borderColor: '#cbd5e1' }}
            >
              <Briefcase size={13} color="#7c3aed" />
              App Portfolio (20 Apps)
            </button>

            <a
              id="download-template-btn"
              href={`/api/sample-excel?type=${sampleType}`}
              download
              className="btn btn-outline"
              style={{ fontSize: '0.75rem', padding: '6px 12px', textDecoration: 'none', background: '#ffffff', borderColor: '#cbd5e1' }}
            >
              <Download size={13} />
              Download Excel
            </a>
          </div>
        </div>
      </div>

      {/* Upload Dropzone */}
      <div
        id="dropzone"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleFileDrop}
        onClick={() => fileInputRef.current?.click()}
        style={{
          border: '2px dashed #cbd5e1',
          borderRadius: '12px',
          padding: '40px 24px',
          textAlign: 'center',
          background: file || isSample ? '#f0f9ff' : '#f8fafc',
          cursor: 'pointer',
          transition: 'all 0.2s ease'
        }}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx, .xls, .csv"
          onChange={handleFileSelect}
          style={{ display: 'none' }}
        />

        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: mode === 'universal' ? '#e0f2fe' : '#ede9fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 14px auto'
        }}>
          <UploadCloud size={28} color={mode === 'universal' ? '#008cc1' : '#7c3aed'} />
        </div>

        {fileName ? (
          <div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a' }}>
              Selected: <span style={{ color: mode === 'universal' ? '#008cc1' : '#7c3aed' }}>{fileName}</span>
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '4px' }}>
              Click or drag another file to replace
            </p>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: '1rem', fontWeight: '600', color: '#0f172a' }}>
              {mode === 'universal' 
                ? 'Drag & Drop ANY Excel or CSV Sheet (.xlsx, .xls, .csv)' 
                : 'Drag & Drop your Application Inventory Excel (.xlsx, .xls, .csv)'
              }
            </div>
            <p style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '6px' }}>
              {mode === 'universal' 
                ? 'Supports any tabular columns: Patients, Products, Suppliers, Sales, Employees, Devices, etc.' 
                : 'Supports columns: Application Name, Department, Annual Cost, Health, Tech Stack, Hosting, Criticality, Dependencies'
              }
            </p>
          </div>
        )}
      </div>

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
            Mode: {mode === 'universal' ? 'Universal Knowledge Graph' : 'Application Rationalization'}
          </span>
        </div>

        <button
          id="build-graph-btn"
          type="button"
          className="btn btn-primary"
          onClick={handleStartBuild}
          disabled={building || (!file && !isSample)}
          style={{ padding: '10px 24px', fontSize: '0.95rem', fontWeight: '600', gap: '8px' }}
        >
          {building ? (
            <>
              <Database size={18} className="animate-spin" />
              <span>Constructing Knowledge Graph...</span>
            </>
          ) : (
            <>
              <Sparkles size={18} />
              <span>Generate Neo4j Knowledge Graph</span>
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

      {/* Success Banner */}
      {successResult && (
        <div className="glass-panel" style={{
          padding: '16px 20px',
          background: '#ecfdf5',
          border: '1px solid #a7f3d0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CheckCircle2 size={24} color="#059669" />
            <div>
              <div style={{ fontWeight: '700', color: '#065f46', fontSize: '0.95rem' }}>
                Knowledge Graph Built Successfully!
              </div>
              <div style={{ fontSize: '0.8rem', color: '#047857' }}>
                {successResult.totalProcessed} records extracted and linked in Neo4j Desktop.
              </div>
            </div>
          </div>

          <button
            id="view-graph-now-btn"
            type="button"
            className="btn btn-primary"
            onClick={onSwitchToGraph}
            style={{ padding: '8px 18px', fontSize: '0.85rem' }}
          >
            <span>Explore Knowledge Graph</span>
            <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Extraction Process Logs (Neo4j-Graph-Builder style terminal) */}
      {progressLogs.length > 0 && (
        <div className="glass-panel" style={{ padding: '16px 20px', background: '#0f172a', border: '1px solid #334155' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8' }}>
              <Terminal size={15} color="#38bdf8" />
              <span>Neo4j Graph Builder Real-Time Execution Log</span>
            </div>
            {building && (
              <span className="badge badge-neo4j" style={{ fontSize: '0.65rem', background: 'rgba(0,140,193,0.2)', color: '#38bdf8' }}>
                Live Ingestion Active
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
                color: log.includes('SUCCESS') ? '#34d399' : log.includes('ERROR') ? '#f87171' : log.includes('WARNING') ? '#fbbf24' : '#cbd5e1' 
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
