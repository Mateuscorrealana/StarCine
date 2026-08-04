// /js/firebase-init.js
// Ponto único de inicialização do Firebase. script.js e perfil.js importam
// "auth", "db" e "googleProvider" daqui — assim a configuração fica num
// lugar só.
//
// A "apiKey" abaixo NÃO é um segredo, ao contrário da chave da TMDB. O
// Firebase é protegido pelas regras de segurança do Firestore (quem pode
// ler/escrever o quê), não por esconder essa chave. Pode ficar tranquilo
// com ela aparecendo no código do navegador.

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import {
  getAuth,
  GoogleAuthProvider
} from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyC5B2Q9q1vpSJYMAwhl3MNLAnz8EIfoamo",
  authDomain: "starcine-d29ea.firebaseapp.com",
  projectId: "starcine-d29ea",
  storageBucket: "starcine-d29ea.firebasestorage.app",
  messagingSenderId: "875320488841",
  appId: "1:875320488841:web:dd1f2442b0b5526c7ea758"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export const googleProvider = new GoogleAuthProvider();
// força o seletor de contas do Google a aparecer sempre — é o que
// resolve o "trocar de conta" de forma confiável
googleProvider.setCustomParameters({ prompt: "select_account" });