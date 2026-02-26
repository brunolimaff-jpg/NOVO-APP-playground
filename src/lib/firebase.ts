// Este projeto usa importmap (ESM via CDN)
// Firebase é carregado via compat SDK global no index.html
// Este arquivo é mantido apenas para compatibilidade de imports existentes

declare global {
  interface Window {
    firebase: any;
    firebaseConfig: any;
  }
}

function getApp() {
  if (typeof window === 'undefined' || !window.firebase) return null;
  if (!window.firebase.apps?.length) {
    window.firebase.initializeApp(window.firebaseConfig);
  }
  return window.firebase;
}

export const auth = new Proxy({}, {
  get: (_, prop) => {
    const fb = getApp();
    if (!fb) return undefined;
    const a = fb.auth();
    return typeof a[prop as string] === 'function' ? (a[prop as string]).bind(a) : a[prop as string];
  }
});

export const db = new Proxy({}, {
  get: (_, prop) => {
    const fb = getApp();
    if (!fb) return undefined;
    const d = fb.firestore();
    return typeof d[prop as string] === 'function' ? (d[prop as string]).bind(d) : d[prop as string];
  }
});

export const analytics = null;
export default null;
