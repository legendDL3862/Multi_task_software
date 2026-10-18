package app.dualslot.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.support.v4.media.session.MediaSessionCompat;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import org.json.JSONObject;

final class HudNotify {
  static final String CHANNEL = "session";
  static final int ID = 10;

  static void channels(Context context) {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = context.getSystemService(NotificationManager.class);
    if (nm == null) return;
    NotificationChannel channel = new NotificationChannel(CHANNEL, "Session", NotificationManager.IMPORTANCE_LOW);
    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    nm.createNotificationChannel(channel);
  }

  static Notification merged(
    Context context,
    JSONObject timer,
    JSONObject media,
    JSONObject complete,
    MediaSessionCompat session
  ) {
    String title = "Dual Slot";
    String text = "";
    boolean playing = media != null && media.optBoolean("playing");
    boolean canSkip = media != null && media.optBoolean("canSkip");

    if (complete != null) {
      title = complete.optString("title", title);
      text = complete.optString("body", "");
    } else if (media != null) {
      title = media.optString("title", title);
      if (timer != null) text = timerLine(timer);
      else text = media.optString("artist", "");
    } else if (timer != null) {
      title = timer.optString("title", title);
      text = timerLine(timer);
    }

    NotificationCompat.Builder b = new NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle(title)
      .setContentText(text)
      .setContentIntent(launch(context))
      .setOngoing(complete == null)
      .setOnlyAlertOnce(true)
      .setSilent(complete == null)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(complete != null ? NotificationCompat.PRIORITY_HIGH : NotificationCompat.PRIORITY_LOW);

    if (complete == null && timer != null && timer.optBoolean("running")) {
      boolean countdown = "countdown".equals(timer.optString("mode"));
      b.setUsesChronometer(true)
        .setChronometerCountDown(countdown)
        .setWhen(
          countdown
            ? System.currentTimeMillis() + timer.optInt("remaining") * 1000L
            : System.currentTimeMillis() - timer.optInt("elapsed") * 1000L
        );
    }

    if (complete != null) {
      b.addAction(0, complete.optString("confirmLabel", "OK"), button(context, "ack"));
    }
    if (media != null) {
      if (canSkip) b.addAction(0, "Prev", button(context, "prev"));
      b.addAction(0, playing ? "Pause" : "Play", button(context, playing ? "pause" : "play"));
      if (canSkip) b.addAction(0, "Next", button(context, "next"));
      if (session != null) {
        MediaStyle style = new MediaStyle().setMediaSession(session.getSessionToken());
        if (canSkip) style.setShowActionsInCompactView(0, 1, 2);
        else style.setShowActionsInCompactView(0);
        b.setStyle(style);
      }
    } else if (timer != null && complete == null) {
      if (timer.optBoolean("running")) b.addAction(0, timer.optString("pauseLabel", "Pause"), button(context, "pauseTimer"));
      else b.addAction(0, timer.optString("resumeLabel", "Resume"), button(context, "resumeTimer"));
      b.addAction(0, timer.optString("stopLabel", "Stop"), button(context, "stopTimer"));
    }

    return b.build();
  }

  static Notification placeholder(Context context) {
    return new NotificationCompat.Builder(context, CHANNEL)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle("Dual Slot")
      .setContentIntent(launch(context))
      .setOngoing(true)
      .setSilent(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .build();
  }

  private static String timerLine(JSONObject timer) {
    String name = timer.optString("title", "");
    boolean countdown = "countdown".equals(timer.optString("mode"));
    String clock = format(countdown ? timer.optInt("remaining") : timer.optInt("elapsed"));
    return name + " · " + clock;
  }

  private static String format(int seconds) {
    int s = Math.max(0, seconds);
    return (s / 60) + ":" + String.format("%02d", s % 60);
  }

  private static PendingIntent launch(Context context) {
    Intent intent = context.getPackageManager().getLaunchIntentForPackage(context.getPackageName());
    if (intent == null) intent = new Intent(context, MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return PendingIntent.getActivity(context, 1, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
  }

  static PendingIntent mediaButton(Context context) {
    Intent intent = new Intent(Intent.ACTION_MEDIA_BUTTON);
    intent.setClass(context, androidx.media.session.MediaButtonReceiver.class);
    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= 31) flags |= PendingIntent.FLAG_MUTABLE;
    return PendingIntent.getBroadcast(context, 0, intent, flags);
  }

  static PendingIntent button(Context context, String type) {
    Intent intent = new Intent(context, HudReceiver.class);
    intent.setAction("app.dualslot.mobile." + type);
    return PendingIntent.getBroadcast(
      context,
      type.hashCode(),
      intent,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );
  }
}
