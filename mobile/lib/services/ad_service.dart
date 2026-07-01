import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:dio/dio.dart';
import 'package:url_launcher/url_launcher.dart';
import '../config/api_config.dart';

/// AdService - Maamulka Xayasiiska (Google AdMob + Custom Ads)
class AdService {
  AdService._();
  static final AdService instance = AdService._();

  bool _initialized = false;
  Map<String, dynamic>? customAdData;

  // ─── Test Ad Unit IDs (baadal kuwan production-ga) ───────────────
  // Android
  static const String _androidBannerAdUnitId =
      'ca-app-pub-3940256099942544/6300978111'; // Test Banner

  // iOS
  static const String _iosBannerAdUnitId =
      'ca-app-pub-3940256099942544/2934735716'; // Test Banner

  // ─── Production IDs-kaaga cusub halkan ku dhig ─────────────────
  // static const String _androidBannerAdUnitId = 'ca-app-pub-XXXXXXXX/XXXXXXXX';
  // static const String _iosBannerAdUnitId     = 'ca-app-pub-XXXXXXXX/XXXXXXXX';

  String get bannerAdUnitId {
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      return _iosBannerAdUnitId;
    }
    return _androidBannerAdUnitId;
  }

  /// Initialize AdMob SDK
  Future<void> initialize() async {
    if (_initialized) return;
    await MobileAds.instance.initialize();
    
    // Fetch custom ad in the background
    await fetchCustomAd();
    
    _initialized = true;
    debugPrint('[AdService] Initialized ✓');
  }

  Future<void> fetchCustomAd() async {
    try {
      final dio = Dio();
      final response = await dio.get('${ApiConfig.baseUrl}${ApiConfig.customAd}');
      if (response.statusCode == 200 && response.data != null) {
        customAdData = response.data;
        debugPrint('[AdService] Custom Ad loaded ✓');
      }
    } catch (e) {
      debugPrint('[AdService] Failed to load custom ad: $e');
    }
  }

  /// Load a Banner Ad - geli callback marka la load garey
  void loadBannerAd({
    AdSize size = AdSize.banner,
    required void Function(BannerAd ad) onLoaded,
    void Function()? onFailed,
  }) {
    BannerAd(
      adUnitId: bannerAdUnitId,
      size: size,
      request: const AdRequest(),
      listener: BannerAdListener(
        onAdLoaded: (ad) => onLoaded(ad as BannerAd),
        onAdFailedToLoad: (ad, error) {
          ad.dispose();
          debugPrint('[AdService] Banner failed: ${error.message}');
          onFailed?.call();
        },
      ),
    ).load();
  }

  // Interstitial Ad Unit IDs
  static const String _androidInterstitialAdUnitId = 'ca-app-pub-3940256099942544/1033173712'; // Test Interstitial
  static const String _iosInterstitialAdUnitId = 'ca-app-pub-3940256099942544/4411468910'; // Test Interstitial

  String get interstitialAdUnitId {
    if (defaultTargetPlatform == TargetPlatform.iOS) {
      return _iosInterstitialAdUnitId;
    }
    return _androidInterstitialAdUnitId;
  }

  /// Show Google Interstitial Ad
  void showGoogleInterstitial() {
    InterstitialAd.load(
      adUnitId: interstitialAdUnitId,
      request: const AdRequest(),
      adLoadCallback: InterstitialAdLoadCallback(
        onAdLoaded: (InterstitialAd ad) {
          debugPrint('[AdService] Interstitial Ad loaded');
          ad.fullScreenContentCallback = FullScreenContentCallback(
            onAdDismissedFullScreenContent: (InterstitialAd ad) {
              ad.dispose();
            },
            onAdFailedToShowFullScreenContent: (InterstitialAd ad, AdError error) {
              ad.dispose();
            },
          );
          ad.show();
        },
        onAdFailedToLoad: (LoadAdError error) {
          debugPrint('[AdService] Interstitial Ad failed to load: $error');
        },
      ),
    );
  }

  bool get isInitialized => _initialized;
}

