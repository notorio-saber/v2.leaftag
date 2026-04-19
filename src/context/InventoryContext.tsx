import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Inventory } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface InventoryContextType {
  inventories: Inventory[];
  currentInventory: Inventory | null;
  setCurrentInventory: (inv: Inventory | null) => void;
  saveInventory: (inv: Inventory) => Promise<void>;
  deleteInventory: (id: number) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [currentInventory, setCurrentInventory] = useState<Inventory | null>(null);

  // Firestore Snapshot (Realtime + Offline IndexedDB)
  useEffect(() => {
    if (!currentUser) {
      setInventories([]);
      return;
    }

    // Assina a pasta deste usuário especificamente
    const colRef = collection(db, `users/${currentUser.uid}/inventories`);
    
    // onSnapshot funciona perfeitamente offline pegando do cache do IndexedDB!
    const unsubscribe = onSnapshot(colRef, (snapshot) => {
      const data: Inventory[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as Inventory);
      });
      // Sort por DATA de início para manter organizaçao
      data.sort((a,b) => b.id - a.id);
      setInventories(data);
    }, (error) => {
      console.error("Erro no Sync do Inventário Firestore:", error);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Atualizar reativamente a view caso currentInventory seja modificado por outra aba
  useEffect(() => {
    if (currentInventory) {
      const liveInv = inventories.find(i => i.id === currentInventory.id);
      if (liveInv) setCurrentInventory(liveInv);
    }
  }, [inventories]);

  const saveInventory = async (newInv: Inventory) => {
    if (!currentUser) return;
    
    // O SDK do Firebase joga pro IndexedDb imediatamente e sobe quando der internet. Reactivity é instantânea.
    const docRef = doc(db, `users/${currentUser.uid}/inventories`, newInv.id.toString());
    await setDoc(docRef, newInv);
  };

  const deleteInventory = async (id: number) => {
    if (!currentUser) return;
    
    const docRef = doc(db, `users/${currentUser.uid}/inventories`, id.toString());
    await deleteDoc(docRef);

    if (currentInventory?.id === id) {
      setCurrentInventory(null);
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        inventories,
        currentInventory,
        setCurrentInventory,
        saveInventory,
        deleteInventory,
      }}
    >
      {children}
    </InventoryContext.Provider>
  );
};

export const useInventory = () => {
  const context = useContext(InventoryContext);
  if (context === undefined) {
    throw new Error('useInventory must be used within an InventoryProvider');
  }
  return context;
};
