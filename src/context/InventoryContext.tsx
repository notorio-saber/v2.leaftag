import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Inventory, FieldWork, Talhao, Stratum } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface InventoryContextType {
  fieldWorks: FieldWork[];
  talhoes: Talhao[];
  inventories: Inventory[];
  strata: Stratum[];
  currentInventory: Inventory | null;
  setCurrentInventory: (inv: Inventory | null) => void;
  saveInventory: (inv: Inventory) => Promise<void>;
  deleteInventory: (id: number) => Promise<void>;
  createFieldWork: (fw: FieldWork) => Promise<void>;
  deleteFieldWork: (id: string) => Promise<void>;
  createTalhao: (t: Talhao) => Promise<void>;
  deleteTalhao: (id: string) => Promise<void>;
  createStratum: (s: Stratum) => Promise<void>;
  deleteStratum: (id: string) => Promise<void>;
  isSynced: boolean;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, uidToUse } = useAuth();
  const [fieldWorks, setFieldWorks] = useState<FieldWork[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [strata, setStrata] = useState<Stratum[]>([]);
  const [currentInventory, setCurrentInventory] = useState<Inventory | null>(null);

  const [fwPending, setFwPending] = useState(false);
  const [talPending, setTalPending] = useState(false);
  const [invPending, setInvPending] = useState(false);
  const [strataPending, setStrataPending] = useState(false);

  const isSynced = !fwPending && !talPending && !invPending && !strataPending;

  // Firestore Snapshot (Realtime + Offline IndexedDB)
  useEffect(() => {
    if (!currentUser || !uidToUse) {
      setFieldWorks([]);
      setTalhoes([]);
      setInventories([]);
      setStrata([]);
      setFwPending(false);
      setTalPending(false);
      setInvPending(false);
      setStrataPending(false);
      return;
    }

    const fwRef = collection(db, `users/${uidToUse}/fieldWorks`);
    const unsubscribeFw = onSnapshot(fwRef, { includeMetadataChanges: true }, (snapshot) => {
      setFwPending(snapshot.metadata.hasPendingWrites);
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
    const unsubscribeTal = onSnapshot(talRef, { includeMetadataChanges: true }, (snapshot) => {
      setTalPending(snapshot.metadata.hasPendingWrites);
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
    const unsubscribeInv = onSnapshot(invRef, { includeMetadataChanges: true }, (snapshot) => {
      setInvPending(snapshot.metadata.hasPendingWrites);
      const data: Inventory[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as Inventory);
      });
      data.sort((a,b) => b.id - a.id);
      setInventories(data);
    }, (error) => {
      console.error("Erro no Sync do Inventário Firestore:", error);
    });

    const strataRef = collection(db, `users/${uidToUse}/strata`);
    const unsubscribeStrata = onSnapshot(strataRef, { includeMetadataChanges: true }, (snapshot) => {
      setStrataPending(snapshot.metadata.hasPendingWrites);
      const data: Stratum[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as Stratum);
      });
      data.sort((a,b) => b.id.localeCompare(a.id));
      setStrata(data);
    }, (error) => {
      console.error("Erro no Sync do Strata Firestore:", error);
    });

    return () => {
      unsubscribeFw();
      unsubscribeTal();
      unsubscribeInv();
      unsubscribeStrata();
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

    // Deletar os estratos atrelados a esse FieldWork
    const linkedStrata = strata.filter(s => s.fieldWorkId === id);
    for (const stratum of linkedStrata) {
      await deleteDoc(doc(db, `users/${uidToUse}/strata`, stratum.id));
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

  const createStratum = async (s: Stratum) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/strata`, s.id);
    await setDoc(docRef, s);
  };

  const deleteStratum = async (id: string) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/strata`, id);
    await deleteDoc(docRef);

    // Quando deletar o estrato, limpa o stratumId das parcelas vinculadas a ele
    const linkedInvs = inventories.filter(i => i.stratumId === id);
    for (const inv of linkedInvs) {
      const updatedInv = { ...inv };
      delete updatedInv.stratumId;
      await saveInventory(updatedInv);
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        fieldWorks,
        talhoes,
        inventories,
        strata,
        currentInventory,
        setCurrentInventory,
        saveInventory,
        deleteInventory,
        createFieldWork,
        deleteFieldWork,
        createTalhao,
        deleteTalhao,
        createStratum,
        deleteStratum,
        isSynced
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
