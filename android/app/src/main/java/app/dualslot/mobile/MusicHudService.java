package app.dualslot.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import android.view.View;
import android.widget.RemoteViews;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import org.json.JSONObject;

public class MusicHudService extends Service {
  static final String ACTION_SYNC = "app.dualslot.mobile.MUSIC_SYNC";
  static final String ACTION_PLAY = "app.dualslot.mobile.musicPlay";
  static final String ACTION_PAUSE = "app.dualslot.mobile.musicPause";
  static final String ACTION_PREV = "app.dualslot.mobile.musicPrev";
  static final String ACTION_NEXT = "app.dualslot.mobile.musicNext";
  static final String ACTION_BACK = "app.dualslot.mobile.musicBack";
  static final String ACTION_FWD = "app.dualslot.mobile.musicFwd";
  static final String ACTION_MODE = "app.dualslot.mobile.musicMode";
  static volatile boolean runningService = false;

  private static final String CH = "music_live";
  private static final int ID = 14;
  private JSONObject media = new JSONObject();
  private MediaSessionCompat mediaSession;

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
    mediaSession = new MediaSessionCompat(this, "dual-slot-music");
    mediaSession.setCallback(new MediaSessionCompat.Callback() {
      @Override
      public void onPlay() {
        emit(ACTION_PLAY);
      }

      @Override
      public void onPause() {
        emit(ACTION_PAUSE);
      }

      @Override
      public void onSkipToNext() {
        emit(ACTION_NEXT);
      }

      @Override
      public void onSkipToPrevious() {
        emit(ACTION_PREV);
      }
    });
    mediaSession.setActive(true);
    runningService = true;
    startAsForeground(placeholder());
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent == null) return START_STICKY;
    String action = intent.getAction();
    if (ACTION_PLAY.equals(action) || ACTION_PAUSE.equals(action) || ACTION_PREV.equals(action)
      || ACTION_NEXT.equals(action) || ACTION_BACK.equals(action) || ACTION_FWD.equals(action)
      || ACTION_MODE.equals(action)) {
      emit(action);
      return START_STICKY;
    }
    String raw = intent.getStringExtra("payload");
    if (raw == null || raw.isEmpty()) {
      shutdown();
      return START_NOT_STICKY;
    }
    try {
      media = new JSONObject(raw);
      if (!media.optBoolean("active", true)) {
        shutdown();
        return START_NOT_STICKY;
      }
      startAsForeground(buildNotification());
    } catch (Exception ignored) {}
    return START_STICKY;
  }

  private void startAsForeground(Notification notification) {
    try {
      if (Build.VERSION.SDK_INT >= 29) {
        startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
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
    boolean playing = media.optBoolean("playing");
    boolean folder = media.optBoolean("folder");
    String title = media.optString("title", "Dual Slot");
    String meta = media.optString("artist", "");
    RemoteViews views = new RemoteViews(getPackageName(), R.layout.notify_music);
    views.setTextViewText(R.id.music_title, title);
    views.setTextViewText(R.id.music_meta, meta);
    views.setTextViewText(R.id.music_toggle, media.optString(playing ? "pauseLabel" : "playLabel", playing ? "Pause" : "Play"));
    views.setOnClickPendingIntent(R.id.music_toggle, button(playing ? ACTION_PAUSE : ACTION_PLAY));
    views.setViewVisibility(R.id.music_skip_row, folder ? View.VISIBLE : View.GONE);
    views.setViewVisibility(R.id.music_mode, folder ? View.VISIBLE : View.GONE);
    if (folder) {
      views.setTextViewText(R.id.music_prev, media.optString("prevLabel", "Prev"));
      views.setTextViewText(R.id.music_back, media.optString("backLabel", "-10s"));
      views.setTextViewText(R.id.music_fwd, media.optString("fwdLabel", "+10s"));
      views.setTextViewText(R.id.music_next, media.optString("nextLabel", "Next"));
      views.setTextViewText(R.id.music_mode, media.optString("modeLabel", ""));
      views.setOnClickPendingIntent(R.id.music_prev, button(ACTION_PREV));
      views.setOnClickPendingIntent(R.id.music_back, button(ACTION_BACK));
      views.setOnClickPendingIntent(R.id.music_fwd, button(ACTION_FWD));
      views.setOnClickPendingIntent(R.id.music_next, button(ACTION_NEXT));
      views.setOnClickPendingIntent(R.id.music_mode, button(ACTION_MODE));
    }
    long duration = Math.max(0, (long) (media.optDouble("duration", 0) * 1000));
    long position = Math.max(0, (long) (media.optDouble("current", 0) * 1000));
    if (mediaSession != null) {
      mediaSession.setMetadata(
        new MediaMetadataCompat.Builder()
          .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
          .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, meta)
          .putLong(MediaMetadataCompat.METADATA_KEY_DURATION, duration)
          .build()
      );
      mediaSession.setPlaybackState(
        new PlaybackStateCompat.Builder()
          .setActions(
            PlaybackStateCompat.ACTION_PLAY
              | PlaybackStateCompat.ACTION_PAUSE
              | PlaybackStateCompat.ACTION_SKIP_TO_NEXT
              | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS
          )
          .setState(playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED, position, 1f)
          .build()
      );
    }
    NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle(title)
      .setContentText(meta)
      .setContentIntent(launch())
      .setOngoing(true)
      .setOnlyAlertOnce(true)
      .setSilent(true)
      .setShowWhen(false)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT)
      .setPriority(NotificationCompat.PRIORITY_DEFAULT)
      .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
      .setCustomContentView(views)
      .setCustomBigContentView(views)
      .setStyle(new MediaStyle().setShowActionsInCompactView(0, 1, 2).setMediaSession(mediaSession.getSessionToken()));
    if (folder) {
      b.addAction(R.drawable.ic_notify_prev, media.optString("prevLabel", "Prev"), button(ACTION_PREV));
      b.addAction(
        playing ? R.drawable.ic_notify_pause : R.drawable.ic_notify_play,
        media.optString(playing ? "pauseLabel" : "playLabel", playing ? "Pause" : "Play"),
        button(playing ? ACTION_PAUSE : ACTION_PLAY)
      );
      b.addAction(R.drawable.ic_notify_next, media.optString("nextLabel", "Next"), button(ACTION_NEXT));
      b.addAction(R.drawable.ic_notify_back, media.optString("backLabel", "-10s"), button(ACTION_BACK));
      b.addAction(R.drawable.ic_notify_fwd, media.optString("fwdLabel", "+10s"), button(ACTION_FWD));
    } else {
      b.addAction(
        playing ? R.drawable.ic_notify_pause : R.drawable.ic_notify_play,
        media.optString(playing ? "pauseLabel" : "playLabel", playing ? "Pause" : "Play"),
        button(playing ? ACTION_PAUSE : ACTION_PLAY)
      );
    }
    return b.build();
  }

  private PendingIntent launch() {
    Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (intent == null) intent = new Intent(this, MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return PendingIntent.getActivity(this, 2, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
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

  private void emit(String action) {
    if (HudPlugin.instance != null) {
      HudPlugin.instance.emit(action.replace("app.dualslot.mobile.", ""));
    }
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null) return;
    NotificationChannel channel = new NotificationChannel(CH, "Music", NotificationManager.IMPORTANCE_DEFAULT);
    channel.setSound(null, null);
    channel.enableVibration(false);
    channel.setShowBadge(false);
    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    nm.createNotificationChannel(channel);
  }

  private void shutdown() {
    runningService = false;
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
