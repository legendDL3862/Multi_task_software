package app.dualslot.mobile;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.SystemClock;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import org.json.JSONObject;

public class TimerHudService extends Service {
  static final String ACTION_SYNC = "app.dualslot.mobile.TIMER_SYNC";
  static final String ACTION_PAUSE = "app.dualslot.mobile.pauseTimer";
  static final String ACTION_RESUME = "app.dualslot.mobile.resumeTimer";
  static final String ACTION_STOP = "app.dualslot.mobile.stopTimer";
  static final String ACTION_EXPIRE = "app.dualslot.mobile.timerDone";
  static volatile boolean runningService = false;

  private static final String CH = "timer_live";
  private static final int ID = 11;
  private static JSONObject timer = new JSONObject();
  private static long baseRealtime;
  private static int baseElapsed;
  private static int baseRemaining;
  private static boolean clockRunning;

  private final Handler handler = new Handler(Looper.getMainLooper());
  private final Runnable expireRun = this::expireNow;
  private final Runnable tickRun = this::tickClock;
  private MediaSessionCompat mediaSession;

  static JSONObject snapshot() {
    if (!runningService) return null;
    JSONObject out = new JSONObject();
    try {
      out.put("running", clockRunning);
      out.put("elapsed", liveElapsed());
      out.put("remaining", liveRemaining());
      out.put("mode", timer.optString("mode", "countup"));
      out.put("title", timer.optString("title", ""));
      return out;
    } catch (Exception ignored) {
      return null;
    }
  }

  private static int liveElapsed() {
    if (!clockRunning) return baseElapsed;
    int dt = (int) Math.max(0, (SystemClock.elapsedRealtime() - baseRealtime) / 1000);
    return baseElapsed + dt;
  }

