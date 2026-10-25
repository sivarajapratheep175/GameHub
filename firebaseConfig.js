import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth, getReactNativePersistence, initializeAuth } from "firebase/auth";
import { getFunctions } from "firebase/functions";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const firebaseConfig = {
  apiKey: "AIzaSyCCtSeAJsbR9HG5W4cFyr5jOnSvugNmFsg",
  authDomain: "chessapp175.firebaseapp.com",
  projectId: "chessapp175",
  storageBucket: "chessapp175.firebasestorage.app",
  messagingSenderId: "701416920931",
  appId: "1:701416920931:web:f149d29b926ae0ae4ba556",
  measurementId: "G-6B3F1SXRB7",
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = Platform.OS === "web"
  ? getAuth(app)
  : initializeAuth(app, {
      persistence: getReactNativePersistence(AsyncStorage),
    });

export const db = getFirestore(app);
export { auth };
export const functions = getFunctions(app);
export const storage = getStorage(app);
