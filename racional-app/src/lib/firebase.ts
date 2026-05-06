import { initializeApp, type FirebaseOptions } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const fallbackConfig: FirebaseOptions = {
  apiKey: "AIzaSyArGiRgGd2MfE65_9sjE2QX49gt1sP0GmA",
  authDomain: "racional-exam.firebaseapp.com",
  databaseURL: "https://racional-exam.firebaseio.com",
  projectId: "racional-exam",
  storageBucket: "racional-exam.appspot.com",
  messagingSenderId: "669314004725",
  appId: "1:669314004725:web:48bd14a97d7db43c91f7bc",
};

const env = import.meta.env;

const firebaseConfig: FirebaseOptions = {
  apiKey: env.VITE_FIREBASE_API_KEY ?? fallbackConfig.apiKey,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN ?? fallbackConfig.authDomain,
  databaseURL: env.VITE_FIREBASE_DATABASE_URL ?? fallbackConfig.databaseURL,
  projectId: env.VITE_FIREBASE_PROJECT_ID ?? fallbackConfig.projectId,
  storageBucket:
    env.VITE_FIREBASE_STORAGE_BUCKET ?? fallbackConfig.storageBucket,
  messagingSenderId:
    env.VITE_FIREBASE_MESSAGING_SENDER_ID ?? fallbackConfig.messagingSenderId,
  appId: env.VITE_FIREBASE_APP_ID ?? fallbackConfig.appId,
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

export const INVESTMENT_DOC_PATH = {
  collection: "investmentEvolutions",
  document: "user1",
} as const;
