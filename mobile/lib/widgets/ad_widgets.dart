import 'package:flutter/material.dart';
import 'package:flutter_screenutil/flutter_screenutil.dart';
import 'package:google_mobile_ads/google_mobile_ads.dart';
import 'package:url_launcher/url_launcher.dart';
import '../services/ad_service.dart';
import '../config/api_config.dart';

// ─────────────────────────────────────────────────────────────────────────────
// GoogleBannerAdWidget – Shows a real Google AdMob banner ad
// ─────────────────────────────────────────────────────────────────────────────
class GoogleBannerAdWidget extends StatefulWidget {
  final AdSize size;
  final EdgeInsetsGeometry margin;

  const GoogleBannerAdWidget({
    super.key,
    this.size = AdSize.banner,
    this.margin = const EdgeInsets.symmetric(vertical: 8),
  });

  @override
  State<GoogleBannerAdWidget> createState() => _GoogleBannerAdWidgetState();
}

class _GoogleBannerAdWidgetState extends State<GoogleBannerAdWidget> {
  BannerAd? _bannerAd;

  @override
  void initState() {
    super.initState();
    _loadAd();
  }

  void _loadAd() {
    AdService.instance.loadBannerAd(
      size: widget.size,
      onLoaded: (ad) {
        if (mounted) setState(() => _bannerAd = ad);
      },
      onFailed: () {
        if (mounted) setState(() => _bannerAd = null);
      },
    );
  }

