import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Inventory, FieldWork, Talhao, Stratum, HeightModel, VolumeModel, InventoryProcessing } from '../types';
import { db } from '../lib/firebase';
import { collection, doc, onSnapshot, setDoc, deleteDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';

interface InventoryContextType {
  fieldWorks: FieldWork[];
  talhoes: Talhao[];
  inventories: Inventory[];
  strata: Stratum[];
  heightModels: HeightModel[];
  volumeModels: VolumeModel[];
  currentInventory: Inventory | null;
  setCurrentInventory: (inv: Inventory | null) => void;
  saveInventory: (inv: Inventory) => Promise<void>;
  deleteInventory: (id: number) => Promise<void>;
  createFieldWork: (fw: FieldWork) => Promise<void>;
  deleteFieldWork: (id: string) => Promise<void>;
  duplicateFieldWork: (id: string) => Promise<void>;
  createTalhao: (t: Talhao) => Promise<void>;
  deleteTalhao: (id: string) => Promise<void>;
  createStratum: (s: Stratum) => Promise<void>;
  deleteStratum: (id: string) => Promise<void>;
  createHeightModel: (hm: HeightModel) => Promise<void>;
  deleteHeightModel: (id: string) => Promise<void>;
  createVolumeModel: (vm: VolumeModel) => Promise<void>;
  deleteVolumeModel: (id: string) => Promise<void>;
  processings: InventoryProcessing[];
  saveProcessing: (proc: InventoryProcessing) => Promise<void>;
  deleteProcessing: (id: string) => Promise<void>;
  isSynced: boolean;
}

const cleanObject = (obj: any): any => {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(item => typeof item === 'object' ? cleanObject(item) : item);
  }
  if (typeof obj === 'object') {
    const cleaned: any = {};
    Object.keys(obj).forEach(key => {
      const val = obj[key];
      if (val !== undefined) {
        cleaned[key] = typeof val === 'object' ? cleanObject(val) : val;
      }
    });
    return cleaned;
  }
  return obj;
};

const seedDefaultHeightModels = async (uid: string) => {
  const defaultHeights: HeightModel[] = [
    {
      id: "hm-default-curtis-pinus",
      nome: "Curtis - Pinus taeda",
      especie: "Pinus taeda",
      regiao: "Sul",
      tipoModelo: "curtis",
      coeficientes: {
        beta0: 2.85,
        beta1: -14.2
      },
      fonteBibliografica: "Curtis, R.O. (1967)",
      observacoes: "Modelo regional para Pinus taeda.",
      criadoEm: new Date().toISOString()
    },
    {
      id: "hm-default-henriksen-euc",
      nome: "Henriksen - Eucalyptus grandis",
      especie: "Eucalyptus grandis",
      regiao: "Sudeste",
      tipoModelo: "henriksen",
      coeficientes: {
        beta0: 1.25,
        beta1: 6.82
      },
      fonteBibliografica: "Henriksen, H. A. (1950)",
      observacoes: "Modelo logarítmico padrão para Eucalyptus grandis.",
      criadoEm: new Date().toISOString()
    },
    {
      id: "hm-default-linear-geral",
      nome: "Modelo Linear Geral",
      especie: "Todas",
      regiao: "Geral",
      tipoModelo: "linear",
      coeficientes: {
        beta0: 4.5,
        beta1: 0.85
      },
      fonteBibliografica: "Geral",
      observacoes: "Equação linear simples para estimativa de altura.",
      criadoEm: new Date().toISOString()
    }
  ];
  try {
    for (const hm of defaultHeights) {
      const docRef = doc(db, `users/${uid}/heightModels`, hm.id);
      await setDoc(docRef, hm);
    }
  } catch (err) {
    console.error("Erro ao semear default height models:", err);
  }
};

