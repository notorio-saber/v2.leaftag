import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Navigate, useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';

export const AdminAccounts = () => {
  const { status } = useAuth();
  const navigate = useNavigate();
  const [users, setUsers] = useState<any[]>([]);

  useEffect(() => {
    if (status !== 'admin') return;

    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData: any[] = [];
      snapshot.forEach(doc => {
        usersData.push({ uid: doc.id, ...doc.data() });
      });
      setUsers(usersData);
    });

    return () => unsubscribe();
  }, [status]);

  if (status !== 'admin') {
    return <Navigate to="/" />;
  }

  const toggleStatus = async (uid: string, currentStatus: string) => {
    const newStatus = currentStatus === 'pending' ? 'active' : 'pending';
    try {
      await updateDoc(doc(db, 'users', uid), { status: newStatus });
    } catch (e) {
      console.error(e);
      alert('Erro ao alterar status da conta.');
    }
  };

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      {/* Header */}
      <div className="app-header">
        <div>
          <h2 style={{ color: 'var(--primary-hover)', fontSize: '22px', fontWeight: '800' }}>Controle de Acesso</h2>
          <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Gerencie as contas e permissões de acesso dos usuários.</span>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto', padding: '10px 20px' }} onClick={() => navigate('/')}>
          Voltar
        </button>
      </div>

      <div className="glass-card" style={{ padding: '8px 0px', overflow: 'hidden' }}>
        {users.length === 0 ? (
          <div style={{ padding: '32px 24px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Nenhum usuário logado no sistema ainda.
          </div>
        ) : null}
        
        {users.map(u => (
          <div 
            key={u.uid} 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between', 
              padding: '20px 24px', 
              borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
              flexWrap: 'wrap',
              gap: '12px'
            }}
          >
            <div style={{ flex: 1, minWidth: '200px' }}>
              <div style={{ fontWeight: '700', fontSize: '16px', color: '#ffffff' }}>{u.displayName || 'Usuário Sem Nome'}</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>{u.email}</div>
              
              {u.createdAt && (
                <div style={{ fontSize: '11px', color: '#6e7671', marginTop: '4px' }}>
                  Criado em: {new Date(u.createdAt).toLocaleDateString('pt-BR')} às {new Date(u.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              
              <div style={{ 
                fontSize: '10px', 
                display: 'inline-block', 
                padding: '4px 10px', 
                background: u.status === 'active' ? 'rgba(46, 125, 50, 0.15)' : u.status === 'admin' ? 'rgba(33, 150, 243, 0.15)' : 'rgba(255, 152, 0, 0.15)', 
                border: u.status === 'active' ? '1px solid rgba(46, 125, 50, 0.4)' : u.status === 'admin' ? '1px solid rgba(33, 150, 243, 0.4)' : '1px solid rgba(255, 152, 0, 0.4)',
                borderRadius: '100px', 
                marginTop: '10px', 
                color: u.status === 'active' ? '#a5d6a7' : u.status === 'admin' ? '#90caf9' : '#ffe082',
                fontWeight: 'bold',
                letterSpacing: '0.5px'
              }}>
                {u.status?.toUpperCase() || 'DESCONHECIDO'}
              </div>
            </div>
            
            {u.status !== 'admin' && (
              <button 
                className="btn" 
                style={{ 
                  width: 'auto', 
                  padding: '8px 16px',
                  background: u.status === 'pending' ? 'rgba(46, 125, 50, 0.2)' : 'rgba(239, 35, 60, 0.12)', 
                  border: u.status === 'pending' ? '1px solid rgba(46, 125, 50, 0.45)' : '1px solid rgba(239, 35, 60, 0.35)', 
                  color: u.status === 'pending' ? 'var(--primary-hover)' : '#ff4d6d' 
                }}
                onClick={() => toggleStatus(u.uid, u.status)}
              >
                {u.status === 'pending' ? 'Aprovar' : 'Pausar'}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