class AdNavigationObserver extends NavigatorObserver {
  int _pageClicks = 0;
  bool _showGoogleAdNext = true;

  @override
  void didPush(Route<dynamic> route, Route<dynamic>? previousRoute) {
    super.didPush(route, previousRoute);
    _handleNavigation(route.navigator?.context);
  }

  void _handleNavigation(BuildContext? context) {
    if (context == null) return;
    _pageClicks++;
    if (_pageClicks >= 3) {
      _pageClicks = 0;
      _showInterstitialAd(context);
    }
  }

  void _showInterstitialAd(BuildContext context) {
    final adData = AdService.instance.customAdData;
    // Check if custom ad is active and we shouldn't force useGoogle
    bool customAdActive = adData != null && adData['isActive'] == true && adData['useGoogle'] != true;

    if (customAdActive) {
      if (_showGoogleAdNext) {
        AdService.instance.showGoogleInterstitial();
        _showGoogleAdNext = false;
      } else {
        _showCustomInterstitialDialog(context, adData);
        _showGoogleAdNext = true;
      }
    } else {
      AdService.instance.showGoogleInterstitial();
    }
  }

  void _showCustomInterstitialDialog(BuildContext context, Map<String, dynamic> adData) {
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (context) {
        return _CustomInterstitialDialog(adData: adData);
      },
    );
  }
}

class _CustomInterstitialDialog extends StatelessWidget {
  final Map<String, dynamic> adData;
  const _CustomInterstitialDialog({required this.adData});

  @override
  Widget build(BuildContext context) {
    final title = adData['title'] ?? 'Ogaysiis';
    final subtitle = adData['subtitle'] ?? '';
    final imageUrl = adData['imageUrl'];
    final ctaText = adData['ctaText'] ?? 'Booqasho';
    const accentColor = Color(0xFF6366F1);

    return Dialog(
      backgroundColor: Colors.transparent,
      insetPadding: const EdgeInsets.all(20),
      child: Stack(
        alignment: Alignment.center,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (imageUrl != null)
                  ClipRRect(
                    borderRadius: BorderRadius.circular(16),
                    child: Image.network(
                      imageUrl.startsWith('http') ? imageUrl : '${ApiConfig.baseUrl}$imageUrl',
                      height: 180,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => _buildIconPlaceholder(accentColor),
                    ),
                  )
                else
                  _buildIconPlaceholder(accentColor),
                const SizedBox(height: 24),
                Text(
                  title,
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  subtitle,
                  style: const TextStyle(
                    fontSize: 15,
                    color: Color(0xFF64748B),
                    height: 1.5,
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 32),
                SizedBox(
                  width: double.infinity,
                  height: 54,
                  child: ElevatedButton(
                    onPressed: () async {
                      Navigator.of(context).pop();
                      final String? urlString = adData['linkUrl'];
                      if (urlString != null && urlString.isNotEmpty) {
                        try {
                          final Uri url = Uri.parse(urlString);
                          await launchUrl(url, mode: LaunchMode.externalApplication);
                        } catch(e) {
                          debugPrint('URL launch error: $e');
                        }
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: accentColor,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 0,
                    ),
                    child: Text(
                      ctaText,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: Colors.white,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
          Positioned(
            top: 8,
            right: 8,
            child: IconButton(
              icon: const Icon(Icons.close_rounded, color: Colors.black54),
              style: IconButton.styleFrom(
                backgroundColor: Colors.white.withOpacity(0.8),
              ),
              onPressed: () => Navigator.of(context).pop(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildIconPlaceholder(Color accentColor) {
    return Container(
      height: 180,
      width: double.infinity,
      decoration: BoxDecoration(
        color: accentColor.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Icon(Icons.campaign_rounded, color: accentColor, size: 64),
    );
  }
}
