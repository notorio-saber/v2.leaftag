import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { db } from '../../../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenTeamModal: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  onOpenTeamModal,
}) => {
  const navigate = useNavigate();
  const { currentUser, signOut, status, theme, toggleTheme } = useAuth();
  const [collaboratorsCount, setCollaboratorsCount] = useState(0);

  useEffect(() => {
    if (!isOpen || !currentUser || (status !== 'active' && status !== 'admin')) return;
    
    const loadCollaborators = async () => {
      try {
        const docRef = doc(db, 'users', currentUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setCollaboratorsCount((docSnap.data().collaborators || []).length);
        }
      } catch (e) {
        console.error("Erro ao carregar contagem de colaboradores:", e);
      }
    };
    loadCollaborators();
  }, [isOpen, currentUser, status]);

  if (!isOpen) return null;

  return (
    <div style={{ 
      position: 'fixed', 
      top: 0, left: 0, right: 0, bottom: 0, 
      background: 'rgba(0,0,0,0.85)', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center', 
      zIndex: 100000, 
      padding: '20px', 
      backdropFilter: 'blur(8px)', 
      WebkitBackdropFilter: 'blur(8px)' 
    }}>
      <div 
        className="glass-card" 
        style={{ 
          width: '100%', 
          maxWidth: '440px', 
          marginBottom: 0, 
          display: 'flex', 
          flexDirection: 'column', 
          gap: '16px',
          borderRadius: '8px', // Clean, professional rounded corners
          border: '1px solid rgba(255,255,255,0.08)',
          background: 'rgba(7, 16, 10, 0.95)',
          padding: '24px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
          fontFamily: 'system-ui, -apple-system, sans-serif'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ color: 'var(--primary-hover)', fontSize: '18px', fontWeight: '800', margin: 0 }}>Configurações</h3>
          <button 
            onClick={onClose} 
            style={{ background: 'transparent', color: '#888', border: 'none', fontSize: '20px', cursor: 'pointer' }}
            onMouseEnter={e => e.currentTarget.style.color = '#fff'}
            onMouseLeave={e => e.currentTarget.style.color = '#888'}
          >
            ✕
          </button>
        </div>
        
        {/* User Profile Info */}
        <div style={{ background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 'bold' }}>Conta</span>
          <span style={{ fontSize: '14px', color: '#fff', fontWeight: 'bold', display: 'block', marginTop: '4px' }}>{currentUser?.displayName || 'Escritório'}</span>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block' }}>{currentUser?.email}</span>
        </div>

        {/* Theme Toggle Button */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
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
              background: 'rgba(255, 255, 255, 0.02)',
              borderRadius: '4px'
            }}
          >
            {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
          </button>
        </div>

        {/* Action List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          
          {/* Minha Equipe (Only if owner or active) */}
          {currentUser && (
            <button 
              className="btn btn-secondary" 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderColor: 'var(--primary-color)', color: 'var(--primary-color)', borderRadius: '4px' }}
              onClick={() => {
                onClose();
                onOpenTeamModal();
              }}
            >
              <span>Minha Equipe</span>
              <span style={{ fontSize: '11px', opacity: 0.7 }}>{collaboratorsCount} membros</span>
            </button>
          )}

          {/* Modelos de Altura e Volume */}
          {currentUser && (
            <button 
              className="btn btn-secondary" 
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', borderColor: '#a5d6a7', color: '#a5d6a7', borderRadius: '4px' }}
              onClick={() => {
                onClose();
                navigate('/modelos');
              }}
            >
              <span>Modelos (Altura / Volume)</span>
              <span style={{ fontSize: '11px', opacity: 0.7 }}>Gerenciar</span>
            </button>
          )}

          {/* Modo Campo Switch */}
          <button 
            className="btn btn-secondary" 
            style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', borderColor: '#00e676', color: '#00e676', background: 'rgba(0, 230, 118, 0.08)', borderRadius: '4px' }}
            onClick={() => {
              localStorage.setItem('preferredMode', 'field');
              navigate('/');
            }}
          >
            Ir para Modo Campo
          </button>

          {/* Painel Admin (If Admin) */}
          {status === 'admin' && (
            <button 
              className="btn btn-secondary" 
              style={{ display: 'flex', justifyContent: 'flex-start', width: '100%', borderColor: '#ffb74d', color: '#ffb74d', borderRadius: '4px' }}
              onClick={() => {
                onClose();
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
            style={{ flex: 1, borderRadius: '4px' }}
            onClick={() => {
              signOut();
              onClose();
            }}
          >
            Sair da Conta
          </button>
          <button className="btn btn-secondary" style={{ flex: 1, borderRadius: '4px' }} onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
};
