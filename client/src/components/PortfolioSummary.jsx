import React from 'react';
import { 
  Layers, 
  CheckCircle, 
  Trash2, 
  Zap, 
  DollarSign, 
  TrendingDown, 
  Server,
  Building
} from 'lucide-react';

export default function PortfolioSummary({ stats }) {
  const totalApps = stats?.totalApps || 0;
  const retainCount = stats?.retainCount || 0;
  const retireCount = stats?.retireCount || 0;
  const optimizeCount = stats?.optimizeCount || 0;
  const totalCost = stats?.totalCost || 0;
  const retireSavings = stats?.retireSavings || 0;

  const retainPct = totalApps > 0 ? Math.round((retainCount / totalApps) * 100) : 0;
  const retirePct = totalApps > 0 ? Math.round((retireCount / totalApps) * 100) : 0;
  const optimizePct = totalApps > 0 ? Math.round((optimizeCount / totalApps) * 100) : 0;

  const formatCurrency = (val) => {
    if (!val || val === 0) return '$0';
    if (val >= 1000000) {
      return `$${(val / 1000000).toFixed(2)}M`;
    }
    return `$${(val / 1000).toFixed(0)}k`;
  };

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
      gap: '16px',
      margin: '16px 24px 0 24px'
    }}>
      
      {/* 1. Total Applications */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', background: '#ffffff' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          background: '#e0f2fe',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #bae6fd'
        }}>
          <Layers size={22} color="#008cc1" />
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
            Total Applications
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
            {totalApps}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            {stats?.totalDepts || 0} Departments • {stats?.totalTech || 0} Tech Stacks
          </div>
        </div>
      </div>

      {/* 2. Retain */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        borderLeft: '4px solid var(--retain-green)',
        background: '#ffffff'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          background: 'var(--retain-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #a7f3d0'
        }}>
          <CheckCircle size={22} color="var(--retain-green)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--retain-green)', textTransform: 'uppercase', fontWeight: '700' }}>
              RETAIN
            </span>
            <span className="badge badge-retain" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
              {retainPct}%
            </span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
            {retainCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Strategic Core Systems
          </div>
        </div>
      </div>

      {/* 3. Retire */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        borderLeft: '4px solid var(--retire-red)',
        background: '#ffffff'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          background: 'var(--retire-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #fecaca'
        }}>
          <Trash2 size={22} color="var(--retire-red)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--retire-red)', textTransform: 'uppercase', fontWeight: '700' }}>
              RETIRE
            </span>
            <span className="badge badge-retire" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
              {retirePct}%
            </span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
            {retireCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--retire-red)', fontWeight: '600', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '3px' }}>
            <TrendingDown size={12} />
            Save {formatCurrency(retireSavings)}/yr
          </div>
        </div>
      </div>

      {/* 4. Optimize */}
      <div className="glass-panel" style={{
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '14px',
        borderLeft: '4px solid var(--optimize-amber)',
        background: '#ffffff'
      }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          background: 'var(--optimize-bg)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #fde68a'
        }}>
          <Zap size={22} color="var(--optimize-amber)" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--optimize-amber)', textTransform: 'uppercase', fontWeight: '700' }}>
              OPTIMIZE
            </span>
            <span className="badge badge-optimize" style={{ fontSize: '0.65rem', padding: '1px 6px' }}>
              {optimizePct}%
            </span>
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
            {optimizeCount}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Cloud & Modernization
          </div>
        </div>
      </div>

      {/* 5. Total Annual Spend */}
      <div className="glass-panel" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '14px', background: '#ffffff' }}>
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '10px',
          background: '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '1px solid #e2e8f0'
        }}>
          <DollarSign size={22} color="#008cc1" />
        </div>
        <div>
          <div style={{ fontSize: '0.75rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600' }}>
            Annual Portfolio Spend
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#0f172a', lineHeight: 1.2 }}>
            {formatCurrency(totalCost)}
          </div>
          <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
            Operational Maintenance
          </div>
        </div>
      </div>

    </div>
  );
}
