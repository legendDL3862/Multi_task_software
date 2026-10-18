package app.dualslot.mobile;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class HudReceiver extends BroadcastReceiver {
  @Override
  public void onReceive(Context context, Intent intent) {
    String action = intent.getAction();
    if (action == null) return;
    if (HudPlugin.instance != null) {
      HudPlugin.instance.emit(action.replace("app.dualslot.mobile.", ""));
    }
  }
}
