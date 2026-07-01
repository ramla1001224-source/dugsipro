importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/8.10.1/firebase-messaging.js');

// Initialize the Firebase app in the service worker by passing in the
// messagingSenderId.
firebase.initializeApp({
  apiKey: "AIzaSyDp-W9TkQn3afDigMhhbT1wkE75IdpnWKQ",
  authDomain: "smart-school-pro-6a325.firebaseapp.com",
  projectId: "smart-school-pro-6a325",
  storageBucket: "smart-school-pro-6a325.firebasestorage.app",
  messagingSenderId: "628400203412",
  appId: "1:628400203412:web:a2b8c9d0e1f2g3h4i5j6k7", 
});

// Retrieve an instance of Firebase Messaging so that it can handle background
// messages.
const messaging = firebase.messaging();

messaging.onBackgroundMessage(function(payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/logo.png', // Assuming you have a logo.png in public folder
    data: payload.data,
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