  @override
  void dispose() {
    _bannerAd?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (_bannerAd == null) return const SizedBox.shrink();
    return Container(
      margin: widget.margin,
      alignment: Alignment.center,
      width: _bannerAd!.size.width.toDouble(),
      height: _bannerAd!.size.height.toDouble(),
      child: AdWidget(ad: _bannerAd!),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// CustomAdWidget – Premium full-width custom ad banner
// ─────────────────────────────────────────────────────────────────────────────
class CustomAdWidget extends StatelessWidget {
  final String title;
  final String subtitle;
  final String? imageUrl;
  final String? ctaText;
  final VoidCallback? onTap;
  final Color accentColor;

  const CustomAdWidget({
    super.key,
    required this.title,
    required this.subtitle,
    this.imageUrl,
    this.ctaText,
    this.onTap,
    this.accentColor = const Color(0xFF6366F1),
  });

  String _getFullImageUrl(String? url) {
    if (url == null || url.isEmpty) return '';
    if (url.startsWith('http')) return url;
    final base = ApiConfig.baseUrl.replaceAll(RegExp(r'/+$'), '');
    final path = url.startsWith('/') ? url : '/$url';
    return '$base$path';
  }

  @override
  Widget build(BuildContext context) {
    final fullImageUrl = _getFullImageUrl(imageUrl);

    return Container(
      margin: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24.r),
        gradient: LinearGradient(
          colors: [
            accentColor,
            accentColor.withValues(alpha: 0.75),
          ],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        boxShadow: [
          BoxShadow(
            color: accentColor.withValues(alpha: 0.3),
            blurRadius: 20.r,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        borderRadius: BorderRadius.circular(24.r),
        child: InkWell(
          borderRadius: BorderRadius.circular(24.r),
          onTap: onTap,
          child: Stack(
            children: [
              // Decorative circles background
              Positioned(
                top: -30.h,
                right: -30.w,
                child: Container(
                  width: 120.w,
                  height: 120.h,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              Positioned(
                bottom: -20.h,
                left: -20.w,
                child: Container(
                  width: 80.w,
                  height: 80.h,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.08),
                    shape: BoxShape.circle,
                  ),
                ),
              ),
              // Content
              Padding(
                padding: EdgeInsets.all(20.w),
                child: Row(
                  children: [
                    // Image or placeholder
                    if (fullImageUrl.isNotEmpty)
                      GestureDetector(
                        onTap: () => showFullScreenImage(context, fullImageUrl),
                        child: ClipRRect(
                          borderRadius: BorderRadius.circular(16.r),
                          child: Image.network(
                            fullImageUrl,
                            width: 80.w,
                            height: 80.h,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => _buildIconPlaceholder(),
                          ),
                        ),
                      )
                    else
                      _buildIconPlaceholder(),
                    SizedBox(width: 16.w),
                    // Text content
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Container(
                            padding: EdgeInsets.symmetric(horizontal: 8.w, vertical: 3.h),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(6.r),
                            ),
                            child: Text(
                              'OGAYSIIS',
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 8.sp,
                                fontWeight: FontWeight.w900,
                                letterSpacing: 1.5,
                              ),
                            ),
                          ),
                          SizedBox(height: 8.h),
                          Text(
                            title,
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 15.sp,
                              fontWeight: FontWeight.w900,
                              height: 1.2,
                            ),
                            maxLines: 2,
                            overflow: TextOverflow.ellipsis,
                          ),
                          if (subtitle.isNotEmpty) ...[
                            SizedBox(height: 4.h),
                            Text(
                              subtitle,
                              style: TextStyle(
                                color: Colors.white70,
                                fontSize: 11.sp,
                              ),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                          if (ctaText != null && ctaText!.isNotEmpty) ...[
                            SizedBox(height: 12.h),
                            Container(
                              padding: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(20.r),
                              ),
                              child: Text(
                                ctaText!,
                                style: TextStyle(
                                  color: accentColor,
                                  fontSize: 11.sp,
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildIconPlaceholder() {
    return Container(
      width: 64.w,
      height: 64.h,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(14.r),
      ),
      child: const Icon(Icons.campaign_rounded, color: Colors.white, size: 28),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// InlineSectionAd – Automatically chooses Google or Custom ad
// ─────────────────────────────────────────────────────────────────────────────
class InlineSectionAd extends StatelessWidget {
  final bool useGoogle;

  const InlineSectionAd({
    super.key,
    this.useGoogle = true,
  });

  Future<void> _launchUrl(String? urlString) async {
    if (urlString == null || urlString.isEmpty) return;
    String finalUrl = urlString.trim();
    if (!finalUrl.startsWith('http') &&
        !finalUrl.startsWith('mailto:') &&
        !finalUrl.startsWith('tel:') &&
        !finalUrl.startsWith('sms:') &&
        !finalUrl.startsWith('whatsapp:')) {
      finalUrl = 'https://$finalUrl';
    }
    final Uri url = Uri.parse(finalUrl);
    try {
      await launchUrl(url, mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('Could not launch $finalUrl: $e');
    }
  }

  @override
  Widget build(BuildContext context) {
    final adData = AdService.instance.customAdData;
    bool showGoogle = useGoogle;

    if (adData != null && adData['isActive'] == true) {
      if (adData['useGoogle'] == true) {
        showGoogle = true;
      } else {
        showGoogle = false;
        return CustomAdWidget(
          title: adData['title'] ?? 'Ogaysiis',
          subtitle: adData['subtitle'] ?? '',
          imageUrl: adData['imageUrl'],
          ctaText: adData['ctaText'],
          onTap: () => _launchUrl(adData['linkUrl']),
          accentColor: const Color(0xFF6366F1),
        );
      }
    }

    if (showGoogle) {
      return GoogleBannerAdWidget(
        margin: EdgeInsets.symmetric(horizontal: 16.w, vertical: 8.h),
      );
    }

    return const SizedBox.shrink();
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// showFullScreenImage – Opens image in full screen zoomable dialog
// ─────────────────────────────────────────────────────────────────────────────
void showFullScreenImage(BuildContext context, String imageUrl) {
  showDialog(
    context: context,
    builder: (BuildContext context) {
      return Dialog(
        backgroundColor: Colors.transparent,
        insetPadding: EdgeInsets.zero,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Positioned.fill(
              child: GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Container(color: Colors.black.withValues(alpha: 0.95)),
              ),
            ),
            InteractiveViewer(
              panEnabled: true,
              boundaryMargin: const EdgeInsets.all(20),
              minScale: 0.5,
              maxScale: 4.0,
              child: Image.network(
                imageUrl,
                fit: BoxFit.contain,
                width: double.infinity,
              ),
            ),
            Positioned(
              top: 40,
              right: 16,
              child: GestureDetector(
                onTap: () => Navigator.of(context).pop(),
                child: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.close_rounded, color: Colors.white, size: 28),
                ),
              ),
            ),
          ],
        ),
      );
    },
  );
}
