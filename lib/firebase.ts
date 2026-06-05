import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC87sighWOec92xDle9KlLgJ8aC1IQm9lA",
  authDomain: "edumentor-ai-f6dbc.firebaseapp.com",
  projectId: "edumentor-ai-f6dbc",
  storageBucket: "edumentor-ai-f6dbc.firebasestorage.app",
  messagingSenderId: "139374477833",
  appId: "1:139374477833:web:fefb8d05447ed5a956aed8",
  measurementId: "G-8C03DN84CB"
};

// Инициализация Firebase (проверка, чтобы не запускать дважды при перезагрузке)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };