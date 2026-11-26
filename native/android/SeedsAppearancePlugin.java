package com.seedsbits.game.preview;
import com.getcapacitor.Plugin;
import com.getcapacitor.JSObject;
import androidx.core.view.WindowCompat;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name="SeedsAppearance")
public class SeedsAppearancePlugin extends Plugin {
  @PluginMethod public void setTheme(PluginCall call) {
    boolean dark = call.getBoolean("dark", false);
    getActivity().runOnUiThread(() -> {
      ((MainActivity)getActivity()).setGameAppearance(dark);
      call.resolve();
    });
  }
  @PluginMethod public void diagnostics(PluginCall call) {
    getActivity().runOnUiThread(() -> {
      var activity=(MainActivity)getActivity();
      var controller=WindowCompat.getInsetsController(activity.getWindow(), activity.getWindow().getDecorView());
      call.resolve(new JSObject().put("dark",activity.isGameDark())
        .put("gameBackgroundApplied",activity.isGameBackgroundApplied())
        .put("darkStatusIcons",controller.isAppearanceLightStatusBars())
        .put("darkNavigationIcons",controller.isAppearanceLightNavigationBars()));
    });
  }
}
