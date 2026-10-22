# Capacitor and the SDK AARs contribute their own consumer rules. Do not keep
# entire SDK packages: that would prevent removal of unused formats and code.
# JavaScript invokes these methods by name and reads plugin annotations.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
-keep class **.SeedsMonetizationPlugin { *; }
# Preserve the names of two SDK entry points for APK diagnostics; optimizations
# and removal of unreachable members remain allowed.
-keepnames class com.yandex.mobile.ads.banner.BannerAdView
-keepnames class io.appmetrica.analytics.AppMetrica