const seedDefaultVolumeModels = async (uid: string) => {
  const defaultVolumes: VolumeModel[] = [
    {
      id: "vm-default-sh-pinus",
      nome: "Schumacher-Hall - Pinus taeda",
      especie: "Pinus taeda",
      regiao: "Sul",
      tipoModelo: "schumacher_hall",
      coeficientes: {
        beta0: 0.000055,
        beta1: 1.885,
        beta2: 1.052
      },
      fonteBibliografica: "Schumacher & Hall (1933)",
      observacoes: "Equação clássica de volume comercial para Pinus.",
      criadoEm: new Date().toISOString()
    },
    {
      id: "vm-default-spurr-euc",
      nome: "Spurr - Eucalyptus grandis",
      especie: "Eucalyptus grandis",
      regiao: "Sudeste",
      tipoModelo: "spurr",
      coeficientes: {
        beta0: 0.0052,
        beta1: 0.000038
      },
      fonteBibliografica: "Spurr, S.H. (1952)",
      observacoes: "Modelo de Spurr para volume individual de Eucalyptus grandis.",
      criadoEm: new Date().toISOString()
    },
    {
      id: "vm-default-ff-geral",
      nome: "Fator de Forma (0.7)",
      especie: "Todas",
      regiao: "Geral",
      tipoModelo: "fator_forma",
      coeficientes: {
        beta0: 0.7
      },
      fonteBibliografica: "Literatura",
      observacoes: "Cálculo volumétrico clássico com fator de forma comercial igual a 0.7.",
      criadoEm: new Date().toISOString()
    }
  ];
  try {
    for (const vm of defaultVolumes) {
      const docRef = doc(db, `users/${uid}/volumeModels`, vm.id);
      await setDoc(docRef, vm);
    }
  } catch (err) {
    console.error("Erro ao semear default volume models:", err);
  }
};

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { currentUser, uidToUse } = useAuth();
  const [fieldWorks, setFieldWorks] = useState<FieldWork[]>([]);
  const [talhoes, setTalhoes] = useState<Talhao[]>([]);
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [strata, setStrata] = useState<Stratum[]>([]);
  const [heightModels, setHeightModels] = useState<HeightModel[]>([]);
  const [volumeModels, setVolumeModels] = useState<VolumeModel[]>([]);
  const [currentInventory, setCurrentInventory] = useState<Inventory | null>(null);
  const [processings, setProcessings] = useState<InventoryProcessing[]>([]);

  const [fwPending, setFwPending] = useState(false);
  const [talPending, setTalPending] = useState(false);
  const [invPending, setInvPending] = useState(false);
  const [strataPending, setStrataPending] = useState(false);
  const [hmPending, setHmPending] = useState(false);
  const [vmPending, setVmPending] = useState(false);
  const [processPending, setProcessPending] = useState(false);

  const isSynced = !fwPending && !talPending && !invPending && !strataPending && !hmPending && !vmPending && !processPending;

  // Firestore Snapshot (Realtime + Offline IndexedDB)
  useEffect(() => {
    if (!currentUser || !uidToUse) {
      setFieldWorks([]);
      setTalhoes([]);
      setInventories([]);
      setStrata([]);
      setHeightModels([]);
      setVolumeModels([]);
      setFwPending(false);
      setTalPending(false);
      setInvPending(false);
      setStrataPending(false);
      setHmPending(false);
      setVmPending(false);
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

    const hmRef = collection(db, `users/${uidToUse}/heightModels`);
    const unsubscribeHm = onSnapshot(hmRef, { includeMetadataChanges: true }, (snapshot) => {
      setHmPending(snapshot.metadata.hasPendingWrites);
      const data: HeightModel[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as HeightModel);
      });
      data.sort((a,b) => b.criadoEm.localeCompare(a.criadoEm));
      setHeightModels(data);
      if (snapshot.empty && !snapshot.metadata.hasPendingWrites) {
        seedDefaultHeightModels(uidToUse);
      }
    }, (error) => {
      console.error("Erro no Sync do HeightModels Firestore:", error);
    });

    const vmRef = collection(db, `users/${uidToUse}/volumeModels`);
    const unsubscribeVm = onSnapshot(vmRef, { includeMetadataChanges: true }, (snapshot) => {
      setVmPending(snapshot.metadata.hasPendingWrites);
      const data: VolumeModel[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as VolumeModel);
      });
      data.sort((a,b) => b.criadoEm.localeCompare(a.criadoEm));
      setVolumeModels(data);
      if (snapshot.empty && !snapshot.metadata.hasPendingWrites) {
        seedDefaultVolumeModels(uidToUse);
      }
    }, (error) => {
      console.error("Erro no Sync do VolumeModels Firestore:", error);
    });

    const processRef = collection(db, `users/${uidToUse}/processings`);
    const unsubscribeProcess = onSnapshot(processRef, { includeMetadataChanges: true }, (snapshot) => {
      setProcessPending(snapshot.metadata.hasPendingWrites);
      const data: InventoryProcessing[] = [];
      snapshot.forEach(doc => {
        data.push(doc.data() as InventoryProcessing);
      });
      data.sort((a,b) => b.createdAt.localeCompare(a.createdAt));
      setProcessings(data);
    }, (error) => {
      console.error("Erro no Sync do Processings Firestore:", error);
    });

    return () => {
      unsubscribeFw();
      unsubscribeTal();
      unsubscribeInv();
      unsubscribeStrata();
      unsubscribeHm();
      unsubscribeVm();
      unsubscribeProcess();
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
    await setDoc(docRef, cleanObject(newInv));
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
    await setDoc(docRef, cleanObject(fw));
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
    await setDoc(docRef, cleanObject(t));
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
    await setDoc(docRef, cleanObject(s));
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

  const createHeightModel = async (hm: HeightModel) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/heightModels`, hm.id);
    await setDoc(docRef, cleanObject(hm));
  };

  const deleteHeightModel = async (id: string) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/heightModels`, id);
    await deleteDoc(docRef);
  };

  const createVolumeModel = async (vm: VolumeModel) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/volumeModels`, vm.id);
    await setDoc(docRef, cleanObject(vm));
  };

  const deleteVolumeModel = async (id: string) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/volumeModels`, id);
    await deleteDoc(docRef);
  };

  const saveProcessing = async (newProc: InventoryProcessing) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/processings`, newProc.id);
    await setDoc(docRef, cleanObject(newProc));
  };

  const deleteProcessing = async (id: string) => {
    if (!currentUser || !uidToUse) return;
    const docRef = doc(db, `users/${uidToUse}/processings`, id);
    await deleteDoc(docRef);
  };

  const duplicateFieldWork = async (originalId: string) => {
    if (!currentUser || !uidToUse) return;

    const originalFw = fieldWorks.find(f => f.id === originalId);
    if (!originalFw) throw new Error("Trabalho de campo original não encontrado.");

    const newFwId = Date.now().toString();
    const newFw: FieldWork = {
      ...originalFw,
      id: newFwId,
      nome: `${originalFw.nome} (Cópia)`,
      dataInicio: new Date().toLocaleDateString('pt-BR')
    };

    // 1. Salva o novo FieldWork
    await setDoc(doc(db, `users/${uidToUse}/fieldWorks`, newFwId), cleanObject(newFw));

    // 2. Duplica os talhões e guarda um mapa de { oldTalhaoId: newTalhaoId }
    const talhaoMap: Record<string, string> = {};
    const originalTalhoes = talhoes.filter(t => t.fieldWorkId === originalId);
    for (const t of originalTalhoes) {
      const newTId = Math.random().toString(36).substring(2, 9) + Date.now();
      talhaoMap[t.id] = newTId;
      const newT: Talhao = {
        ...t,
        id: newTId,
        fieldWorkId: newFwId
      };
      await setDoc(doc(db, `users/${uidToUse}/talhoes`, newTId), cleanObject(newT));
    }

    // 3. Duplica os estratos e guarda um mapa de { oldStratumId: newStratumId }
    const stratumMap: Record<string, string> = {};
    const originalStrata = strata.filter(s => s.fieldWorkId === originalId);
    for (const s of originalStrata) {
      const newSId = Math.random().toString(36).substring(2, 9) + Date.now();
      stratumMap[s.id] = newSId;
      const newS: Stratum = {
        ...s,
        id: newSId,
        fieldWorkId: newFwId
      };
      await setDoc(doc(db, `users/${uidToUse}/strata`, newSId), cleanObject(newS));
    }

    // 4. Duplica os inventories (parcelas e cubagens)
    const originalInvs = inventories.filter(i => i.fieldWorkId === originalId);
    let idx = 0;
    for (const inv of originalInvs) {
      const newInvId = Date.now() + (++idx);
      const newInv: Inventory = {
        ...inv,
        id: newInvId,
        fieldWorkId: newFwId,
        talhaoId: inv.talhaoId ? (talhaoMap[inv.talhaoId] || undefined) : undefined,
        stratumId: inv.stratumId ? (stratumMap[inv.stratumId] || undefined) : undefined
      };
      await setDoc(doc(db, `users/${uidToUse}/inventories`, newInvId.toString()), cleanObject(newInv));
    }
  };

  return (
    <InventoryContext.Provider
      value={{
        fieldWorks,
        talhoes,
        inventories,
        strata,
        heightModels,
        volumeModels,
        currentInventory,
        setCurrentInventory,
        saveInventory,
        deleteInventory,
        createFieldWork,
        deleteFieldWork,
        duplicateFieldWork,
        createTalhao,
        deleteTalhao,
        createStratum,
        deleteStratum,
        createHeightModel,
        deleteHeightModel,
        createVolumeModel,
        deleteVolumeModel,
        processings,
        saveProcessing,
        deleteProcessing,
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
