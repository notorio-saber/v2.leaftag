// IndexedDB wrapper for offline photos
const DB_NAME = 'LeafTagPhotosDB';
const STORE_NAME = 'photos';

export interface PhotoRecord {
  id?: number;
  inventoryId: number;
  individualId: string;
  fileName: string;
  base64Data: string;
}

export const initPhotoDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onerror = () => reject(request.error);

    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (e: any) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('inventoryId', 'inventoryId', { unique: false });
        store.createIndex('fileName', 'fileName', { unique: true });
      }
    };
  });
};

export const savePhoto = async (photo: Omit<PhotoRecord, 'id'>): Promise<number> => {
  const db = await initPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.add(photo);
    
    request.onsuccess = () => resolve(request.result as number);
    request.onerror = () => reject(request.error);
  });
};

export const getPhotosForInventory = async (inventoryId: number): Promise<PhotoRecord[]> => {
  const db = await initPhotoDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const index = store.index('inventoryId');
    const request = index.getAll(inventoryId);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

export const deletePhotosForIndividual = async (individualId: string): Promise<void> => {
  const db = await initPhotoDB();
  // Simplified deletion iteration since IDB doesn't have multi-index compound delete natively here
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => {
      const all = request.result as PhotoRecord[];
      const toDelete = all.filter(p => p.individualId === individualId);
      toDelete.forEach(record => {
        if(record.id) store.delete(record.id);
      });
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

// Canvas-based client-side compression
export const compressImage = (file: File, maxWidth = 1200, quality = 0.6, watermarkText?: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error("Canvas context failed"));
        
        ctx.drawImage(img, 0, 0, width, height);

        // Add Watermark if provided
        if (watermarkText) {
          const fontSize = Math.max(14, Math.floor(width * 0.03));
          ctx.font = `bold ${fontSize}px sans-serif`;
          
          const padding = fontSize;
          const textX = padding;
          
          const lines = watermarkText.split('\n');
          const lineHeight = fontSize * 1.5;
          const rectHeight = (lines.length * lineHeight) + padding;
          
          // Draw semi-transparent background for text visibility
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(0, height - rectHeight, width, rectHeight);
          
          // Draw text lines
          ctx.fillStyle = 'white';
          ctx.textBaseline = 'bottom';
          lines.forEach((line, index) => {
             const yOffset = height - padding - ((lines.length - 1 - index) * lineHeight);
             ctx.fillText(line, textX, yOffset);
          });
        }

        // Emits base64 JPEG format payload drastically reduced byte-count
        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = (e) => reject(e);
    };
    reader.onerror = (e) => reject(e);
  });
};
