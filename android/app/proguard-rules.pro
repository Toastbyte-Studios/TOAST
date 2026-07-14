# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# Add any project specific keep options here:

# ── Hermes ────────────────────────────────────────────────────────────────────
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# ── React Native ──────────────────────────────────────────────────────────────
-keep,allowobfuscation @interface com.facebook.proguard.annotations.DoNotStrip
-keep,allowobfuscation @interface com.facebook.proguard.annotations.KeepGettersAndSetters
-keep @com.facebook.proguard.annotations.DoNotStrip class *
-keepclassmembers class * {
    @com.facebook.proguard.annotations.DoNotStrip *;
    @com.facebook.proguard.annotations.KeepGettersAndSetters *;
}

# ── react-native-svg ─────────────────────────────────────────────────────────
-keep public class com.horcrux.svg.** { *; }

# ── react-native-sensors ─────────────────────────────────────────────────────
-keep class com.sensors.** { *; }

# ── react-native-sqlite-storage ──────────────────────────────────────────────
-keep class org.pgsqlite.** { *; }

# ── react-native-geolocation-service ─────────────────────────────────────────
-keep class com.agontuk.RNFusedLocation.** { *; }

# ── react-native-device-info ─────────────────────────────────────────────────
-keep class com.learnium.RNDeviceInfo.** { *; }

# ── react-native-linear-gradient ─────────────────────────────────────────────
-keep class com.BV.LinearGradient.** { *; }

# ── react-native-vector-icons ────────────────────────────────────────────────
-keep class com.oblador.vectoricons.** { *; }

# ── react-native-webview ─────────────────────────────────────────────────────
-keep class com.reactnativecommunity.webview.** { *; }

# ── react-native-bootsplash ──────────────────────────────────────────────────
-keep class com.zoontek.rnbootsplash.** { *; }

# ── TOAST native modules ─────────────────────────────────────────────────────
-keep class com.toast.** { *; }
