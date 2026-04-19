import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  enableIndexedDbPersistence
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyAlyrW_aFVslZVYEQX22ziovuRaMNts7ag",
  authDomain: "studio-1022270380-4e10a.firebaseapp.com",
  projectId: "studio-1022270380-4e10a",
  storageBucket: "studio-1022270380-4e10a.firebasestorage.app",
  messagingSenderId: "1047475394840",
  appId: "1:1047475394840:web:304af178949bfaf766a66d"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const provider = new GoogleAuthProvider();

export const db = getFirestore(app);

export const storage = getStorage(app);

// Activating local persistence strictly for offline forestry collections
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code == 'failed-precondition') {
      console.warn("Múltiplas abas abertas não suportam sincronização offline em paralelo no Firebase.");
    } else if (err.code == 'unimplemented') {
      console.warn("Seu browser não suporta IndexedDB/Offline do Firestore.");
    }
  });
// ...existing code...
