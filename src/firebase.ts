import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { doc, getDocFromServer, initializeFirestore } from 'firebase/firestore';
import { getAnalytics } from "firebase/analytics";

const firebaseConfig: {
  projectId: string;
  appId: string;
  apiKey: string;
  authDomain: string;
  storageBucket: string;
  messagingSenderId: string;
  measurementId?: string;
} = {
  projectId: "dashboard-1d583",
  appId: "1:159003602555:web:5cccc26c533d8461733cde",
  apiKey: "AIzaSyDcDvyVMCGdnDWbeH0iYNER0sGt9YOFKms",
  authDomain: "dashboard-1d583.firebaseapp.com",
  storageBucket: "dashboard-1d583.firebasestorage.app",
  messagingSenderId: "159003602555",
  measurementId: "G-2PW40D91WH"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Use initializeFirestore with settings optimized for restricted / iframe environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) ?? []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot as per guidelines
export async function testConnection(): Promise<boolean> {
  // Wait a small bit for state stabilization in iframes
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    // Try a lighter fetch first
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (err: unknown) {
    const error = err as { message?: string, code?: string };
    
    // Check if it's explicitly an offline error
    if (typeof error?.message === 'string' && (error.message.includes('the client is offline') || error.message.includes('failed-precondition'))) {
      console.warn("Firestore connection attempt: Client appears offline. Retrying with standard persistence...");
    }
    
    // "No document found" or "permission denied" is actually a successful connection if it reached the server
    if (error?.code === 'not-found' || error?.code === 'permission-denied' || 
        (typeof error?.message === 'string' && (error.message.includes('not-found') || error.message.includes('permission-denied')))) {
       return true;
    }
    return false;
  }
}
void testConnection();

export const googleProvider = new GoogleAuthProvider();

export const loginWithGoogle = () => signInWithPopup(auth, googleProvider);
export const logout = () => signOut(auth);
