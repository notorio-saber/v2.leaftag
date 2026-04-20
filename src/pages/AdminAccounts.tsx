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
      alert('Erro ao alterar status.');
    }
  };

  return (
    <div className="container" style={{ marginTop: '20px' }}>
      <div className="app-header">
        <div>
          <h2 style={{ color: 'var(--primary-color)' }}>Controle de Acesso</h2>
          <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Gerencie as contas do seu sistema.</span>
        </div>
        <button className="btn btn-secondary" style={{ width: 'auto' }} onClick={() => navigate('/')}>Voltar</button>
      </div>

      <div className="glass-card">
        {users.length === 0 ? <p>Nenhum usuário logou ainda.</p> : null}
        
        {users.map(u => (
          <div key={u.uid} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <div style={{ fontWeight: 'bold' }}>{u.displayName || 'Usuário Google'}</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{u.email}</div>
              {u.createdAt && (
                <div style={{ fontSize: '11px', color: '#888', marginTop: '4px' }}>
                  🗓 Início: {new Date(u.createdAt).toLocaleDateString('pt-BR')} às {new Date(u.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              )}
              <div style={{ fontSize: '12px', display: 'inline-block', padding: '2px 8px', background: u.status === 'active' ? '#1b5e20' : u.status === 'admin' ? '#0d47a1' : '#ff9800', borderRadius: '4px', marginTop: '8px', color: 'white' }}>
                {u.status?.toUpperCase() || 'DESCONHECIDO'}
              </div>
            </div>
            
            {u.status !== 'admin' && (
              <button 
                className="btn" 
                style={{ width: 'auto', background: u.status === 'pending' ? 'var(--primary-color)' : 'var(--danger-color)', color: 'white' }}
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
