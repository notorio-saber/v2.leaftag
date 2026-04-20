import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  enableIndexedDbPersistence
} from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyCF_OXPZCMWTcVNtv3ZUzYM5nrf6oWVMi4",
  authDomain: "leaftag.firebaseapp.com",
  projectId: "leaftag",
  storageBucket: "leaftag.firebasestorage.app",
  messagingSenderId: "788814442608",
  appId: "1:788814442608:web:0cd8c6972dcf41b49c84b5"
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
