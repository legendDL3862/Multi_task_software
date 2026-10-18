package app.dualslot.mobile;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
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
  private static final String CH_TIMER = "timer";
  private static final String CH_DONE = "complete";
  private static final int ID_TIMER = 11;
  private static final int ID_DONE = 13;

  @Override
  public void load() {
    instance = this;
    try {
      NotificationManagerCompat.from(getContext()).cancelAll();
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
  public void sync(PluginCall call) {
    clear(call);
  }

  @PluginMethod
  public void clear(PluginCall call) {
    try {
      NotificationManagerCompat.from(getContext()).cancelAll();
      stopPlayback();
    } catch (Exception ignored) {}
    call.resolve();
  }

  private void startPlayback(String payload) {
    Intent intent = new Intent(getContext(), HudPlaybackService.class);
    intent.setAction(HudPlaybackService.ACTION_SYNC);
    intent.putExtra("payload", payload);
    if (HudPlaybackService.running) getContext().startService(intent);
    else ContextCompat.startForegroundService(getContext(), intent);
  }

  private void stopPlayback() {
    try {
      getContext().stopService(new Intent(getContext(), HudPlaybackService.class));
    } catch (Exception ignored) {}
  }

  private Notification timerNotification(JSONObject timer) {
    boolean running = timer.optBoolean("running");
    boolean countdown = "countdown".equals(timer.optString("mode"));
    NotificationCompat.Builder b = new NotificationCompat.Builder(getContext(), CH_TIMER)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle(timer.optString("title", "Dual Slot"))
      .setContentIntent(launch())
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT);
    if (countdown) {
      b.setContentText(format(timer.optInt("remaining")))
        .setUsesChronometer(running)
        .setChronometerCountDown(true)
        .setWhen(System.currentTimeMillis() + timer.optInt("remaining") * 1000L);
    } else {
      b.setContentText(format(timer.optInt("elapsed")))
        .setUsesChronometer(running)
        .setWhen(System.currentTimeMillis() - timer.optInt("elapsed") * 1000L);
    }
    if (running) b.addAction(0, timer.optString("pauseLabel", "Pause"), button("pauseTimer"));
    else b.addAction(0, timer.optString("resumeLabel", "Resume"), button("resumeTimer"));
    b.addAction(0, timer.optString("stopLabel", "Stop"), button("stopTimer"));
    return b.build();
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
      .addAction(0, complete.optString("confirmLabel", "OK"), button("ack"))
      .build();
  }

  private PendingIntent launch() {
    Intent intent = getContext().getPackageManager().getLaunchIntentForPackage(getContext().getPackageName());
    if (intent == null) intent = new Intent(getContext(), MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return PendingIntent.getActivity(
      getContext(),
      1,
      intent,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );
  }

  private PendingIntent button(String type) {
    Intent intent = new Intent(getContext(), HudReceiver.class);
    intent.setAction("app.dualslot.mobile." + type);
    return PendingIntent.getBroadcast(
      getContext(),
      type.hashCode(),
      intent,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );
  }

  private void createChannels() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = getContext().getSystemService(NotificationManager.class);
    if (nm == null) return;
    NotificationChannel timer = new NotificationChannel(CH_TIMER, "Timer", NotificationManager.IMPORTANCE_DEFAULT);
    timer.setSound(null, null);
    timer.enableVibration(false);
    timer.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    nm.createNotificationChannel(timer);
    NotificationChannel done = new NotificationChannel(CH_DONE, "Complete", NotificationManager.IMPORTANCE_HIGH);
    done.enableVibration(true);
    done.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    nm.createNotificationChannel(done);
  }

  private String format(int seconds) {
    int s = Math.max(0, seconds);
    return (s / 60) + ":" + String.format("%02d", s % 60);
  }
}
