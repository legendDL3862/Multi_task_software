package app.dualslot.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class HudReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    String action = intent.getAction();
    if (action == null) return;
    Class<?> service = null;
    if (
      TimerHudService.ACTION_PAUSE.equals(action) ||
      TimerHudService.ACTION_RESUME.equals(action) ||
      TimerHudService.ACTION_STOP.equals(action)
    ) {
      service = TimerHudService.class;
    } else if (
      MusicHudService.ACTION_PLAY.equals(action) ||
      MusicHudService.ACTION_PAUSE.equals(action) ||
      MusicHudService.ACTION_PREV.equals(action) ||
      MusicHudService.ACTION_NEXT.equals(action) ||
      MusicHudService.ACTION_BACK.equals(action) ||
      MusicHudService.ACTION_FWD.equals(action) ||
      MusicHudService.ACTION_MODE.equals(action)
    ) {
      service = MusicHudService.class;
    }
    if (service != null) {
      try {
        context.startService(new Intent(context, service).setAction(action));
      } catch (Exception ignored) {}
      if (service == MusicHudService.class) return;
    }
    if (HudPlugin.instance != null) {
      HudPlugin.instance.emit(action.replace("app.dualslot.mobile.", ""));
    }
  }
}
