import React, { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { doc, getDoc, updateDoc, setDoc, deleteDoc } from 'firebase/firestore';

interface TeamModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const TeamModal: React.FC<TeamModalProps> = ({ isOpen, onClose }) => {
  const { currentUser, status, uidToUse } = useAuth();
  const [collaborators, setCollaborators] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [isTeamLoading, setIsTeamLoading] = useState(false);

  const isOwner = currentUser && currentUser.uid === uidToUse && (status === 'active' || status === 'admin');

  // Load collaborators on mount or when modal opens
  useEffect(() => {
    if (!isOpen || !currentUser || (status !== 'active' && status !== 'admin')) return;
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
  }, [isOpen, currentUser, uidToUse, status]);

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
      
      // Save mapping for robust login lookup
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
      
      // Remove mapping
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

  if (!isOpen) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.85)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 100001, 
      padding: '20px', 
      backdropFilter: 'blur(8px)', 
      WebkitBackdropFilter: 'blur(8px)' 
    }}>
      <div 
        className="glass-card" 
        style={{ 
          width: '100%', 
          maxWidth: '460px', 
          marginBottom: 0,
          borderRadius: '8px', // Subtle, professional roundness
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(7, 16, 10, 0.95)',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
        }}
      >
        {isOwner ? (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'var(--primary-hover)', fontSize: '18px', fontWeight: '800', margin: 0 }}>Minha Equipe</h3>
              <button 
                onClick={onClose} 
                style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '20px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#888'}
              >
                ✕
              </button>
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', lineHeight: 1.5, marginBottom: '20px' }}>
              {status === 'admin' 
                ? 'Adicione colaboradores pelo e-mail do Google. Eles terão acesso completo para visualizar, criar e coletar dados na sua mesma conta simultaneamente.'
                : 'Adicione até 2 colaboradores pelo e-mail do Google. Eles terão acesso completo para visualizar, criar e coletar dados na sua mesma conta simultaneamente.'}
            </p>

            <div style={{ marginBottom: '20px' }}>
              <span style={{ fontSize: '10px', color: 'var(--primary-hover)', textTransform: 'uppercase', fontWeight: 'bold', letterSpacing: '0.8px', display: 'block', marginBottom: '8px' }}>
                {status === 'admin' 
                  ? `Colaboradores Adicionados (${collaborators.length})`
                  : `Colaboradores Adicionados (${collaborators.length}/2)`}
              </span>
              {collaborators.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', fontStyle: 'italic', margin: '4px 0' }}>
                  Nenhum colaborador adicionado ainda.
                </p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {collaborators.map(email => (
                    <div key={email} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <span style={{ fontSize: '13px', color: '#fff' }}>{email}</span>
                      <button 
                        className="btn btn-danger" 
                        style={{ width: 'auto', padding: '4px 10px', fontSize: '10px', height: 'auto', borderRadius: '4px' }}
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
                <label className="input-label" style={{ fontSize: '12px' }}>Adicionar Colaborador (E-mail Google)</label>
                <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                  <input 
                    type="email"
                    className="input-field" 
                    placeholder="Ex: joao.silva@gmail.com" 
                    value={newEmail} 
                    onChange={e => setNewEmail(e.target.value)} 
                    style={{ marginBottom: 0, flex: 1, borderRadius: '4px', fontSize: '13px' }} 
                  />
                  <button 
                    className="btn btn-primary" 
                    style={{ width: 'auto', padding: '0 18px', height: '42px', fontSize: '12px', borderRadius: '4px' }}
                    onClick={handleAddCollaborator}
                    disabled={isTeamLoading}
                  >
                    Adicionar
                  </button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '24px' }}>
              <button className="btn btn-secondary" style={{ width: 'auto', borderRadius: '4px' }} onClick={onClose}>Fechar</button>
            </div>
          </>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <h3 style={{ color: 'var(--primary-hover)', fontSize: '18px', fontWeight: '800', margin: 0 }}>Gerenciamento de Equipe</h3>
              <button 
                onClick={onClose} 
                style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '20px', cursor: 'pointer' }}
                onMouseEnter={e => e.currentTarget.style.color = '#fff'}
                onMouseLeave={e => e.currentTarget.style.color = '#888'}
              >
                ✕
              </button>
            </div>
            <div style={{ height: '3px', background: 'var(--primary-color)', width: '48px', marginBottom: '20px', borderRadius: '2px' }}></div>
            <p style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold', lineHeight: 1.5, marginBottom: '12px' }}>
              Recurso Exclusivo para Contas Ativas
            </p>
            <p style={{ color: 'var(--text-muted)', fontSize: '12.5px', lineHeight: 1.5, marginBottom: '24px' }}>
              A funcionalidade de adicionar e gerenciar colaboradores é exclusiva para o administrador principal da equipe (contas ativas).
              <br/><br/>
              Como colaborador, você já tem acesso total aos talhões e dados da sua equipe, mas não pode gerenciar outros colaboradores.
              Se você deseja ativar uma mestre própria para gerenciar sua equipe, entre em contato conosco.
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
                  padding: '12px 16px',
                  borderRadius: '4px'
                }}
              >
                Falar no WhatsApp
              </a>
              <button className="btn btn-secondary" style={{ width: '100%', borderRadius: '4px' }} onClick={onClose}>Fechar</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
