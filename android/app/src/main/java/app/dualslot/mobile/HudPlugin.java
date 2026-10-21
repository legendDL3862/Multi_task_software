package app.dualslot.mobile;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONObject;

@CapacitorPlugin(
  name = "Hud",
  permissions = {
    @Permission(strings = { Manifest.permission.POST_NOTIFICATIONS }, alias = "display")
  }
)
public class HudPlugin extends Plugin {
  static HudPlugin instance;
  private static final String CH_DONE = "complete";
  private static final int ID_DONE = 13;

  @Override
  public void load() {
    instance = this;
    try {
      createDoneChannel();
      getContext().stopService(new Intent(getContext(), HudPlaybackService.class));
    } catch (Exception ignored) {}
  }

  void emit(String type) {
    JSObject data = new JSObject();
    data.put("type", type);
    notifyListeners("hud", data, true);
  }

  @PluginMethod
  public void requestPermission(PluginCall call) {
    if (Build.VERSION.SDK_INT < 33 || getPermissionState("display") == PermissionState.GRANTED) {
      JSObject ret = new JSObject();
      ret.put("display", "granted");
      call.resolve(ret);
      return;
    }
    requestPermissionForAlias("display", call, "onDisplayPerm");
  }

  @PermissionCallback
  private void onDisplayPerm(PluginCall call) {
    JSObject ret = new JSObject();
    ret.put("display", getPermissionState("display").toString());
    call.resolve(ret);
  }

  @PluginMethod
  public void snapshot(PluginCall call) {
    JSONObject snap = TimerHudService.snapshot();
    if (snap == null) {
      call.resolve();
      return;
    }
    JSObject ret = new JSObject();
    ret.put("running", snap.optBoolean("running"));
    ret.put("elapsed", snap.optInt("elapsed"));
    ret.put("remaining", snap.optInt("remaining"));
    ret.put("mode", snap.optString("mode"));
    ret.put("title", snap.optString("title"));
    call.resolve(ret);
  }

  @PluginMethod
  public void syncMedia(PluginCall call) {
    try {
      JSONObject data = call.getData();
      boolean active = data.optBoolean("active", false);
      Intent intent = new Intent(getContext(), MusicHudService.class);
      if (!active) {
        getContext().stopService(intent);
      } else {
        intent.setAction(MusicHudService.ACTION_SYNC);
        intent.putExtra("payload", data.toString());
        if (MusicHudService.runningService) getContext().startService(intent);
        else ContextCompat.startForegroundService(getContext(), intent);
      }
    } catch (Exception ignored) {}
    call.resolve();
  }

  @PluginMethod
  public void sync(PluginCall call) {
    try {
      JSONObject data = call.getData();
      JSONObject timer = data.isNull("timer") ? null : data.optJSONObject("timer");
      JSONObject complete = data.isNull("complete") ? null : data.optJSONObject("complete");
      NotificationManagerCompat nm = NotificationManagerCompat.from(getContext());
      if (complete != null) nm.notify(ID_DONE, doneNotification(complete));
      else nm.cancel(ID_DONE);
      if (timer == null) {
        getContext().stopService(new Intent(getContext(), TimerHudService.class));
      } else {
        Intent intent = new Intent(getContext(), TimerHudService.class);
        intent.setAction(TimerHudService.ACTION_SYNC);
        intent.putExtra("payload", data.toString());
        if (TimerHudService.runningService) getContext().startService(intent);
        else ContextCompat.startForegroundService(getContext(), intent);
      }
    } catch (Exception ignored) {}
    call.resolve();
  }

  @PluginMethod
  public void clear(PluginCall call) {
    try {
      getContext().stopService(new Intent(getContext(), TimerHudService.class));
      NotificationManagerCompat.from(getContext()).cancel(ID_DONE);
    } catch (Exception ignored) {}
    call.resolve();
  }

  private Notification doneNotification(JSONObject complete) {
    return new NotificationCompat.Builder(getContext(), CH_DONE)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle(complete.optString("title", "Dual Slot"))
      .setContentText(complete.optString("body", "Done"))
      .setContentIntent(launch())
      .setAutoCancel(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .build();
  }

  private android.app.PendingIntent launch() {
    Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
    if (intent == null) intent = new Intent(getContext(), MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return android.app.PendingIntent.getActivity(
      getContext(),
      1,
      intent,
      android.app.PendingIntent.FLAG_IMMUTABLE | android.app.PendingIntent.FLAG_UPDATE_CURRENT
    );
  }

  private void createDoneChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = getContext().getSystemService(NotificationManager.class);
    if (nm == null) return;
    NotificationChannel done = new NotificationChannel(CH_DONE, "Complete", NotificationManager.IMPORTANCE_HIGH);
    done.enableVibration(true);
    done.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    nm.createNotificationChannel(done);
  }
}
