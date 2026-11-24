package com.seedsbits.game.preview;

import android.content.Context;
import android.content.SharedPreferences;
import android.content.pm.InstallSourceInfo;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.os.Build;
import android.util.AtomicFile;
import com.getcapacitor.JSObject;
import java.io.File;
import java.io.FileOutputStream;
import java.nio.charset.StandardCharsets;
import org.json.JSONObject;

/** Freeze the initial source in storage excluded from device backup and transfer. */
final class SeedsInstallStore {
  static final String KEY = "install_store";
  private static final String UNKNOWN = "unknown";
  private static final String[] FIELDS = {KEY, "store_evidence", "artifact_channel", "acquisition_state"};
  private static JSObject captured;

  private SeedsInstallStore() {}

  static synchronized JSObject capture(Context context) {
    if (captured != null) return copy(captured);
    AtomicFile file = new AtomicFile(new File(context.getNoBackupFilesDir(), "seeds-first-install.json"));
    try {
      JSONObject value = new JSONObject(new String(file.readFully(), StandardCharsets.UTF_8));
      JSObject restored = new JSObject();
      for (String field : FIELDS) restored.put(field, value.getString(field));
      captured = restored;
      return copy(captured);
    } catch (Exception ignored) {}

    SharedPreferences previous = context.getSharedPreferences("seeds-monetization", Context.MODE_PRIVATE);
    String remembered = previous.getString(KEY, UNKNOWN);
    boolean savedGame = context.getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE)
        .contains("seeds-bits.progress.v2");
    String artifact = context.getString(R.string.artifact_channel);
    JSObject result = determine(context, artifact, remembered, savedGame);
    FileOutputStream output = null;
    try {
      output = file.startWrite();
      output.write(result.toString().getBytes(StandardCharsets.UTF_8));
      file.finishWrite(output);
      captured = result;
    } catch (Exception failure) {
      if (output != null) file.failWrite(output);
      return context(UNKNOWN, "unavailable", UNKNOWN, "undetermined");
    }
    return copy(captured);
  }

  private static JSObject copy(JSObject data) {
    JSObject result = new JSObject();
    for (String field : FIELDS) result.put(field, data.optString(field, UNKNOWN));
    return result;
  }

  static JSObject context(String store, String evidence, String artifact, String state) {
    return new JSObject().put(KEY, store).put("store_evidence", evidence)
        .put("artifact_channel", artifact).put("acquisition_state", state);
  }

  @SuppressWarnings("deprecation")
  private static JSObject determine(Context context, String artifact, String remembered, boolean savedGame) {
    PackageManager packages = context.getPackageManager();
    String app = context.getPackageName();
    try {
      PackageInfo info = packages.getPackageInfo(app, 0);
      if (info.firstInstallTime <= 0 || info.lastUpdateTime < info.firstInstallTime)
        return context(UNKNOWN, "unavailable", UNKNOWN, "undetermined");
      if (info.firstInstallTime != info.lastUpdateTime) {
        boolean known = "rustore".equals(remembered) || "nashstore".equals(remembered);
        return context(known ? remembered : UNKNOWN, known ? "legacy_record" : "unavailable", UNKNOWN, "legacy");
      }
      if (savedGame || !UNKNOWN.equals(remembered))
        return context(UNKNOWN, "unavailable", UNKNOWN, "undetermined");

      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
        InstallSourceInfo source = packages.getInstallSourceInfo(app);
        return classify(source.getInitiatingPackageName(), source.getInstallingPackageName(), artifact);
      }
      return classify(null, packages.getInstallerPackageName(app), artifact);
    } catch (PackageManager.NameNotFoundException | SecurityException ignored) {
      return context(UNKNOWN, "unavailable", UNKNOWN, "undetermined");
    }
  }

  static JSObject classify(String initiating, String installing, String artifact) {
    String first = store(initiating), second = store(installing);
    if (!UNKNOWN.equals(first) && !UNKNOWN.equals(second) && !first.equals(second))
      return context(UNKNOWN, "conflict", artifact, "fresh");
    String winner = UNKNOWN.equals(first) ? second : first;
    return context(winner, UNKNOWN.equals(winner) ? "unavailable" :
        UNKNOWN.equals(first) ? "installer_package" : "initiating_package", artifact, "fresh");
  }

  private static String store(String installer) {
    if ("ru.vk.store".equals(installer)) return "rustore";
    if ("com.nashstore".equals(installer)) return "nashstore";
    return UNKNOWN;
  }
}
