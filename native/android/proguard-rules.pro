# Capacitor and the SDK AARs contribute their own consumer rules. Do not keep
# entire SDK packages: that would prevent removal of unused formats and code.
# JavaScript invokes these methods by name and reads plugin annotations.
-keepattributes RuntimeVisibleAnnotations,AnnotationDefault
# Capacitor 8.5.x: metadata can still exist in DEX while R8 folds its cached
# annotation to null. Keep the annotation types as in upstream fix #8646.
# https://github.com/ionic-team/capacitor/pull/8646
-keep @interface com.getcapacitor.annotation.** { *; }
-keep @interface com.getcapacitor.PluginMethod { *; }
-keep class **.SeedsMonetizationPlugin { *; }
-keep class **.SeedsEngagementPlugin { *; }
# Preserve the names of two SDK entry points for APK diagnostics; optimizations
# and removal of unreachable members remain allowed.
-keepnames class com.yandex.mobile.ads.banner.BannerAdView
-keepnames class io.appmetrica.analytics.AppMetrica

-keep class **.SeedsFeedbackPlugin { *; }
