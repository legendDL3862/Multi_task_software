package app.dualslot.mobile;

import android.app.NotificationManager;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MusicFolderPlugin.class);
    registerPlugin(HudPlugin.class);
    super.onCreate(savedInstanceState);
    killHud();
  }

  @Override
  public void onResume() {
    super.onResume();
    try {
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) nm.cancelAll();
    } catch (Exception ignored) {}
  }

  private void killHud() {
    try {
      stopService(new Intent(this, HudPlaybackService.class));
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) {
        nm.cancelAll();
        if (Build.VERSION.SDK_INT >= 26) {
          nm.deleteNotificationChannel("media");
          nm.deleteNotificationChannel("timer");
          nm.deleteNotificationChannel("complete");
        }
      }
      AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
      if (am != null) am.abandonAudioFocus(null);
    } catch (Exception ignored) {}
  }
}
