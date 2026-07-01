import { initializeApp, getApps } from "firebase/app";
import { getMessaging, getToken, onMessage, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyDp-W9TkQn3afDigMhhbT1wkE75IdpnWKQ",
  authDomain: "smart-school-pro-6a325.firebaseapp.com",
  projectId: "smart-school-pro-6a325",
  storageBucket: "smart-school-pro-6a325.firebasestorage.app",
  messagingSenderId: "628400203412",
  appId: "1:628400203412:web:a2b8c9d0e1f2g3h4i5j6k7", // Dummy web app ID to satisfy SDK if web app isn't registered, but best to use exact if possible. We will leave it as standard format.
};

let app;
let messaging;

if (typeof window !== "undefined" && getApps().length === 0) {
  app = initializeApp(firebaseConfig);
} else if (typeof window !== "undefined") {
  app = getApps()[0];
}

export const requestForToken = async () => {
  try {
    if (typeof window !== "undefined") {
      const supported = await isSupported();
      if (!supported) {
        console.log("Firebase Messaging is not supported in this browser.");
        return null;
      }
      
      messaging = getMessaging(app);
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        const currentToken = await getToken(messaging, { 
          // You can pass vapidKey if you have one, otherwise FCM will use default project-level key
        });
        if (currentToken) {
          console.log("FCM Token:", currentToken);
          return currentToken;
        } else {
          console.log("No registration token available. Request permission to generate one.");
          return null;
        }
      } else {
        console.log("Notification permission denied");
        return null;
      }
    }
  } catch (err) {
    console.error("An error occurred while retrieving token. ", err);
    return null;
  }
};

export const onMessageListener = (callback) => {
  if (typeof window !== "undefined") {
    isSupported().then((supported) => {
      if (supported) {
        messaging = getMessaging(app);
        onMessage(messaging, (payload) => {
          callback(payload);
        });
      }
    });
  }
};

export { app, messaging };
