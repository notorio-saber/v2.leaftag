import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Inventory } from '../types';

interface InventoryContextType {
  inventories: Inventory[];
  currentInventory: Inventory | null;
  setCurrentInventory: (inv: Inventory | null) => void;
  saveInventory: (inv: Inventory) => void;
  deleteInventory: (id: number) => void;
}

const InventoryContext = createContext<InventoryContextType | undefined>(undefined);

const STORAGE_KEY = 'leaftag_inventarios_v2';

export const InventoryProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [inventories, setInventories] = useState<Inventory[]>([]);
  const [currentInventory, setCurrentInventory] = useState<Inventory | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load from local storage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setInventories(JSON.parse(stored));
      }
    } catch (e) {
      console.error('Error loading inventories', e);
    }
    setIsLoaded(true);
  }, []);

  // Save to local storage automatically
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(inventories));
    }
  }, [inventories, isLoaded]);

  const saveInventory = (newInv: Inventory) => {
    setInventories((prev) => {
      const idx = prev.findIndex((i) => i.id === newInv.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = newInv;
        return next;
      }
      return [...prev, newInv];
    });
    
    if (currentInventory?.id === newInv.id) {
      setCurrentInventory(newInv);
    }
  };

  const deleteInventory = (id: number) => {
    setInventories((prev) => prev.filter((i) => i.id !== id));
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
