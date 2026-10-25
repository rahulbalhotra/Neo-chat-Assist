import React, { useState, useRef, useEffect } from 'react';
import { 
  Send, 
  Sparkles, 
  Terminal, 
  ChevronDown, 
  ChevronUp, 
  Copy, 
  Check, 
  ExternalLink,
  Bot,
  User,
  HelpCircle,
  Database
} from 'lucide-react';
import { api } from '../services/api';

const SAMPLE_QUESTIONS = [
  "Which applications should we retire first to save maximum budget?",
  "Show all systems in Finance & Accounting with high maintenance cost",
  "What applications depend on legacy AS400 or mainframe systems?",
  "Which applications are prime candidates to Optimize and migrate to cloud?",
  "Give me an executive summary breakdown of our Retain, Retire, and Optimize portfolio"
];

export default function GraphChat({ config, onFocusApp }) {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: `Hello! I am your **Neo4j Graph AI Assistant**. I can translate your natural language questions into **Cypher queries**, run them against your connected Neo4j Desktop database, and provide architectural rationalization insights for your application stack.\n\nAsk me anything or click one of the suggested prompts below!`,
      cypher: 'MATCH (a:Application)-[:CLASSIFIED_AS]->(c:Classification) RETURN c.name, count(a) AS total',
      highlightApps: []
    }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedCypherIndex, setCopiedCypherIndex] = useState(null);
  const [openCypherIdx, setOpenCypherIdx] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async (userQuestion) => {
    const q = (userQuestion || input).trim();
    if (!q || loading) return;

    const userMsg = { role: 'user', content: q };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await api.chatWithGraph(q, messages);
      const assistantMsg = {
        role: 'assistant',
        content: res.answer || 'No response returned from graph query.',
        cypher: res.cypher,
        explanation: res.explanation,
        recordsCount: res.recordsCount,
        highlightApps: res.highlightApps || []
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `**Error querying graph:** ${err.response?.data?.error || err.message}`,
          cypher: null
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCypher = (cypher, index) => {
    navigator.clipboard.writeText(cypher);
    setCopiedCypherIndex(index);
    setTimeout(() => setCopiedCypherIndex(null), 2000);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#ffffff' }}>
      
      {/* Top Suggestions Bar */}
      <div style={{
        padding: '12px 20px',
        borderBottom: '1px solid #e2e8f0',
        background: '#f8fafc',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        overflowX: 'auto',
        whiteSpace: 'nowrap'
      }}>
        <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
          <Sparkles size={12} color="#7c3aed" /> Prompts:
        </span>
        {SAMPLE_QUESTIONS.map((q, idx) => (
          <button
            key={idx}
            type="button"
            className="btn btn-outline"
            onClick={() => handleSend(q)}
            disabled={loading}
            style={{
              padding: '4px 10px',
              fontSize: '0.74rem',
              borderRadius: '9999px',
              flexShrink: 0,
              background: '#ffffff',
              borderColor: '#cbd5e1'
            }}
          >
            {q}
          </button>
        ))}
      </div>

      {/* Messages Scroll Area */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px'
      }}>
        {messages.map((m, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              gap: '12px',
              maxWidth: m.role === 'user' ? '80%' : '90%',
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start'
            }}
          >
            {/* Avatar */}
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: m.role === 'user' ? '#0f172a' : 'linear-gradient(135deg, #008cc1 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              color: '#ffffff'
            }}>
              {m.role === 'user' ? <User size={16} /> : <Bot size={16} color="#ffffff" />}
            </div>

            {/* Bubble */}
            <div style={{
              background: m.role === 'user' ? 'linear-gradient(135deg, #008cc1 0%, #006891 100%)' : '#f8fafc',
              border: m.role === 'user' ? '1px solid rgba(0, 140, 193, 0.2)' : '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '14px 18px',
              color: m.role === 'user' ? '#ffffff' : '#0f172a',
              fontSize: '0.875rem',
              lineHeight: 1.6,
              boxShadow: 'var(--shadow-sm)'
            }}>
              {/* Message text */}
              <div style={{ whiteSpace: 'pre-wrap' }}>
                {m.content}
              </div>

              {/* Mentioned Apps to Spotlight */}
              {m.highlightApps && m.highlightApps.length > 0 && (
                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${m.role === 'user' ? 'rgba(255,255,255,0.2)' : '#e2e8f0'}` }}>
                  <div style={{ fontSize: '0.72rem', color: m.role === 'user' ? '#e0f2fe' : '#64748b', marginBottom: '6px' }}>
                    Click to spotlight on Knowledge Graph:
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {m.highlightApps.map((appName, aIdx) => (
                      <button
                        key={aIdx}
                        type="button"
                        onClick={() => onFocusApp && onFocusApp(appName)}
                        className="badge badge-neo4j"
                        style={{ cursor: 'pointer', textTransform: 'none', fontSize: '0.72rem' }}
                      >
                        <Database size={10} />
                        {appName}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Cypher Query Accordion */}
              {m.cypher && (
                <div style={{ marginTop: '12px', borderTop: `1px solid ${m.role === 'user' ? 'rgba(255,255,255,0.2)' : '#e2e8f0'}`, paddingTop: '8px' }}>
                  <div
                    onClick={() => setOpenCypherIdx(openCypherIdx === idx ? null : idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: '0.75rem',
                      color: m.role === 'user' ? '#bae6fd' : '#0284c7',
                      cursor: 'pointer',
                      padding: '4px 0',
                      fontWeight: '600'
                    }}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      <Terminal size={12} />
                      Generated Cypher Query {m.recordsCount !== undefined && `(${m.recordsCount} records)`}
                    </span>
                    {openCypherIdx === idx ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>

                  {openCypherIdx === idx && (
                    <div style={{
                      marginTop: '6px',
                      background: '#0f172a',
                      border: '1px solid #334155',
                      borderRadius: '6px',
                      padding: '10px',
                      position: 'relative'
                    }}>
                      <button
                        onClick={() => handleCopyCypher(m.cypher, idx)}
                        style={{
                          position: 'absolute',
                          right: '8px',
                          top: '8px',
                          background: 'rgba(255, 255, 255, 0.15)',
                          border: 'none',
                          borderRadius: '4px',
                          color: '#fff',
                          padding: '3px 6px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.7rem'
                        }}
                      >
                        {copiedCypherIndex === idx ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                        <span>{copiedCypherIndex === idx ? 'Copied' : 'Copy'}</span>
                      </button>

                      <pre style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '0.74rem',
                        color: '#38bdf8',
                        overflowX: 'auto',
                        paddingRight: '60px',
                        lineHeight: 1.4
                      }}>
                        {m.cypher}
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div style={{ display: 'flex', gap: '12px', alignSelf: 'flex-start' }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #008cc1 0%, #6366f1 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Bot size={16} color="#ffffff" />
            </div>
            <div style={{
              background: '#f8fafc',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '12px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.85rem',
              color: '#64748b'
            }}>
              <Sparkles size={16} className="animate-spin" color="#008cc1" />
              <span>Analyzing graph schema & executing Cypher with {config.provider === 'azure' ? 'Azure OpenAI' : 'Gemini'}...</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input Box */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid #e2e8f0',
        background: '#ffffff'
      }}>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSend();
          }}
          style={{ display: 'flex', gap: '10px' }}
        >
          <input
            id="chat-input"
            type="text"
            placeholder="Ask anything about applications to Retain, Retire, or Optimize..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            style={{
              flex: 1,
              padding: '12px 16px',
              borderRadius: '10px',
              fontSize: '0.9rem',
              background: '#ffffff',
              border: '1px solid #cbd5e1',
              color: '#0f172a'
            }}
          />
          <button
            id="chat-send-btn"
            type="submit"
            className="btn btn-primary"
            disabled={loading || !input.trim()}
            style={{ padding: '0 20px', borderRadius: '10px' }}
          >
            <Send size={16} />
          </button>
        </form>
      </div>

    </div>
  );
}
