import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getAnalytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: 'AIzaSyBP8o94tu5z8hPWNaS7nHgeexa7TZfoZbM',
  authDomain: 'mvp-scout.firebaseapp.com',
  projectId: 'mvp-scout',
  storageBucket: 'mvp-scout.firebasestorage.app',
  messagingSenderId: '320823705923',
  appId: '1:320823705923:web:db9a1b7dead3a4e587eff6',
  measurementId: 'G-PM0BQS73BG'
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const analytics = getAnalytics(app);
export default app;
