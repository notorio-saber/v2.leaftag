import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useInventory } from '../../context/InventoryContext';
import { useAuth } from '../../context/AuthContext';

interface ProjectSelectionViewProps {
  sidebarOpen: boolean;
  activeFwId: string;
  setActiveFwId: (id: string) => void;
  interfaceMode: 'hud' | 'classic';
  toggleInterfaceMode: () => void;
  searchProjectQuery: string;
  setSearchProjectQuery: (val: string) => void;
  kpis: {
    totalTrees: number;
    totalV: number;
  };
  activeParcels: any[];
  activeMenuFwId: string | null;
  setActiveMenuFwId: (id: string | null) => void;
  handleEditClick: (fw: any) => void;
  handleExportFieldWork: (fw: any) => void;
  setShowSettingsModal: (val: boolean) => void;
  collaborators: string[];
}

export const ProjectSelectionView: React.FC<ProjectSelectionViewProps> = ({
  sidebarOpen,
  activeFwId,
  setActiveFwId,
  interfaceMode,
  toggleInterfaceMode,
  searchProjectQuery,
  setSearchProjectQuery,
  kpis,
  activeParcels,
  activeMenuFwId,
  setActiveMenuFwId,
  handleEditClick,
  handleExportFieldWork,
  setShowSettingsModal,
  collaborators,
}) => {
  const navigate = useNavigate();
  const { fieldWorks, talhoes, inventories, isSynced, duplicateFieldWork } = useInventory();
  const { currentUser, status, theme } = useAuth();

  // Filter projects by search
  const filteredFieldWorks = React.useMemo(() => {
    return fieldWorks.filter(fw => 
      fw.nome.toLowerCase().includes(searchProjectQuery.toLowerCase()) ||
      (fw.local && fw.local.toLowerCase().includes(searchProjectQuery.toLowerCase()))
    );
  }, [fieldWorks, searchProjectQuery]);

  return (
    <div 
      className="office-sidebar" 
      style={{ 
        width: !sidebarOpen && interfaceMode === 'hud' ? '0px' : '320px', 
        minWidth: !sidebarOpen && interfaceMode === 'hud' ? '0px' : '320px',
        background: 'rgba(5, 13, 8, 0.4)', 
        backdropFilter: 'blur(30px)', 
        borderRight: !sidebarOpen && interfaceMode === 'hud' ? 'none' : '1px solid rgba(255, 255, 255, 0.05)', 
        display: 'flex', 
        flexDirection: 'column', 
        flexShrink: 0,
        overflow: 'hidden',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        opacity: !sidebarOpen && interfaceMode === 'hud' ? 0 : 1
      }}
    >
      
      {interfaceMode === 'hud' ? (
        <>
          {/* HUD Brand Header */}
          <div style={{ padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px', filter: 'hue-rotate(180deg)' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <h1 style={{ color: '#00e676', fontSize: '18px', fontWeight: '900', margin: 0, letterSpacing: '1px' }}>LEAFTAG</h1>
                  <span className="hud-badge pulse" style={{ background: 'rgba(0, 230, 118, 0.15)', color: '#00e676', fontSize: '8px', padding: '2px 6px', borderRadius: '4px', border: '1px solid #00e676', fontWeight: 'bold' }}>HUD</span>
                </div>
                <span style={{ fontSize: '9px', color: '#00e676', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '2px', opacity: 0.8 }}>CENTRO DE OPERAÇÕES</span>
              </div>
            </div>
          </div>

          {/* Toggle Button Bezel */}
          <div style={{ padding: '16px 24px 8px', borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
            <button 
              onClick={toggleInterfaceMode}
              style={{
                width: '100%',
                background: 'rgba(0, 230, 118, 0.04)',
                border: '1px dashed rgba(0, 230, 118, 0.4)',
                borderRadius: '8px', // Clamped to 8px for professional style
                color: '#00e676',
                padding: '10px 14px',
                fontSize: '11px',
                fontWeight: 'bold',
                letterSpacing: '1px',
                textTransform: 'uppercase',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                fontFamily: 'monospace'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 230, 118, 0.12)';
                e.currentTarget.style.border = '1px solid #00e676';
                e.currentTarget.style.color = '#fff';
                e.currentTarget.style.boxShadow = '0 0 12px rgba(0, 230, 118, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 230, 118, 0.04)';
                e.currentTarget.style.border = '1px dashed rgba(0, 230, 118, 0.4)';
                e.currentTarget.style.color = '#00e676';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              Alternar p/ Modo Clássico
            </button>
          </div>

          {/* Sector/Project Selector (Sci-Fi Theme) */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <span style={{ fontSize: '9px', color: '#00e676', textTransform: 'uppercase', fontWeight: '900', letterSpacing: '1.5px', display: 'block', fontFamily: 'monospace' }}>
              // TRABALHOS_DE_CAMPO.LOG
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {filteredFieldWorks.map(fw => {
                const isActive = fw.id === activeFwId;
                const countTalhoes = talhoes.filter(t => t.fieldWorkId === fw.id).length;
                const countParcelas = inventories.filter(i => i.fieldWorkId === fw.id && i.template !== 'cubagem').length;
                return (
                  <div 
                    key={fw.id} 
                    onClick={() => setActiveFwId(fw.id)}
                    className={`hud-project-card ${isActive ? 'active' : ''}`}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '8px', // Professional border radius
                      cursor: 'pointer',
                      background: isActive ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                      border: isActive ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid rgba(255, 255, 255, 0.03)',
                      transition: 'all 0.2s ease',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <h4 style={{ fontSize: '12.5px', margin: 0, fontWeight: '700', color: isActive ? '#00e676' : '#eee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                        {fw.nome}
                      </h4>
                      <span style={{ fontSize: '8px', fontFamily: 'monospace', color: isActive ? '#00e676' : 'var(--text-muted)' }}>
                        SEC_{fw.id.substring(0, 4).toUpperCase()}
                      </span>
                    </div>
                    <span style={{ fontSize: '9px', color: 'var(--text-muted)', display: 'block', marginTop: '2px', fontFamily: 'monospace' }}>
                      TALHÕES: {countTalhoes} | PARCELAS: {countParcelas}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* High-Tech System Diagnostic Summary */}
          <div style={{ padding: '16px 24px', borderTop: '1px solid rgba(0, 230, 118, 0.15)', background: 'rgba(10, 24, 15, 0.45)', fontFamily: 'monospace' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="hud-pulse-dot" style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#00e676', display: 'inline-block', boxShadow: '0 0 8px #00e676' }} />
                <span style={{ fontSize: '9px', color: '#00e676', fontWeight: '900', letterSpacing: '1.2px' }}>TELEMETRIA_SISTEMA</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)' }}>STATUS:</span>
                <span style={{ color: '#00e676', fontWeight: 'bold' }}>ONLINE // ATIVO</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)' }}>SINCRONIA:</span>
                <span style={{ color: isSynced ? '#00e676' : 'rgba(255, 255, 255, 0.4)' }}>
                  {isSynced ? "SNC_OK" : "SYNC_PROG"}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)' }}>LATÊNCIA:</span>
                <span style={{ color: '#00e676' }}>38 ms</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)' }}>PARCELAS:</span>
                <span style={{ color: '#fff' }}>{activeParcels.length}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)' }}>FUSTES:</span>
                <span style={{ color: '#fff' }}>{kpis.totalTrees}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                <span style={{ color: 'var(--text-muted)' }}>BIOMASSA:</span>
                <span style={{ color: '#fff' }}>{kpis.totalV.toFixed(1)} m³</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Brand Header */}
          <div style={{ padding: '24px 24px 16px', display: 'flex', flexDirection: 'column', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <img src="/logo.png" alt="Logo" style={{ width: '40px', height: '40px' }} />
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h1 style={{ color: 'var(--primary-color)', fontSize: '18px', fontWeight: '800', margin: 0, letterSpacing: '0.5px' }}>LeafTag</h1>
                  <div 
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isSynced ? '#81c784' : '#ffb74d',
                      transition: 'all 0.3s ease',
                      cursor: 'default'
                    }}
                    title={isSynced ? "Dados 100% Sincronizados" : "Sincronizando com a Nuvem..."}
                  >
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      width="10" 
                      height="10" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="currentColor" 
                      strokeWidth="2.5" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                      className={isSynced ? "" : "spin-icon"}
                    >
                      <path d="M17.5 19A3.5 3.5 0 0 0 21 15.5c0-2.79-2.54-4.5-5-4.5-.47-.47-1.15-.78-2-.78-2 0-3.5 1.5-3.5 3.5v.78c-2.3 0-4 1.7-4 4A3.5 3.5 0 0 0 10 22h7.5" />
                      {isSynced && <path d="M9 16l2 2 4-4" />}
                    </svg>
                  </div>
                </div>
                <span style={{ fontSize: '11px', color: '#00e676', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '1px' }}>Painel Escritório</span>
              </div>
            </div>
            <div>
              <button 
                onClick={() => {
                  localStorage.setItem('preferredMode', 'field');
                  navigate('/');
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--text-muted)',
                  fontSize: '11px',
                  cursor: 'pointer',
                  padding: '4px 0',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  textDecoration: 'none',
                  transition: 'all 0.2s',
                  fontFamily: 'inherit',
                  fontWeight: '600'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#00e676';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'var(--text-muted)';
                }}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"></rect><line x1="12" y1="18" x2="12.01" y2="18"></line></svg>
                Ir para Modo Campo
              </button>
            </div>
          </div>

          {/* Toggle HUD Mode Button */}
          <div style={{ padding: '12px 24px 4px' }}>
            <button 
              onClick={toggleInterfaceMode}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(0, 176, 255, 0.1) 0%, rgba(0, 230, 118, 0.1) 100%)',
                border: '1px solid rgba(0, 176, 255, 0.3)',
                borderRadius: '8px', // Clamped to 8px
                color: '#ffffff',
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(0, 176, 255, 0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1px solid #00b0ff';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 176, 255, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '1px solid rgba(0, 176, 255, 0.3)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 176, 255, 0.05)';
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
              <span>Ativar Space HUD</span>
            </button>
          </div>

          {/* Biblioteca de Modelos Button */}
          <div style={{ padding: '12px 24px 4px' }}>
            <button 
              onClick={() => navigate('/modelos')}
              style={{
                width: '100%',
                background: 'linear-gradient(135deg, rgba(0, 230, 118, 0.15) 0%, rgba(0, 176, 255, 0.15) 100%)',
                border: '1px solid rgba(0, 230, 118, 0.35)',
                borderRadius: '8px', // Clamped to 8px
                color: '#ffffff',
                padding: '12px 16px',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                transition: 'all 0.2s ease',
                boxShadow: '0 4px 12px rgba(0, 230, 118, 0.05)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.border = '1px solid #00e676';
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow = '0 6px 16px rgba(0, 230, 118, 0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.border = '1px solid rgba(0, 230, 118, 0.35)';
                e.currentTarget.style.transform = 'none';
                e.currentTarget.style.boxShadow = '0 4px 12px rgba(0, 230, 118, 0.05)';
              }}
            >
              <span>Biblioteca de Equações</span>
            </button>
          </div>

          {/* Project search */}
          <div style={{ padding: '8px 24px' }}>
            <div style={{ position: 'relative' }}>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Pesquisar projetos..."
                style={{ background: 'rgba(0,0,0,0.25)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', fontSize: '13px', paddingLeft: '34px', marginBottom: 0 }}
                value={searchProjectQuery}
                onChange={e => setSearchProjectQuery(e.target.value)}
              />
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}>
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>

          {/* Project list items */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
            <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
              Trabalhos de Campo ({filteredFieldWorks.length})
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredFieldWorks.map(fw => {
                const countTalhoes = talhoes.filter(t => t.fieldWorkId === fw.id).length;
                const countParcelas = inventories.filter(i => i.fieldWorkId === fw.id && i.template !== 'cubagem').length;
                const countArvores = inventories
                  .filter(i => i.fieldWorkId === fw.id)
                  .reduce((acc, curr) => acc + (curr.dados ? curr.dados.length : 0), 0);
                const isActive = fw.id === activeFwId;
                return (
                  <div 
                    key={fw.id} 
                    onClick={() => setActiveFwId(fw.id)}
                    style={{
                      padding: '12px 16px',
                      borderRadius: '8px', // Clamped to 8px
                      cursor: 'pointer',
                      background: isActive ? 'rgba(0, 230, 118, 0.08)' : 'rgba(255, 255, 255, 0.01)',
                      border: isActive ? '1px solid rgba(0, 230, 118, 0.3)' : '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'all 0.2s ease',
                      position: 'relative',
                      overflow: 'visible'
                    }}
                  >
                    {isActive && (
                      <div style={{ position: 'absolute', left: '0', top: '50%', transform: 'translateY(-50%)', width: '3px', height: '20px', background: 'var(--primary-color)', borderRadius: '0 4px 4px 0' }} />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <h4 style={{ fontSize: '13.5px', margin: 0, fontWeight: '700', color: isActive ? 'var(--primary-hover)' : '#fff', flex: 1, paddingRight: '8px' }}>{fw.nome}</h4>
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveMenuFwId(activeMenuFwId === fw.id ? null : fw.id);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: 'var(--text-muted)',
                            fontSize: '18px',
                            cursor: 'pointer',
                            padding: '0 4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'color 0.2s',
                            lineHeight: 1
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                        >
                          •••
                        </button>
                        
                        {activeMenuFwId === fw.id && (
                          <div 
                            style={{
                              position: 'absolute',
                              top: '24px',
                              right: '0',
                              background: '#1a1a1a',
                              border: '1px solid rgba(255, 255, 255, 0.08)',
                              borderRadius: '8px', // Clamped to 8px
                              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
                              zIndex: 100,
                              minWidth: '130px',
                              overflow: 'hidden',
                              backdropFilter: 'blur(16px)',
                              WebkitBackdropFilter: 'blur(16px)',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditClick(fw);
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 16px',
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                fontSize: '13px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'block',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={async (e) => {
                                e.stopPropagation();
                                setActiveMenuFwId(null);
                                if (confirm(`Deseja duplicar o trabalho de campo "${fw.nome}"?`)) {
                                  try {
                                    await duplicateFieldWork(fw.id);
                                    alert("Trabalho de campo duplicado com sucesso.");
                                  } catch (err: any) {
                                    alert("Erro ao duplicar: " + err.message);
                                  }
                                }
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 16px',
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                fontSize: '13px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                                display: 'block',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              Duplicar
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveMenuFwId(null);
                                handleExportFieldWork(fw);
                              }}
                              style={{
                                width: '100%',
                                padding: '10px 16px',
                                background: 'transparent',
                                border: 'none',
                                color: '#fff',
                                fontSize: '13px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                display: 'block',
                              }}
                              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)'; }}
                              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
                            >
                              Exportar
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginTop: '4px' }}>
                      Local: {fw.local}
                    </span>
                    <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', marginTop: '2px', opacity: 0.8 }}>
                      {countTalhoes} {countTalhoes === 1 ? 'talhão' : 'talhões'} • {countParcelas} {countParcelas === 1 ? 'parcela' : 'parcelas'} • {countArvores} {countArvores === 1 ? 'árvore' : 'árvores'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Profile Footer */}
          <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <span style={{ fontSize: '12.5px', color: '#fff', fontWeight: 'bold', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{currentUser?.displayName || 'Escritório'}</span>
                <span style={{ fontSize: '10.5px', color: 'var(--text-muted)', display: 'block', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{currentUser?.email}</span>
              </div>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexShrink: 0 }}>
                <button 
                  onClick={() => setShowSettingsModal(true)}
                  style={{ 
                    background: 'transparent', 
                    border: 'none', 
                    color: 'var(--text-muted)', 
                    cursor: 'pointer', 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'center',
                    padding: '4px'
                  }}
                  title="Configurações"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3"></circle>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

    </div>
  );
};
