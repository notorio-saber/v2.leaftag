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
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  status: null,
  loading: true,
  loginWithGoogle: async () => {},
  signOut: async () => {}
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'pending' | 'active' | 'admin' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setCurrentUser(user);
        
        // Verifica status da conta
        const docRef = doc(db, 'users', user.uid);
        const docSnap = await getDoc(docRef);
        
        const masterUID = 'GBfcf5uqJNPNgS0FMowUcbPQAkB3';
        
        if (docSnap.exists()) {
          const dbStatus = docSnap.data().status;
          if (user.uid === masterUID && dbStatus !== 'admin') {
            await setDoc(docRef, { status: 'admin' }, { merge: true });
            setStatus('admin');
          } else {
            setStatus(user.uid === masterUID ? 'admin' : dbStatus);
          }
        } else {
          // Primeiro login, cria como pendente (ou admin se for a master)
          const newStatus = user.uid === masterUID ? 'admin' : 'pending';
          await setDoc(docRef, {
            displayName: user.displayName,
            email: user.email,
            photoURL: user.photoURL,
            status: newStatus,
            createdAt: new Date().toISOString()
          });
          setStatus(newStatus);
        }
      } else {
        setCurrentUser(null);
        setStatus(null);
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
    <AuthContext.Provider value={{ currentUser, status, loading, loginWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
