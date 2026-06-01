import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Inventory, FieldWork, Talhao } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface InventoryContextType {
  fieldWorks: FieldWork[];
  talhoes: Talhao[];
  inventories: Inventory[];
  currentInventory: Inventory | null;
  setCurrentInventory: (inv: Inventory | null) => void;
  saveInventory: (inv: Inventory) => Promise<void>;
  deleteInventory: (id: number) => Promise<void>;
  createFieldWork: (fw: FieldWork) => Promise<void>;
  deleteFieldWork: (id: string) => Promise<void>;
  createTalhao: (t: Talhao) => Promise<void>;
  deleteTalhao: (id: string) => Promise<void>;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, uidToUse } = useAuth();
  const [fieldWorks, setFieldWorks] = useState<FieldWork[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [currentInventory, setCurrentInventory] = useState<Inventory | null>(null);

  // Firestore Snapshot (Realtime + Offline IndexedDB)
  useEffect(() => {
    if (!currentUser || !uidToUse) {
      setFieldWorks([]);
      setTalhoes([]);
      setInventories([]);
      return;
    }

    const fwRef = collection(db, `users/${uidToUse}/fieldWorks`);
    const unsubscribeFw = onSnapshot(fwRef, (snapshot) => {
      const data: FieldWork[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as FieldWork);
      });
      data.sort((a,b) => b.id.localeCompare(a.id));
      setFieldWorks(data);
    }, (error) => {
      console.error("Erro no Sync do FieldWorks Firestore:", error);
    });

    const talRef = collection(db, `users/${uidToUse}/talhoes`);
    const unsubscribeTal = onSnapshot(talRef, (snapshot) => {
      const data: Talhao[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as Talhao);
      });
      data.sort((a,b) => b.id.localeCompare(a.id));
      setTalhoes(data);
    }, (error) => {
      console.error("Erro no Sync do Talhoes Firestore:", error);
    });

    const invRef = collection(db, `users/${uidToUse}/inventories`);
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
      unsubscribeTal();
      unsubscribeInv();
    };
  }, [currentUser, uidToUse]);

  // Atualizar reativamente a view caso currentInventory seja modificado por outra aba
  useEffect(() => {
    if (currentInventory) {
      const liveInv = inventories.find(i => i.id === currentInventory.id);
      if (liveInv) setCurrentInventory(liveInv);
    }
  }, [inventories]);

  const saveInventory = async (newInv: Inventory) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/inventories`, newInv.id.toString());
    await setDoc(docRef, newInv);
  };

  const deleteInventory = async (id: number) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/inventories`, id.toString());
    await deleteDoc(docRef);

    if (currentInventory?.id === id) {
      setCurrentInventory(null);
    }
  };

  const createFieldWork = async (fw: FieldWork) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/fieldWorks`, fw.id);
    await setDoc(docRef, fw);
  };

  const deleteFieldWork = async (id: string) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/fieldWorks`, id);
    await deleteDoc(docRef);
    
    // Deletar os talhões atrelados a esse FieldWork
    const linkedTalhoes = talhoes.filter(t => t.fieldWorkId === id);
    for (const talhao of linkedTalhoes) {
      await deleteDoc(doc(db, `users/${uidToUse}/talhoes`, talhao.id));
    }
    
    // Deletar as parcelas atreladas a esse FieldWork
    const linkedInvs = inventories.filter(i => i.fieldWorkId === id);
    for (const inv of linkedInvs) {
      await deleteDoc(doc(db, `users/${uidToUse}/inventories`, inv.id.toString()));
    }

    if (currentInventory?.fieldWorkId === id) {
      setCurrentInventory(null);
    }
  };

  const createTalhao = async (t: Talhao) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/talhoes`, t.id);
    await setDoc(docRef, t);
  };

  const deleteTalhao = async (id: string) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/talhoes`, id);
    await deleteDoc(docRef);

    // Deletar as parcelas atreladas a esse Talhão
    const linkedInvs = inventories.filter(i => i.talhaoId === id);
    for (const inv of linkedInvs) {
      await deleteDoc(doc(db, `users/${uidToUse}/inventories`, inv.id.toString()));
    }

    if (currentInventory?.talhaoId === id) {
      setCurrentInventory(null);
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        fieldWorks,
        talhoes,
        inventories,
        currentInventory,
        setCurrentInventory,
        saveInventory,
        deleteInventory,
        createFieldWork,
        deleteFieldWork,
        createTalhao,
        deleteTalhao,
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
