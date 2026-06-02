import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth, provider, db } from '../lib/firebase';
import { signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';

interface AuthContextType {
  currentUser: User | null;
  status: 'pending' | 'active' | 'admin' | null;
  loading: boolean;
  loginWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  uidToUse: string;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  status: null,
  loading: true,
  loginWithGoogle: async () => {},
  signOut: async () => {},
  uidToUse: ''
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'pending' | 'active' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);
  const [uidToUse, setUidToUse] = useState<string>('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        const masterUID = 'GBfcf5uqJNPNgS0FMowUcbPQAkB3';
        let teamOwnerUid: string | null = null;
        let isCollaborator = false;
        
        try {
          const { collection, query, where, getDocs } = await import('firebase/firestore');
          const usersRef = collection(db, 'users');
          const emailToQuery = (user.email || '').toLowerCase();
          const q = query(usersRef, where('collaborators', 'array-contains', emailToQuery));
          const qSnap = await getDocs(q);
          if (!qSnap.empty) {
            const adminDoc = qSnap.docs[0];
            const adminData = adminDoc.data();
            if (adminData.status === 'active' || adminData.status === 'admin') {
              teamOwnerUid = adminDoc.id;
              isCollaborator = true;
            }
          }
        } catch (e) {
          console.error("Erro ao verificar equipe no Firestore. Isso costuma ocorrer devido às Regras de Segurança do Firebase que bloqueiam a consulta de colaboradores. Certifique-se de aplicar as regras recomendadas no Console.", e);
        }

        if (isCollaborator && teamOwnerUid) {
          setUidToUse(teamOwnerUid);
          setStatus('active');
        } else {
          setUidToUse(user.uid);
          
          // Verifica status da conta
          const docRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const dbStatus = docSnap.data().status;
            if (user.uid === masterUID && dbStatus !== 'admin') {
              try {
                await setDoc(docRef, { status: 'admin' }, { merge: true });
              } catch (err) {
                console.error("Erro ao atualizar admin status:", err);
              }
              setStatus('admin');
            } else {
              setStatus(user.uid === masterUID ? 'admin' : dbStatus);
            }
          } else {
            // Primeiro login, cria como pendente (ou admin se for a master)
            const newStatus = user.uid === masterUID ? 'admin' : 'pending';
            try {
              await setDoc(docRef, {
                displayName: user.displayName || '',
                email: user.email || '',
                photoURL: user.photoURL || '',
                status: newStatus,
                createdAt: new Date().toISOString()
              });
            } catch (err) {
              console.error("Erro ao registrar novo usuário no Firestore:", err);
            }
            setStatus(newStatus);
          }
        }
      } else {
        setCurrentUser(null);
        setStatus(null);
        setUidToUse('');
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const loginWithGoogle = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error("Erro no login:", error);
      alert("Houve um erro ao realizar o login. Verifique sua conexão.");
    }
  };

  const signOut = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ currentUser, status, loading, loginWithGoogle, signOut, uidToUse }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
