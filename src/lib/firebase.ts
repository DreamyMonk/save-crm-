import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";
import { Firestore, getFirestore } from "firebase/firestore";

export const firebaseConfig = {
  apiKey: "AIzaSyDGlsP6deXj9ew17NB-M1xSX0NaajVNrHE",
  authDomain: "crmsave-d4dbc.firebaseapp.com",
  projectId: "crmsave-d4dbc",
  storageBucket: "crmsave-d4dbc.firebasestorage.app",
  messagingSenderId: "381451841827",
  appId: "1:381451841827:web:29f4881db828c6d1695c96",
  measurementId: "G-28JYN1Q5RF",
};

let dbInstance: Firestore | null = null;
let authInstance: Auth | null = null;

export function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig);
}

export function getFirebaseDb(): Firestore {
  if (!dbInstance) {
    dbInstance = getFirestore(getFirebaseApp());
  }
  return dbInstance;
}

export function getFirebaseAuth(): Auth {
  if (!authInstance) {
    authInstance = getAuth(getFirebaseApp());
  }
  return authInstance;
}
