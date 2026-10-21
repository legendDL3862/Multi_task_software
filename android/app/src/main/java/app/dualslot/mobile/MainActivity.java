package app.dualslot.mobile;

import android.app.NotificationManager;
import android.content.Intent;
import android.media.AudioManager;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  @Override
  public void onCreate(Bundle savedInstanceState) {
    registerPlugin(MusicFolderPlugin.class);
    registerPlugin(HudPlugin.class);
    super.onCreate(savedInstanceState);
    try {
      stopService(new Intent(this, HudPlaybackService.class));
      AudioManager am = (AudioManager) getSystemService(AUDIO_SERVICE);
      if (am != null) am.abandonAudioFocus(null);
      NotificationManager nm = getSystemService(NotificationManager.class);
      if (nm != null) nm.cancel(12);
    } catch (Exception ignored) {}
  }
}
