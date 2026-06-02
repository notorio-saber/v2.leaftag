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
          const { doc, getDoc } = await import('firebase/firestore');
          const emailToQuery = (user.email || '').toLowerCase();
          const mappingRef = doc(db, 'collaborators_mapping', emailToQuery);
          const mappingSnap = await getDoc(mappingRef);
          
          if (mappingSnap.exists()) {
            const mappingData = mappingSnap.data();
            const ownerUid = mappingData.ownerUid;
            
            // Verifica se a conta mestre (dona) está ativa ou admin
            const ownerRef = doc(db, 'users', ownerUid);
            const ownerSnap = await getDoc(ownerRef);
            if (ownerSnap.exists()) {
              const ownerData = ownerSnap.data();
              if (ownerData.status === 'active' || ownerData.status === 'admin') {
                teamOwnerUid = ownerUid;
                isCollaborator = true;
              }
            }
          }
        } catch (e) {
          console.error("Erro ao verificar equipe via mapeamento:", e);
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
