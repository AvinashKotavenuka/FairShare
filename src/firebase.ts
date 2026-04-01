import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: "AIzaSyDVbQWWulqZ2Jjs2mk2TxdQgNm6RhXMnbI",
    authDomain: "fairshare-ca9ee.firebaseapp.com",
    projectId: "fairshare-ca9ee",
    storageBucket: "fairshare-ca9ee.firebasestorage.app",
    messagingSenderId: "108825525634",
    appId: "1:108825525634:web:0bd1091b5e92cc3f2a239b",
    measurementId: "G-QR2XCC1JD8"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
