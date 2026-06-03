import { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, useNavigate, Navigate } from 'react-router-dom';
import { InventorySetup } from './pages/InventorySetup';
import { CollectData } from './pages/CollectData';
import { InventoryDetail } from './pages/InventoryDetail';
import { FieldWorkDetail } from './pages/FieldWorkDetail';
import { Login } from './pages/Login';
import { PendingAccess } from './pages/PendingAccess';
import { AdminAccounts } from './pages/AdminAccounts';
import './App.css';
import { useInventory } from './context/InventoryContext';
import { useAuth } from './context/AuthContext';
import { doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { OfficeDashboard } from './pages/OfficeDashboard';

// Permite apenas admin e active
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { currentUser, status, loading } = useAuth();
  if (loading) return null;
  if (!currentUser) return <Navigate to="/login" />;
  if (status === 'pending') return <Navigate to="/pending" />;
  return <>{children}</>;
};

const Home = () => {
  const { fieldWorks, createFieldWork, talhoes, inventories, isSynced } = useInventory();
  const { currentUser, signOut, status, uidToUse, theme, toggleTheme } = useAuth();
  const isOwner = currentUser && currentUser.uid === uidToUse && (status === 'active' || status === 'admin');
  const userName = currentUser?.displayName ? currentUser.displayName.split(' ')[0] : 'Usuário';
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(false);
  const [newFwName, setNewFwName] = useState('');
  const [newFwLocal, setNewFwLocal] = useState('');
  // Utilizando formato YYYY-MM-DD para o input type="date"
  const [newFwDate, setNewFwDate] = useState(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState('');

  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [isTeamLoading, setIsTeamLoading] = useState(false);

  useEffect(() => {
    // Se estiver no computador (tela >= 1024px) e não escolheu explicitamente o Modo Campo, vai para o Modo Escritório
    if (window.innerWidth >= 1024 && localStorage.getItem('preferredMode') !== 'field') {
      navigate('/office');
    }
  }, [navigate]);

  useEffect(() => {
    if (!currentUser || (status !== 'active' && status !== 'admin')) return;
    if (currentUser.uid !== uidToUse) return;

    const loadCollaborators = async () => {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCollaborators(docSnap.data().collaborators || []);
        }
      } catch (e) {
        console.error("Erro ao carregar colaboradores:", e);
      }
    };
    loadCollaborators();
  }, [currentUser, showTeamModal, uidToUse, status]);

  const handleAddCollaborator = async () => {
    if (!currentUser) return;
    const emailToTrim = newEmail.trim().toLowerCase();
    if (!emailToTrim) return alert("Digite um e-mail válido.");
    
    if (collaborators.includes(emailToTrim)) {
      return alert("Este e-mail já faz parte do seu time.");
    }
    
    if (status !== 'admin' && collaborators.length >= 2) {
      return alert("Você atingiu o limite máximo de 2 colaboradores no seu time.");
    }

    setIsTeamLoading(true);
    const updatedCollaborators = [...collaborators, emailToTrim];
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      await updateDoc(docRef, { collaborators: updatedCollaborators });
      
      // Salva mapeamento para login robusto e independente de regras de busca globais
      await setDoc(doc(db, 'collaborators_mapping', emailToTrim), { ownerUid: currentUser.uid });

      setCollaborators(updatedCollaborators);
      setNewEmail('');
      alert("Colaborador adicionado com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao adicionar colaborador. Tente novamente.");
    } finally {
      setIsTeamLoading(false);
    }
  };

  const handleRemoveCollaborator = async (emailToRemove: string) => {
    if (!currentUser) return;
    if (!confirm(`Deseja realmente remover o e-mail ${emailToRemove} do seu time?`)) return;

    setIsTeamLoading(true);
    const updatedCollaborators = collaborators.filter(email => email !== emailToRemove);
    try {
      const docRef = doc(db, 'users', currentUser.uid);
      await updateDoc(docRef, { collaborators: updatedCollaborators });
      
      // Remove o mapeamento do banco
      await deleteDoc(doc(db, 'collaborators_mapping', emailToRemove));

      setCollaborators(updatedCollaborators);
      alert("Colaborador removido com sucesso!");
    } catch (e) {
      console.error(e);
      alert("Erro ao remover colaborador. Tente novamente.");
    } finally {
      setIsTeamLoading(false);
    }
  };

  const handleCreateFw = () => {
    if (!newFwName) return alert('Dê um nome ao trabalho.');
    
    // Converter YYYY-MM-DD para DD/MM/YYYY antes de salvar
    const formattedDate = newFwDate 
      ? new Date(newFwDate + 'T12:00:00').toLocaleDateString('pt-BR')
      : new Date().toLocaleDateString('pt-BR');

    createFieldWork({
      id: Date.now().toString(),
      nome: newFwName,
      local: newFwLocal || 'Não especificado',
      dataInicio: formattedDate,
      status: 'Aberto'
    });
    setShowModal(false);
    setNewFwName('');
    setNewFwLocal('');
    setNewFwDate(new Date().toISOString().split('T')[0]); 
  };

  // Lógica de busca global unificada
  const filteredFieldWorks = searchQuery 
    ? fieldWorks.filter(fw => 
        fw.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
        (fw.local && fw.local.toLowerCase().includes(searchQuery.toLowerCase()))
      )
    : [];

  const filteredTalhoes = searchQuery 
    ? talhoes.filter(t => t.nome.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const filteredInventories = searchQuery 
    ? inventories.filter(inv => inv.nome.toLowerCase().includes(searchQuery.toLowerCase()))
    : [];

  const hasSearchResults = filteredFieldWorks.length > 0 || filteredTalhoes.length > 0 || filteredInventories.length > 0;
  
  return (
    <div className="container" style={{ marginTop: '20px' }}>
      <div className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <img src="/logo.png" alt="Logo" style={{ width: '48px', height: '48px', borderRadius: '0px' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ color: 'var(--primary-color)', fontSize: '20px', whiteSpace: 'nowrap', margin: 0 }}>Trabalhos de Campo</h1>
              
              {/* Cloud Sync Icon */}
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
                  width="14" 
                  height="14" 
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
            <p style={{ color: 'var(--text-muted)', fontSize: '14px', margin: 0 }}>Olá, {userName}!</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button 
            type="button" 
            className="btn btn-secondary" 
            style={{ 
              width: '40px', 
              height: '40px', 
              padding: 0, 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.08)',
              background: 'rgba(255,255,255,0.02)'
            }} 
            onClick={() => setShowSettingsModal(true)}
            title="Configurações"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"></circle>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* Barra de Pesquisa Global */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <input
          type="text"
          className="input-field"
          style={{ 
            marginBottom: 0, 
            paddingLeft: '44px', 
            borderRadius: '12px',
            fontSize: '15px'
          }}
          placeholder="Pesquisar trabalhos, talhões ou parcelas..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          width="18" 
          height="18" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="var(--text-muted)" 
          strokeWidth="2.5" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            pointerEvents: 'none'
          }}
        >
          <circle cx="11" cy="11" r="8"></circle>
          <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
        </svg>
      </div>

      {searchQuery ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', color: 'var(--primary-hover)', fontWeight: '800', marginBottom: '4px', textTransform: 'uppercase', letterSpacing: '1px' }}>
            Resultados da Pesquisa
          </h3>

          {!hasSearchResults ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '30px' }}>
              <span style={{ fontSize: '14.5px', color: 'var(--text-muted)' }}>Nenhum resultado encontrado para "{searchQuery}"</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {/* Resultados de Projetos/Trabalhos */}
              {filteredFieldWorks.map(fw => (
                <div 
                  key={`fw-${fw.id}`} 
                  className="glass-card" 
                  style={{ 
                    padding: '18px 20px', 
                    marginBottom: 0, 
                    cursor: 'pointer',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}
                  onClick={() => navigate(`/fieldwork/${fw.id}`)}
                >
                  <div>
                    <h4 style={{ fontSize: '15px', margin: 0, fontWeight: '800', color: '#ffffff' }}>{fw.nome}</h4>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Local: {fw.local}</span>
                  </div>
                  <span style={{ 
                    background: 'rgba(46, 125, 50, 0.15)', 
                    border: '1px solid rgba(46, 125, 50, 0.45)', 
                    borderRadius: '8px', 
                    padding: '5px 10px', 
                    fontSize: '9.5px', 
                    fontWeight: '800',
                    color: 'var(--primary-hover)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.5px'
                  }}>
                    Trabalho
                  </span>
                </div>
              ))}

              {/* Resultados de Talhões */}
              {filteredTalhoes.map(t => {
                const parentFw = fieldWorks.find(f => f.id === t.fieldWorkId);
                return (
                  <div 
                    key={`t-${t.id}`} 
                    className="glass-card" 
                    style={{ 
                      padding: '18px 20px', 
                      marginBottom: 0, 
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onClick={() => navigate(`/fieldwork/${t.fieldWorkId}`)}
                  >
                    <div>
                      <h4 style={{ fontSize: '15px', margin: 0, fontWeight: '800', color: '#ffffff' }}>{t.nome}</h4>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        Trabalho: {parentFw?.nome || 'Desconhecido'}
                      </span>
                    </div>
                    <span style={{ 
                      background: 'rgba(0, 188, 212, 0.15)', 
                      border: '1px solid rgba(0, 188, 212, 0.45)', 
                      borderRadius: '8px', 
                      padding: '5px 10px', 
                      fontSize: '9.5px', 
                      fontWeight: '800',
                      color: '#00bcd4',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Talhão
                    </span>
                  </div>
                );
              })}

              {/* Resultados de Parcelas */}
              {filteredInventories.map(inv => {
                const parentFw = fieldWorks.find(f => f.id === inv.fieldWorkId);
                const parentTalhao = talhoes.find(st => st.id === inv.talhaoId);
                return (
                  <div 
                    key={`inv-${inv.id}`} 
                    className="glass-card" 
                    style={{ 
                      padding: '18px 20px', 
                      marginBottom: 0, 
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                    onClick={() => navigate(`/detail/${inv.id}`)}
                  >
                    <div>
                      <h4 style={{ fontSize: '15px', margin: 0, fontWeight: '800', color: '#ffffff' }}>{inv.nome}</h4>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                        {parentFw?.nome || 'Trabalho'} {parentTalhao ? ` / ${parentTalhao.nome}` : ''}
                      </span>
                    </div>
                    <span style={{ 
                      background: 'rgba(255, 152, 0, 0.15)', 
                      border: '1px solid rgba(255, 152, 0, 0.45)', 
                      borderRadius: '8px', 
                      padding: '5px 10px', 
                      fontSize: '9.5px', 
                      fontWeight: '800',
                      color: '#ff9800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.5px'
                    }}>
                      Parcela
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <>
          <button className="btn btn-primary" style={{ margin: '0 0 24px', position: 'sticky', top: '16px', zIndex: 100 }} onClick={() => setShowModal(true)}>
            + Novo Trabalho de Campo
          </button>
          
          {fieldWorks.length === 0 ? (
            <div className="glass-card" style={{ textAlign: 'center', padding: '40px' }}>
              <h3 style={{ color: 'var(--text-muted)' }}>Nenhum projeto encontrado</h3>
              <p style={{ color: '#666', marginTop: '8px' }}>Crie seu primeiro trabalho de campo!</p>
            </div>
          ) : (
            <div className="inventory-list">
              {fieldWorks.map(fw => (
                <div 
                  key={fw.id} 
                  className="inventory-card" 
                  onClick={() => navigate(`/fieldwork/${fw.id}`)}
                >
                  <div className="inventory-card-title">{fw.nome}</div>
                  <div className="inventory-card-info">Local: {fw.local}</div>
                  <div className="inventory-card-info">Data: {fw.dataInicio}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
           <div className="glass-card" style={{ width: '100%', maxWidth: '400px', borderRadius: '0px' }}>
              <h3>Novo Trabalho</h3>
              <input className="input-field" placeholder="Nome (Ex: Inventário 2026)" value={newFwName} onChange={e => setNewFwName(e.target.value)} style={{ marginTop: '16px' }} />
              <input className="input-field" placeholder="Local / Fazenda" value={newFwLocal} onChange={e => setNewFwLocal(e.target.value)} />
              <input type="date" className="input-field" value={newFwDate} onChange={e => setNewFwDate(e.target.value)} />
              <div style={{ display: 'flex', gap: '12px', marginTop: '16px' }}>
                <button className="btn btn-secondary" onClick={() => setShowModal(false)}>Cancelar</button>
                <button className="btn btn-primary" onClick={handleCreateFw}>Criar</button>
              </div>
           </div>
        </div>
      )}

      {showTeamModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
            <div className="glass-card" style={{ width: '100%', maxWidth: '460px', marginBottom: 0 }}>
              {isOwner ? (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ color: 'var(--primary-hover)', fontSize: '20px', fontWeight: '800', margin: 0 }}>Minha Equipe</h3>
                    <button onClick={() => setShowTeamModal(false)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
                  </div>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5, marginBottom: '20px' }}>
                    {status === 'admin' 
                      ? 'Adicione colaboradores pelo e-mail do Google. Eles terão acesso completo para visualizar, criar e coletar dados na sua mesma conta simultaneamente.'
                      : 'Adicione até 2 colaboradores pelo e-mail do Google. Eles terão acesso completo para visualizar, criar e coletar dados na sua mesma conta simultaneamente.'}
                  </p>

                  <div style={{ marginBottom: '20px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
                      {status === 'admin' 
                        ? `Colaboradores Adicionados (${collaborators.length})`
                        : `Colaboradores Adicionados (${collaborators.length}/2)`}
                    </span>
                    {collaborators.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: '13px', fontStyle: 'italic', margin: '4px 0' }}>
                        Nenhum colaborador adicionado ainda.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {collaborators.map(email => (
                          <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
                            <span style={{ fontSize: '13.5px', color: '#fff' }}>{email}</span>
                            <button 
                              className="btn btn-danger" 
                              style={{ width: 'auto', padding: '4px 10px', fontSize: '10px', height: 'auto' }}
                              onClick={() => handleRemoveCollaborator(email)}
                              disabled={isTeamLoading}
                            >
                              Remover
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {(status === 'admin' || collaborators.length < 2) && (
                    <div style={{ marginBottom: '16px' }}>
                      <label className="input-label">Adicionar Colaborador (E-mail Google)</label>
                      <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                        <input 
                          type="email"
                          className="input-field" 
                          placeholder="Ex: joao.silva@gmail.com" 
                          value={newEmail} 
                          onChange={e => setNewEmail(e.target.value)} 
                          style={{ marginBottom: 0, flex: 1 }} 
                        />
                        <button 
                          className="btn btn-primary" 
                          style={{ width: 'auto', padding: '0 18px', height: '42px', fontSize: '12px' }}
                          onClick={handleAddCollaborator}
                          disabled={isTeamLoading}
                        >
                          Adicionar
                        </button>
                      </div>
                    </div>
                  )}

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
                    <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => setShowTeamModal(false)}>Fechar</button>
                  </div>
                </>
              ) : (
                <>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ color: 'var(--primary-hover)', fontSize: '20px', fontWeight: '800', margin: 0 }}>Gerenciamento de Equipe</h3>
                    <button onClick={() => setShowTeamModal(false)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
                  </div>
                  <div style={{ height: '3px', background: 'var(--primary-color)', width: '48px', marginBottom: '20px', borderRadius: '4px' }}></div>
                  <p style={{ color: '#fff', fontSize: '14.5px', fontWeight: 'bold', lineHeight: 1.5, marginBottom: '12px' }}>
                    Recurso Exclusivo para Contas Ativas
                  </p>
                  <p style={{ color: 'var(--text-muted)', fontSize: '13px', lineHeight: 1.5, marginBottom: '24px' }}>
                    A funcionalidade de adicionar e gerenciar colaboradores é exclusiva para o administrador principal da equipe (contas ativas).
                    <br/><br/>
                    Como colaborador, você já tem acesso total aos talhões e dados da sua equipe, mas não pode gerenciar outros colaboradores.
                    Se você deseja ativar uma conta própria para gerenciar sua equipe mestre, entre em contato conosco.
                  </p>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    <a 
                      href="https://wa.me/5547920022746?text=Olá!%20Gostaria%20de%20ativar%20uma%20conta%20mestre%20no%20LeafTag%20para%20gerenciar%20minha%20própria%20equipe."
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn"
                      style={{ 
                        textDecoration: 'none', 
                        display: 'inline-flex', 
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: 'rgba(37, 211, 102, 0.15)', 
                        border: '1px solid rgba(37, 211, 102, 0.45)', 
                        color: '#25D366',
                        boxShadow: '0 4px 15px rgba(37, 211, 102, 0.1)',
                        fontWeight: 'bold',
                        padding: '12px 16px'
                      }}
                    >
                      Falar no WhatsApp
                    </a>
                    <button className="btn btn-secondary" style={{ width: '100%' }} onClick={() => setShowTeamModal(false)}>Fechar</button>
                  </div>
                </>
              )}
            </div>
         </div>
      )}

      {/* Modal de Configurações Unificado */}
      {showSettingsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px', backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)' }}>
          <div className="glass-card" style={{ width: '100%', maxWidth: '440px', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ color: 'var(--primary-hover)', fontSize: '20px', fontWeight: '800', margin: 0 }}>Configurações</h3>
              <button onClick={() => setShowSettingsModal(false)} style={{ background: 'transparent', color: 'white', border: 'none', fontSize: '24px', cursor: 'pointer' }}>×</button>
            </div>
            
            {/* User Profile Info */}
            <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <span style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Conta</span>
              <span style={{ fontSize: '15px', color: '#fff', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>{currentUser?.displayName || 'Usuário'}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block' }}>{currentUser?.email}</span>
            </div>

            {/* Theme Toggle Button */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div>
                <span style={{ fontSize: '13px', color: '#fff', fontWeight: 'bold', display: 'block' }}>Tema do Aplicativo</span>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Alternar entre modo claro e escuro</span>
              </div>
              <button 
                className="btn btn-secondary" 
                onClick={toggleTheme}
                style={{ 
                  width: 'auto', 
                  padding: '6px 14px', 
                  fontSize: '11.5px', 
                  borderColor: theme === 'dark' ? '#ffb74d' : '#f57c00', 
                  color: theme === 'dark' ? '#ffb74d' : '#f57c00',
                  background: 'rgba(255, 255, 255, 0.02)'
                }}
              >
                {theme === 'dark' ? '☀️ Modo Claro' : '🌙 Modo Escuro'}
              </button>
            </div>

            {/* Action List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              
              {/* Minha Equipe (Only if owner or active) */}
              {currentUser && (
                <button 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderColor: 'var(--primary-color)', color: 'var(--primary-color)' }}
                  onClick={() => {
                    setShowTeamModal(true);
                  }}
                >
                  <span>👥 Minha Equipe</span>
                  <span style={{ fontSize: '11px', opacity: 0.7 }}>{collaborators.length} membros</span>
                </button>
              )}

              {/* Painel do Escritório (Desktop Only) */}
              {(status === 'active' || status === 'admin') && (
                <button 
                  className="btn btn-secondary desktop-only" 
                  style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', borderColor: '#4fc3f7', color: '#4fc3f7', background: 'rgba(79, 195, 247, 0.08)' }}
                  onClick={() => {
                    localStorage.setItem('preferredMode', 'office');
                    navigate('/office');
                  }}
                >
                  🖥️ Ir para Painel do Escritório
                </button>
              )}

              {/* Painel Admin (If Admin) */}
              {status === 'admin' && (
                <button 
                  className="btn btn-secondary" 
                  style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', borderColor: '#ffb74d', color: '#ffb74d' }}
                  onClick={() => {
                    navigate('/admin');
                  }}
                >
                  🛡️ Painel de Administrador
                </button>
              )}

            </div>

            <div style={{ display: 'flex', gap: '12px', marginTop: '12px' }}>
              <button 
                className="btn btn-danger" 
                style={{ flex: 1 }}
                onClick={() => {
                  signOut();
                  setShowSettingsModal(false);
                }}
              >
                Sair da Conta
              </button>
              <button className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowSettingsModal(false)}>Fechar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/pending" element={<PendingAccess />} />
        
        {/* Rotas Protegidas */}
        <Route path="/" element={<ProtectedRoute><Home /></ProtectedRoute>} />
        <Route path="/fieldwork/:id" element={<ProtectedRoute><FieldWorkDetail /></ProtectedRoute>} />
        <Route path="/setup/:fieldWorkId/:talhaoId" element={<ProtectedRoute><InventorySetup /></ProtectedRoute>} />
        <Route path="/collect" element={<ProtectedRoute><CollectData /></ProtectedRoute>} />
        <Route path="/detail/:id" element={<ProtectedRoute><InventoryDetail /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><AdminAccounts /></ProtectedRoute>} />
        <Route path="/office" element={<ProtectedRoute><OfficeDashboard /></ProtectedRoute>} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
