import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"; // Ajoute cette ligne
import { getFirestore } from "firebase/firestore"; // Ajoute cette ligne

const firebaseConfig = {
  apiKey: "...",
  authDomain: "...",
  projectId: "...",
  storageBucket: "...",
  messagingSenderId: "...",
  appId: "..."
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app); // C'est bon
export const db = getFirestore(app); // C'est bon