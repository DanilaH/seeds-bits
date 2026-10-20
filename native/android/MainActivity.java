package com.seedsbits.game.preview;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;
public class MainActivity extends BridgeActivity {
  @Override public void onCreate(Bundle savedInstanceState) {
    registerPlugin(SeedsMonetizationPlugin.class);
    super.onCreate(savedInstanceState);
  }
}
