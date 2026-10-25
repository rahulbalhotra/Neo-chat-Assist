import React, { useState } from 'react';
import { 
  X, 
  Sparkles, 
  Cpu, 
  Database, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  ExternalLink,
  Save,
  HelpCircle
} from 'lucide-react';
import { api, saveConfig } from '../services/api';

export default function ConfigModal({ isOpen, onClose, config, onSaveConfig, onNeo4jConnected }) {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState('llm'); // 'llm' | 'neo4j'
  const [form, setForm] = useState({ ...config });
  const [testingLlm, setTestingLlm] = useState(false);
  const [llmTestStatus, setLlmTestStatus] = useState(null);

  const [testingNeo4j, setTestingNeo4j] = useState(false);
  const [neo4jTestStatus, setNeo4jTestStatus] = useState(null);

  const handleTestLlm = async () => {
    setTestingLlm(true);
    setLlmTestStatus(null);
    try {
      const res = await api.testLlm(form);
      if (res.success) {
        setLlmTestStatus({ success: true, message: `Connected to ${form.provider.toUpperCase()} successfully!` });
      } else {
        setLlmTestStatus({ success: false, message: res.error || 'Connection failed' });
      }
    } catch (err) {
      setLlmTestStatus({ success: false, message: err.response?.data?.error || err.message });
    } finally {
      setTestingLlm(false);
    }
  };

  const handleTestNeo4j = async () => {
    setTestingNeo4j(true);
    setNeo4jTestStatus(null);
    try {
      const res = await api.testNeo4j(form);
      if (res.success) {
        setNeo4jTestStatus({ 
          success: true, 
          message: `Connected to Neo4j Desktop (${res.version || 'Neo4j 5.x'}) at ${res.server}` 
        });
        if (onNeo4jConnected) {
          onNeo4jConnected({ connected: true, server: res.server, version: res.version });
        }
      } else {
        setNeo4jTestStatus({ success: false, message: res.error || 'Connection failed' });
        if (onNeo4jConnected) {
          onNeo4jConnected({ connected: false, error: res.error });
        }
      }
    } catch (err) {
      setNeo4jTestStatus({ success: false, message: err.response?.data?.error || err.message });
      if (onNeo4jConnected) {
        onNeo4jConnected({ connected: false, error: err.message });
      }
    } finally {
      setTestingNeo4j(false);
    }
  };

  const handleSave = () => {
    saveConfig(form);
    onSaveConfig(form);
    onClose();
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(15, 23, 42, 0.55)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 9999,
      padding: '20px'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '640px',
        maxHeight: '90vh',
        overflowY: 'auto',
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        boxShadow: '0 20px 50px rgba(15, 23, 42, 0.15)'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff'
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '700', color: '#0f172a' }}>
              Connection & Model Configuration
            </h2>
            <p style={{ fontSize: '0.8rem', color: '#64748b' }}>
              Configure Azure OpenAI, Google Gemini, and Neo4j Desktop settings
            </p>
          </div>
          <button 
            id="close-config-modal-btn"
            onClick={onClose} 
            className="btn btn-outline" 
            style={{ padding: '6px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid #e2e8f0',
          background: '#f8fafc'
        }}>
          <button
            id="modal-tab-llm"
            type="button"
            onClick={() => setActiveTab('llm')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeTab === 'llm' ? '#ffffff' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'llm' ? '2px solid #7c3aed' : '2px solid transparent',
              color: activeTab === 'llm' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'llm' ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <Sparkles size={16} color={activeTab === 'llm' ? '#7c3aed' : 'currentColor'} />
            LLM Models (Azure / Gemini)
          </button>

          <button
            id="modal-tab-neo4j"
            type="button"
            onClick={() => setActiveTab('neo4j')}
            style={{
              flex: 1,
              padding: '12px 16px',
              background: activeTab === 'neo4j' ? '#ffffff' : 'transparent',
              border: 'none',
              borderBottom: activeTab === 'neo4j' ? '2px solid #008cc1' : '2px solid transparent',
              color: activeTab === 'neo4j' ? '#0f172a' : '#64748b',
              fontWeight: activeTab === 'neo4j' ? '600' : '400',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer'
            }}
          >
            <Database size={16} color={activeTab === 'neo4j' ? '#008cc1' : 'currentColor'} />
            Neo4j Desktop Database
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', background: '#ffffff' }}>
          
          {/* TAB 1: LLM Models */}
          {activeTab === 'llm' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <label style={{ fontSize: '0.85rem', fontWeight: '600', color: '#0f172a', marginBottom: '8px', display: 'block' }}>
                  Select Active LLM Provider
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div
                    id="select-provider-gemini"
                    onClick={() => setForm({ ...form, provider: 'gemini' })}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: form.provider === 'gemini' ? '2px solid #7c3aed' : '1px solid #e2e8f0',
                      background: form.provider === 'gemini' ? '#f5f3ff' : '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <Sparkles size={22} color="#7c3aed" />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#0f172a' }}>Google Gemini</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Flash & Pro Models</div>
                    </div>
                  </div>

                  <div
                    id="select-provider-azure"
                    onClick={() => setForm({ ...form, provider: 'azure' })}
                    style={{
                      padding: '14px',
                      borderRadius: '10px',
                      border: form.provider === 'azure' ? '2px solid #0078d4' : '1px solid #e2e8f0',
                      background: form.provider === 'azure' ? '#eff6ff' : '#f8fafc',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px'
                    }}
                  >
                    <Cpu size={22} color="#0078d4" />
                    <div>
                      <div style={{ fontWeight: '600', fontSize: '0.9rem', color: '#0f172a' }}>Azure OpenAI</div>
                      <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Enterprise GPT-4o / Mini</div>
                    </div>
                  </div>
                </div>
              </div>

              {form.provider === 'gemini' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#334155', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                      Google Gemini API Key
                    </label>
                    <input
                      id="input-gemini-key"
                      type="password"
                      placeholder="AIzaSy..."
                      value={form.geminiApiKey || ''}
                      onChange={(e) => setForm({ ...form, geminiApiKey: e.target.value })}
                      style={{ width: '100%', background: '#ffffff', borderColor: '#cbd5e1' }}
                    />
                    <span style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px', display: 'block' }}>
                      Note: If left blank, the application uses the environment key or the built-in architectural reasoning engine.
                    </span>
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#334155', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                      Gemini Model
                    </label>
                    <select
                      id="select-gemini-model"
                      value={form.geminiModel || 'gemini-3.6'}
                      onChange={(e) => setForm({ ...form, geminiModel: e.target.value })}
                      style={{ width: '100%', background: '#ffffff', borderColor: '#cbd5e1' }}
                    >
                      <option value="gemini-3.6">gemini-3.6 (Latest Frontier)</option>
                      <option value="gemini-3.6-pro">gemini-3.6-pro (Frontier Reasoning)</option>
                      <option value="gemini-3.6-flash">gemini-3.6-flash (Fast & Efficient)</option>
                      <option value="gemini-2.0-flash">gemini-2.0-flash (Next-Gen)</option>
                      <option value="gemini-1.5-pro">gemini-1.5-pro (High Reasoning)</option>
                      <option value="gemini-1.5-flash">gemini-1.5-flash (Standard)</option>
                    </select>
                  </div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', background: '#f8fafc', padding: '16px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#334155', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                      Azure OpenAI Endpoint
                    </label>
                    <input
                      id="input-azure-endpoint"
                      type="text"
                      placeholder="https://your-resource.openai.azure.com"
                      value={form.azureEndpoint || ''}
                      onChange={(e) => setForm({ ...form, azureEndpoint: e.target.value })}
                      style={{ width: '100%', background: '#ffffff', borderColor: '#cbd5e1' }}
                    />
                  </div>

                  <div>
                    <label style={{ fontSize: '0.8rem', color: '#334155', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                      Azure OpenAI API Key
                    </label>
                    <input
                      id="input-azure-key"
                      type="password"
                      placeholder="Enter Azure OpenAI API Key"
                      value={form.azureApiKey || ''}
                      onChange={(e) => setForm({ ...form, azureApiKey: e.target.value })}
                      style={{ width: '100%', background: '#ffffff', borderColor: '#cbd5e1' }}
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#334155', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                        Deployment Name
                      </label>
                      <input
                        id="input-azure-deployment"
                        type="text"
                        placeholder="gpt-4o"
                        value={form.azureDeployment || 'gpt-4o'}
                        onChange={(e) => setForm({ ...form, azureDeployment: e.target.value })}
                        style={{ width: '100%', background: '#ffffff', borderColor: '#cbd5e1' }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', color: '#334155', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                        API Version
                      </label>
                      <input
                        id="input-azure-version"
                        type="text"
                        placeholder="2024-06-01"
                        value={form.azureApiVersion || '2024-06-01'}
                        onChange={(e) => setForm({ ...form, azureApiVersion: e.target.value })}
                        style={{ width: '100%', background: '#ffffff', borderColor: '#cbd5e1' }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Test LLM status */}
              {llmTestStatus && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: llmTestStatus.success ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${llmTestStatus.success ? '#a7f3d0' : '#fecaca'}`,
                  color: llmTestStatus.success ? '#047857' : '#b91c1c'
                }}>
                  {llmTestStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{llmTestStatus.message}</span>
                </div>
              )}

              <button
                id="test-llm-btn"
                type="button"
                className="btn btn-outline"
                onClick={handleTestLlm}
                disabled={testingLlm}
                style={{ alignSelf: 'flex-start' }}
              >
                {testingLlm ? 'Testing Model...' : `Test ${form.provider === 'azure' ? 'Azure OpenAI' : 'Gemini'} Connection`}
              </button>
            </div>
          )}

          {/* TAB 2: Neo4j Database (Desktop or Cloud AuraDB) */}
          {activeTab === 'neo4j' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              {/* Quick Connection Presets */}
              <div style={{ display: 'flex', gap: '8px', background: '#f8fafc', padding: '6px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({
                    ...prev,
                    neo4jUri: 'bolt://localhost:7687',
                    neo4jUsername: prev.neo4jUsername || 'neo4j',
                    neo4jDatabase: 'neo4j'
                  }))}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    fontWeight: (!form.neo4jUri || form.neo4jUri.startsWith('bolt')) ? '600' : '400',
                    background: (!form.neo4jUri || form.neo4jUri.startsWith('bolt')) ? '#ffffff' : 'transparent',
                    color: (!form.neo4jUri || form.neo4jUri.startsWith('bolt')) ? '#008cc1' : '#64748b',
                    borderRadius: '6px',
                    border: (!form.neo4jUri || form.neo4jUri.startsWith('bolt')) ? '1px solid #bae6fd' : 'none',
                    cursor: 'pointer',
                    boxShadow: (!form.neo4jUri || form.neo4jUri.startsWith('bolt')) ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  Local Neo4j Desktop
                </button>
                <button
                  type="button"
                  onClick={() => setForm(prev => ({
                    ...prev,
                    neo4jUri: prev.neo4jUri?.startsWith('neo4j+s://') ? prev.neo4jUri : 'neo4j+s://your-instance.databases.neo4j.io',
                    neo4jUsername: prev.neo4jUsername || 'neo4j',
                    neo4jDatabase: 'neo4j'
                  }))}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    fontSize: '0.8rem',
                    fontWeight: (form.neo4jUri && form.neo4jUri.startsWith('neo4j+s')) ? '600' : '400',
                    background: (form.neo4jUri && form.neo4jUri.startsWith('neo4j+s')) ? '#ffffff' : 'transparent',
                    color: (form.neo4jUri && form.neo4jUri.startsWith('neo4j+s')) ? '#008cc1' : '#64748b',
                    borderRadius: '6px',
                    border: (form.neo4jUri && form.neo4jUri.startsWith('neo4j+s')) ? '1px solid #bae6fd' : 'none',
                    cursor: 'pointer',
                    boxShadow: (form.neo4jUri && form.neo4jUri.startsWith('neo4j+s')) ? '0 1px 3px rgba(0,0,0,0.05)' : 'none'
                  }}
                >
                  Cloud Neo4j AuraDB
                </button>
              </div>

              <div style={{
                background: '#f0f9ff',
                border: '1px solid #bae6fd',
                borderRadius: '8px',
                padding: '12px 14px',
                fontSize: '0.8rem',
                color: '#0369a1',
                display: 'flex',
                gap: '10px'
              }}>
                <HelpCircle size={18} color="#008cc1" style={{ flexShrink: 0, marginTop: '2px' }} />
                <div>
                  <strong style={{ color: '#0f172a' }}>Connection Instructions:</strong>
                  <p style={{ marginTop: '3px', lineHeight: 1.5 }}>
                    • <strong>Cloud Neo4j AuraDB:</strong> Copy your connection URI from the Aura Console (e.g. <code>neo4j+s://&lt;dbid&gt;.databases.neo4j.io</code>). Enter username <code>neo4j</code> and your instance password.<br/>
                    • <strong>Local Neo4j Desktop:</strong> Use <code>bolt://localhost:7687</code> with your local DBMS password.
                  </p>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#334155', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                  Neo4j Connection URI (Bolt or AuraDB)
                </label>
                <input
                  id="input-neo4j-uri"
                  type="text"
                  placeholder="neo4j+s://<dbid>.databases.neo4j.io or bolt://localhost:7687"
                  value={form.neo4jUri || ''}
                  onChange={(e) => setForm({ ...form, neo4jUri: e.target.value })}
                  style={{ width: '100%', background: '#ffffff', borderColor: '#cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#334155', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                    Username
                  </label>
                  <input
                    id="input-neo4j-username"
                    type="text"
                    placeholder="neo4j"
                    value={form.neo4jUsername || 'neo4j'}
                    onChange={(e) => setForm({ ...form, neo4jUsername: e.target.value })}
                    style={{ width: '100%', background: '#ffffff', borderColor: '#cbd5e1' }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: '0.8rem', color: '#334155', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                    Password
                  </label>
                  <input
                    id="input-neo4j-password"
                    type="password"
                    placeholder="Enter password"
                    value={form.neo4jPassword || ''}
                    onChange={(e) => setForm({ ...form, neo4jPassword: e.target.value })}
                    style={{ width: '100%', background: '#ffffff', borderColor: '#cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', color: '#334155', fontWeight: '500', display: 'block', marginBottom: '6px' }}>
                  Database Name
                </label>
                <input
                  id="input-neo4j-database"
                  type="text"
                  placeholder="neo4j"
                  value={form.neo4jDatabase || 'neo4j'}
                  onChange={(e) => setForm({ ...form, neo4jDatabase: e.target.value })}
                  style={{ width: '100%', background: '#ffffff', borderColor: '#cbd5e1' }}
                />
              </div>

              {/* Neo4j test status */}
              {neo4jTestStatus && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '8px',
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  background: neo4jTestStatus.success ? '#ecfdf5' : '#fef2f2',
                  border: `1px solid ${neo4jTestStatus.success ? '#a7f3d0' : '#fecaca'}`,
                  color: neo4jTestStatus.success ? '#047857' : '#b91c1c'
                }}>
                  {neo4jTestStatus.success ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
                  <span>{neo4jTestStatus.message}</span>
                </div>
              )}

              <button
                id="test-neo4j-btn"
                type="button"
                className="btn btn-outline"
                onClick={handleTestNeo4j}
                disabled={testingNeo4j}
                style={{ alignSelf: 'flex-start' }}
              >
                {testingNeo4j 
                  ? 'Connecting to Neo4j...' 
                  : (form.neo4jUri && form.neo4jUri.startsWith('neo4j+s'))
                    ? 'Test Cloud AuraDB Connection'
                    : 'Test Neo4j Connection'}
              </button>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          background: '#f8fafc'
        }}>
          <button 
            id="cancel-config-btn"
            type="button" 
            className="btn btn-outline" 
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            id="save-config-btn"
            type="button"
            className="btn btn-primary"
            onClick={handleSave}
            style={{ gap: '8px' }}
          >
            <Save size={16} />
            Save & Apply Settings
          </button>
        </div>

      </div>
    </div>
  );
}