  private static int liveRemaining() {
    if (!"countdown".equals(timer.optString("mode"))) return baseRemaining;
    if (!clockRunning) return baseRemaining;
    int dt = (int) Math.max(0, (SystemClock.elapsedRealtime() - baseRealtime) / 1000);
    return Math.max(0, baseRemaining - dt);
  }

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
    mediaSession = new MediaSessionCompat(this, "dual-slot-timer");
    mediaSession.setActive(true);
    runningService = true;
    startAsForeground(placeholder());
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent == null) return START_STICKY;
    String action = intent.getAction();
    if (ACTION_PAUSE.equals(action)) {
      pauseClock();
      emit("pauseTimer");
      return START_STICKY;
    }
    if (ACTION_RESUME.equals(action)) {
      resumeClock();
      emit("resumeTimer");
      return START_STICKY;
    }
    if (ACTION_STOP.equals(action)) {
      emit("stopTimer");
      shutdown();
      return START_NOT_STICKY;
    }
    if (ACTION_EXPIRE.equals(action)) {
      expireNow();
      return START_NOT_STICKY;
    }
    String raw = intent.getStringExtra("payload");
    if (raw == null || raw.isEmpty()) {
      shutdown();
      return START_NOT_STICKY;
    }
    try {
      JSONObject data = new JSONObject(raw);
      JSONObject next = data.optJSONObject("timer");
      if (next == null) {
        shutdown();
        return START_NOT_STICKY;
      }
      apply(next);
      startAsForeground(buildNotification());
      scheduleExpire();
      startTicker();
    } catch (Exception ignored) {}
    return START_STICKY;
  }

  private void apply(JSONObject next) {
    timer = next;
    clockRunning = next.optBoolean("running", true);
    baseElapsed = Math.max(0, next.optInt("elapsed", 0));
    baseRemaining = Math.max(0, next.optInt("remaining", 0));
    baseRealtime = SystemClock.elapsedRealtime();
  }

  private void pauseClock() {
    if (!clockRunning) {
      postNotification(buildNotification());
      return;
    }
    baseElapsed = liveElapsed();
    baseRemaining = liveRemaining();
    clockRunning = false;
    try {
      timer.put("running", false);
      timer.put("elapsed", baseElapsed);
      timer.put("remaining", baseRemaining);
    } catch (Exception ignored) {}
    handler.removeCallbacks(expireRun);
    handler.removeCallbacks(tickRun);
    postNotification(buildNotification());
  }

  private void resumeClock() {
    if (clockRunning) {
      postNotification(buildNotification());
      startTicker();
      return;
    }
    clockRunning = true;
    baseRealtime = SystemClock.elapsedRealtime();
    try {
      timer.put("running", true);
    } catch (Exception ignored) {}
    postNotification(buildNotification());
    scheduleExpire();
    startTicker();
  }

  private void expireNow() {
    handler.removeCallbacks(expireRun);
    handler.removeCallbacks(tickRun);
    baseElapsed = liveElapsed();
    baseRemaining = 0;
    clockRunning = false;
    emit("timerDone");
    shutdown();
  }

  private void startTicker() {
    handler.removeCallbacks(tickRun);
    handler.post(tickRun);
  }

  private void tickClock() {
    if (!runningService) return;
    postNotification(buildNotification());
    if (!clockRunning) return;
    if ("countdown".equals(timer.optString("mode")) && liveRemaining() <= 0) {
      expireNow();
      return;
    }
    handler.postDelayed(tickRun, 1000);
  }

  private void postNotification(Notification notification) {
    try {
      NotificationManagerCompat.from(this).notify(ID, notification);
    } catch (Exception ignored) {}
  }

  private void scheduleExpire() {
    handler.removeCallbacks(expireRun);
    if (!clockRunning || !"countdown".equals(timer.optString("mode"))) return;
    long delay = Math.max(0, liveRemaining()) * 1000L;
    handler.postDelayed(expireRun, delay);
    try {
      AlarmManager am = getSystemService(AlarmManager.class);
      if (am == null) return;
      Intent intent = new Intent(this, TimerHudService.class).setAction(ACTION_EXPIRE);
      PendingIntent pi = PendingIntent.getService(
        this,
        7,
        intent,
        PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
      );
      if (Build.VERSION.SDK_INT >= 31 && !am.canScheduleExactAlarms()) {
        am.setAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + delay, pi);
      } else {
        am.setExactAndAllowWhileIdle(AlarmManager.ELAPSED_REALTIME_WAKEUP, SystemClock.elapsedRealtime() + delay, pi);
      }
    } catch (Exception ignored) {}
  }

  private void startAsForeground(Notification notification) {
    try {
      if (Build.VERSION.SDK_INT >= 34) {
        startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
      } else if (Build.VERSION.SDK_INT >= 29) {
        startForeground(ID, notification, 0);
      } else {
        startForeground(ID, notification);
      }
      runningService = true;
    } catch (Exception ignored) {
      shutdown();
    }
  }

  private Notification placeholder() {
    return new NotificationCompat.Builder(this, CH)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle("Dual Slot")
      .setOngoing(true)
      .setSilent(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .build();
  }

  private Notification buildNotification() {
    boolean countdown = "countdown".equals(timer.optString("mode"));
    String title = timer.optString("title", "Dual Slot");
    int elapsed = liveElapsed();
    int remaining = liveRemaining();
    String clock = format(countdown ? remaining : elapsed);
    long base = countdown
      ? SystemClock.elapsedRealtime() + remaining * 1000L
      : SystemClock.elapsedRealtime() - elapsed * 1000L;
    RemoteViews views = new RemoteViews(getPackageName(), R.layout.notify_timer);
    String pauseLabel = timer.optString(clockRunning ? "pauseLabel" : "resumeLabel", clockRunning ? "Pause" : "Resume");
    String stopLabel = timer.optString("stopLabel", "Stop");
    views.setTextViewText(R.id.notify_title, title);
    views.setChronometer(R.id.notify_clock, base, "%s", clockRunning);
    if (Build.VERSION.SDK_INT >= 24) views.setChronometerCountDown(R.id.notify_clock, countdown);
    views.setTextViewText(R.id.notify_pause, pauseLabel);
    views.setTextViewText(R.id.notify_stop, stopLabel);
    views.setOnClickPendingIntent(R.id.notify_pause, button(clockRunning ? ACTION_PAUSE : ACTION_RESUME));
    views.setOnClickPendingIntent(R.id.notify_stop, button(ACTION_STOP));
    if (mediaSession != null) {
      mediaSession.setPlaybackState(
        new PlaybackStateCompat.Builder()
          .setActions(PlaybackStateCompat.ACTION_PLAY | PlaybackStateCompat.ACTION_PAUSE | PlaybackStateCompat.ACTION_STOP)
          .setState(
            clockRunning ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
            elapsed * 1000L,
            1f
          )
          .build()
      );
    }
    NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle(title)
      .setContentText(clock)
      .setContentIntent(launch())
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(false)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .setCustomContentView(views)
      .setCustomBigContentView(views)
      .setStyle(mediaStyle());
    addActions(b);
    NotificationCompat.Builder lock = new NotificationCompat.Builder(this, CH)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle(title)
      .setContentText(clock)
      .setOngoing(true)
      .setSilent(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCustomContentView(views)
      .setCustomBigContentView(views)
      .setStyle(mediaStyle());
    addActions(lock);
    b.setPublicVersion(lock.build());
    return b.build();
  }

  private MediaStyle mediaStyle() {
    MediaStyle style = new MediaStyle().setShowActionsInCompactView(0, 1);
    if (mediaSession != null) style.setMediaSession(mediaSession.getSessionToken());
    return style;
  }

  private void addActions(NotificationCompat.Builder b) {
    if (clockRunning) {
      b.addAction(R.drawable.ic_notify_pause, timer.optString("pauseLabel", "Pause"), button(ACTION_PAUSE));
    } else {
      b.addAction(R.drawable.ic_notify_play, timer.optString("resumeLabel", "Resume"), button(ACTION_RESUME));
    }
    b.addAction(R.drawable.ic_notify_stop, timer.optString("stopLabel", "Stop"), button(ACTION_STOP));
  }

  private PendingIntent launch() {
    Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (intent == null) intent = new Intent(this, MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return PendingIntent.getActivity(this, 1, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
  }

  private PendingIntent button(String action) {
    Intent intent = new Intent(this, HudReceiver.class).setAction(action);
    return PendingIntent.getBroadcast(
      this,
      action.hashCode(),
      intent,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );
  }

  private void emit(String type) {
    if (HudPlugin.instance != null) HudPlugin.instance.emit(type);
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null) return;
    NotificationChannel channel = new NotificationChannel(CH, "Timer", NotificationManager.IMPORTANCE_HIGH);
    channel.setSound(null, null);
    channel.enableVibration(false);
    channel.setShowBadge(false);
    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    nm.createNotificationChannel(channel);
  }

  private String format(int seconds) {
    int s = Math.max(0, seconds);
    return (s / 60) + ":" + String.format("%02d", s % 60);
  }

  private void shutdown() {
    handler.removeCallbacks(expireRun);
    handler.removeCallbacks(tickRun);
    runningService = false;
    timer = new JSONObject();
    clockRunning = false;
    baseElapsed = 0;
    baseRemaining = 0;
    try {
      AlarmManager am = getSystemService(AlarmManager.class);
      if (am != null) {
        PendingIntent pi = PendingIntent.getService(
          this,
          7,
          new Intent(this, TimerHudService.class).setAction(ACTION_EXPIRE),
          PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
        );
        am.cancel(pi);
      }
    } catch (Exception ignored) {}
    try {
      if (mediaSession != null) {
        mediaSession.setActive(false);
        mediaSession.release();
        mediaSession = null;
      }
    } catch (Exception ignored) {}
    try {
      stopForeground(true);
    } catch (Exception ignored) {}
    NotificationManagerCompat.from(this).cancel(ID);
    stopSelf();
  }

  @Override
  public void onDestroy() {
    runningService = false;
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
