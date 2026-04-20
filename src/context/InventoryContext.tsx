import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Inventory, FieldWork } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface InventoryContextType {
  fieldWorks: FieldWork[];
  inventories: Inventory[];
  currentInventory: Inventory | null;
  setCurrentInventory: (inv: Inventory | null) => void;
  saveInventory: (inv: Inventory) => Promise<void>;
  deleteInventory: (id: number) => Promise<void>;
  createFieldWork: (fw: FieldWork) => Promise<void>;
  deleteFieldWork: (id: string) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser } = useAuth();
  const [fieldWorks, setFieldWorks] = useState<FieldWork[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [currentInventory, setCurrentInventory] = useState<Inventory | null>(null);

  // Firestore Snapshot (Realtime + Offline IndexedDB)
  useEffect(() => {
    if (!currentUser) {
      setFieldWorks([]);
      setInventories([]);
      return;
    }

    const fwRef = collection(db, `users/${currentUser.uid}/fieldWorks`);
    const unsubscribeFw = onSnapshot(fwRef, (snapshot) => {
      const data: FieldWork[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as FieldWork);
      });
      // Sort by creation time string / logic (simplistic map to sort)
      data.sort((a,b) => b.id.localeCompare(a.id));
      setFieldWorks(data);
    }, (error) => {
      console.error("Erro no Sync do FieldWorks Firestore:", error);
    });

    const invRef = collection(db, `users/${currentUser.uid}/inventories`);
    const unsubscribeInv = onSnapshot(invRef, (snapshot) => {
      const data: Inventory[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as Inventory);
      });
      data.sort((a,b) => b.id - a.id);
      setInventories(data);
    }, (error) => {
      console.error("Erro no Sync do Inventário Firestore:", error);
    });

    return () => {
      unsubscribeFw();
      unsubscribeInv();
    };
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

  const createFieldWork = async (fw: FieldWork) => {
    if (!currentUser) return;
    const docRef = doc(db, `users/${currentUser.uid}/fieldWorks`, fw.id);
    await setDoc(docRef, fw);
  };

  const deleteFieldWork = async (id: string) => {
    if (!currentUser) return;
    const docRef = doc(db, `users/${currentUser.uid}/fieldWorks`, id);
    await deleteDoc(docRef);
    
    // Deletar as parcelas atreladas a esse FieldWork (Opcional/Cascade simpificado offline)
    const linkedInvs = inventories.filter(i => i.fieldWorkId === id);
    linkedInvs.forEach(async (inv) => {
      await deleteDoc(doc(db, `users/${currentUser.uid}/inventories`, inv.id.toString()));
    });
  };

  return (
    <InventoryContext.Provider
      value={{
        fieldWorks,
        inventories,
        currentInventory,
        setCurrentInventory,
        saveInventory,
        deleteInventory,
        createFieldWork,
        deleteFieldWork,
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
