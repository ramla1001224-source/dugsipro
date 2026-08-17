import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'dart:io';

import 'auth_service.dart';
import '../router/app_router.dart';
import '../providers/notification_provider.dart';
import 'package:provider/provider.dart';

// Top level background handler
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  debugPrint('[FCM Background] Message received: ${message.messageId}');
}

class PushNotificationService {
  static final PushNotificationService _instance = PushNotificationService._internal();
  factory PushNotificationService() => _instance;
  PushNotificationService._internal();

  final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  static const AndroidNotificationChannel _channel = AndroidNotificationChannel(
    'dugsipro_high_importance', // Must match the channel ID in backend and AndroidManifest.xml
    'DugsiPro Notifications',
    description: 'Alerts and updates for DugsiPro System',
    importance: Importance.max,
    playSound: true,
    enableVibration: true,
  );

  bool _initialized = false;

  Future<void> init() async {
    if (_initialized) return;
    try {
      // 1. Register background handler
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      // 2. Request Permissions (Critical for iOS and Android 13+)
      NotificationSettings settings = await FirebaseMessaging.instance.requestPermission(
        alert: true,
        badge: true,
        sound: true,
        provisional: false,
      );
      debugPrint('[FCM] Permission status: ${settings.authorizationStatus}');

      // 3. Initialize Local Notifications (For Foreground display)
      // Use @mipmap/ic_launcher for Android because ic_launcher is not in drawable
      const androidInit = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosInit = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );
      
      await _localNotifications.initialize(
        const InitializationSettings(android: androidInit, iOS: iosInit),
        onDidReceiveNotificationResponse: (NotificationResponse response) {
          debugPrint('[FCM Local] Notification tapped: ${response.payload}');
          _handleNotificationTap();
        },
      );

      // 4. Create Android Channel
      if (Platform.isAndroid) {
        await _localNotifications
            .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
            ?.createNotificationChannel(_channel);
      }

      // 5. Set foreground presentation options (iOS mostly)
      await FirebaseMessaging.instance.setForegroundNotificationPresentationOptions(
        alert: true,
        badge: true,
        sound: true,
      );

      // 6. Token Management
      String? token = await FirebaseMessaging.instance.getToken();
      debugPrint('[FCM] Initial Token: $token');
      if (token != null) {
        _updateTokenOnBackend(token);
      }

      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        debugPrint('[FCM] Token Refreshed: $newToken');
        _updateTokenOnBackend(newToken);
      });

      // 7. Setup Listeners
      _setupMessageHandlers();
      
      _initialized = true;
    } catch (e) {
      debugPrint('[FCM] Initialization Error: $e');
    }
  }

  void _setupMessageHandlers() {
    // A. App in Foreground
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('[FCM Foreground] Message received: ${message.notification?.title}');
      
      if (message.notification != null) {
        _showLocalNotification(message);
        
        // Refresh Notification Provider if possible
        _refreshNotificationProvider();
      }
    });

    // B. App Opened from Background via Tap
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('[FCM Opened] Message tapped from background');
      _handleNotificationTap();
    });

    // C. App Opened from Terminated via Tap
    FirebaseMessaging.instance.getInitialMessage().then((RemoteMessage? message) {
      if (message != null) {
        debugPrint('[FCM Initial] App opened from terminated state via notification');
        Future.delayed(const Duration(milliseconds: 1000), () {
          _handleNotificationTap();
        });
      }
    });
  }

  void _showLocalNotification(RemoteMessage message) {
    // Attempt to get title and body from notification object OR data object
    String? title = message.notification?.title ?? message.data['title'];
    String? body = message.notification?.body ?? message.data['body'];
    
    // If we have neither, we can't show much
    if (title == null && body == null) {
      debugPrint('[FCM Local] No title or body found in message');
      return;
    }

    final String safeTitle = title ?? 'Dugsi Pro';
    final String safeBody  = body ?? '';

    _localNotifications.show(
      message.hashCode,
      safeTitle,
      safeBody,
      NotificationDetails(
        android: AndroidNotificationDetails(
          _channel.id,
          _channel.name,
          channelDescription: _channel.description,
          icon: '@mipmap/ic_launcher',
          importance: Importance.max,
          priority: Priority.max,
          playSound: true,
          enableVibration: true,
          // BigTextStyle — shows the full long message in the Android notification shade
          // instead of truncating it to one line.
          styleInformation: BigTextStyleInformation(
            safeBody,
            contentTitle: safeTitle,
            summaryText: 'DugsiPro',
            htmlFormatContent: false,
            htmlFormatContentTitle: false,
          ),
        ),
        iOS: const DarwinNotificationDetails(
          presentAlert: true,
          presentBadge: true,
          presentSound: true,
        ),
      ),
      payload: message.data.toString(),
    );
  }

  void _handleNotificationTap() {
    try {
      // Refresh Provider and navigate
      _refreshNotificationProvider();
      AppRouter.router.push('/notifications');
    } catch (e) {
      debugPrint('[FCM Tap Error] $e');
    }
  }

  void _refreshNotificationProvider() {
    try {
      final context = AppRouter.router.routerDelegate.navigatorKey.currentContext;
      if (context != null) {
        Provider.of<NotificationProvider>(context, listen: false).refresh();
      }
    } catch (e) {
      debugPrint('[FCM Refresh Error] $e');
    }
  }

  Future<void> _updateTokenOnBackend(String token) async {
    try {
      final authService = AuthService();
      final isLoggedIn = await authService.isLoggedIn();
      if (isLoggedIn) {
        await authService.updateFCMToken(token);
        debugPrint('[FCM] Token updated on backend successfully');
      }
    } catch (e) {
      debugPrint('[FCM] Token backend update failed: $e');
    }
  }
}
