# Regole R8 per la build di release (minifyEnabled true in build.gradle).
#
# Capacitor e le librerie Google (Play Billing, Play services auth) portano già le
# loro regole; queste sotto sono una protezione in più per le parti che il codice
# web raggiunge per nome, dove un nome cambiato romperebbe la funzione solo nella
# versione pubblicata.

# Plugin nativi dell'app (OBD Bluetooth, acquisto Pro, accesso a Drive, widget):
# Capacitor li trova per nome e chiama i metodi @PluginMethod via riflessione.
-keep class com.micmax.diarioauto.** { *; }

# Capacitor e i suoi plugin ufficiali lavorano quasi tutto per riflessione:
# trovano i plugin per nome e leggono a runtime le annotazioni @CapacitorPlugin,
# @Permission, @PermissionCallback... Con R8 in modalità completa (default da AGP 8)
# le annotazioni e le loro classi venivano tolte: il plugin delle notifiche falliva
# il controllo dei permessi anche con il permesso concesso. Si tengono interi.
-keep class com.getcapacitor.** { *; }
-keep interface com.getcapacitor.** { *; }
-keep @interface com.getcapacitor.** { *; }
-keep class com.capacitorjs.plugins.** { *; }
-keep @com.getcapacitor.annotation.CapacitorPlugin public class * { *; }
-keep public class * extends com.getcapacitor.Plugin { *; }
-keepattributes *Annotation*, RuntimeVisibleAnnotations, RuntimeVisibleParameterAnnotations, AnnotationDefault, Signature, InnerClasses, EnclosingMethod

# Ponte JavaScript ↔ Android della WebView.
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Numeri di riga nei report di crash di Play Console (con il file mapping.txt).
-keepattributes SourceFile, LineNumberTable
-renamesourcefileattribute SourceFile
