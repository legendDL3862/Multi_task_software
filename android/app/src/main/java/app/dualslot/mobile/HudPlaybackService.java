package app.dualslot.mobile;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.media.AudioAttributes;
import android.media.AudioFocusRequest;
import android.media.AudioManager;
import android.os.Build;
import android.os.IBinder;
import android.support.v4.media.MediaMetadataCompat;
import android.support.v4.media.session.MediaSessionCompat;
import android.support.v4.media.session.PlaybackStateCompat;
import androidx.core.app.NotificationCompat;
import androidx.media.app.NotificationCompat.MediaStyle;
import androidx.media.session.MediaButtonReceiver;
import org.json.JSONObject;

public class HudPlaybackService extends Service {
  static final String ACTION_SYNC = "app.dualslot.mobile.MEDIA_SYNC";
  static final String ACTION_STOP = "app.dualslot.mobile.MEDIA_STOP";
  static volatile boolean running = false;
  private boolean stopped;
  private static final String CH_MEDIA = "media";
  private static final int ID = 12;

  private MediaSessionCompat mediaSession;
  private AudioManager audioManager;
  private AudioFocusRequest focusRequest;
  private JSONObject media;
  private JSONObject timer;

  @Override
  public void onCreate() {
    super.onCreate();
    createChannel();
    audioManager = (AudioManager) getSystemService(AUDIO_SERVICE);
    mediaSession = new MediaSessionCompat(this, "dual-slot");
    mediaSession.setFlags(
      MediaSessionCompat.FLAG_HANDLES_MEDIA_BUTTONS | MediaSessionCompat.FLAG_HANDLES_TRANSPORT_CONTROLS
    );
    mediaSession.setCallback(new MediaSessionCompat.Callback() {
      @Override
      public void onPlay() {
        emit("play");
      }

      @Override
      public void onPause() {
        emit("pause");
      }

      @Override
      public void onSkipToNext() {
        emit("next");
      }

      @Override
      public void onSkipToPrevious() {
        emit("prev");
      }

      @Override
      public void onStop() {
        emit("pause");
      }
    });
    mediaSession.setActive(true);
    try {
      Notification placeholder = new NotificationCompat.Builder(this, CH_MEDIA)
        .setSmallIcon(R.drawable.ic_stat_notify)
        .setContentTitle("Dual Slot")
        .setOngoing(true)
        .setSilent(true)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .build();
      if (Build.VERSION.SDK_INT >= 29) {
        startForeground(ID, placeholder, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
      } else {
        startForeground(ID, placeholder);
      }
      running = true;
    } catch (Exception ignored) {
      running = false;
      stopSelf();
    }
  }

  @Override
  public int onStartCommand(Intent intent, int flags, int startId) {
    if (intent == null) return START_STICKY;
    if (Intent.ACTION_MEDIA_BUTTON.equals(intent.getAction()) && mediaSession != null) {
      MediaButtonReceiver.handleIntent(mediaSession, intent);
      return START_STICKY;
    }
    if (ACTION_STOP.equals(intent.getAction())) {
      shutdown();
      return START_NOT_STICKY;
    }
    parse(intent.getStringExtra("payload"));
    if (media == null) {
      shutdown();
      return START_NOT_STICKY;
    }
    try {
      updateSession();
      Notification notification = mediaNotification();
      if (Build.VERSION.SDK_INT >= 29) {
        startForeground(ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK);
      } else {
        startForeground(ID, notification);
      }
    } catch (Exception ignored) {}
    return START_STICKY;
  }

  private void parse(String raw) {
    media = null;
    timer = null;
    if (raw == null) return;
    try {
      JSONObject data = new JSONObject(raw);
      if (!data.isNull("media")) media = data.optJSONObject("media");
      if (!data.isNull("timer")) timer = data.optJSONObject("timer");
    } catch (Exception ignored) {}
  }

  private void updateSession() {
    boolean playing = media.optBoolean("playing");
    String title = media.optString("title", "Dual Slot");
    mediaSession.setMetadata(
      new MediaMetadataCompat.Builder()
        .putString(MediaMetadataCompat.METADATA_KEY_TITLE, title)
        .putString(MediaMetadataCompat.METADATA_KEY_ARTIST, subtitle())
        .putString(MediaMetadataCompat.METADATA_KEY_ALBUM, "Dual Slot")
        .build()
    );
    long actions =
      PlaybackStateCompat.ACTION_PLAY
        | PlaybackStateCompat.ACTION_PAUSE
        | PlaybackStateCompat.ACTION_PLAY_PAUSE
        | PlaybackStateCompat.ACTION_STOP;
    if (media.optBoolean("canSkip", true)) {
      actions |= PlaybackStateCompat.ACTION_SKIP_TO_NEXT | PlaybackStateCompat.ACTION_SKIP_TO_PREVIOUS;
    }
    mediaSession.setPlaybackState(
      new PlaybackStateCompat.Builder()
        .setActions(actions)
        .setState(
          playing ? PlaybackStateCompat.STATE_PLAYING : PlaybackStateCompat.STATE_PAUSED,
          PlaybackStateCompat.PLAYBACK_POSITION_UNKNOWN,
          1f
        )
        .build()
    );
    mediaSession.setActive(true);
    if (playing) requestFocus();
    else abandonFocus();
  }

  private Notification mediaNotification() {
    boolean playing = media.optBoolean("playing");
    boolean canSkip = media.optBoolean("canSkip", true);
    NotificationCompat.Builder b = new NotificationCompat.Builder(this, CH_MEDIA)
      .setSmallIcon(R.drawable.ic_stat_notify)
      .setContentTitle(media.optString("title", "Dual Slot"))
      .setContentText(subtitle())
      .setContentIntent(launch())
      .setOngoing(true)
      .setSilent(true)
      .setOnlyAlertOnce(true)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setCategory(NotificationCompat.CATEGORY_TRANSPORT);
    if (canSkip) b.addAction(0, "Prev", button("prev"));
    b.addAction(0, playing ? "Pause" : "Play", button(playing ? "pause" : "play"));
    if (canSkip) b.addAction(0, "Next", button("next"));
    if (timer != null) {
      if (timer.optBoolean("running")) b.addAction(0, timer.optString("pauseLabel", "Pause"), button("pauseTimer"));
      else b.addAction(0, timer.optString("resumeLabel", "Resume"), button("resumeTimer"));
    }
    MediaStyle style = new MediaStyle().setMediaSession(mediaSession.getSessionToken());
    if (canSkip) style.setShowActionsInCompactView(0, 1, 2);
    else style.setShowActionsInCompactView(0);
    b.setStyle(style);
    return b.build();
  }

  private String subtitle() {
    if (timer == null) return media.optString("artist", "Dual Slot");
    String name = timer.optString("title", "");
    boolean countdown = "countdown".equals(timer.optString("mode"));
    String clock = format(countdown ? timer.optInt("remaining") : timer.optInt("elapsed"));
    if (name.isEmpty()) return clock;
    return name + " · " + clock;
  }

  private void requestFocus() {
    if (audioManager == null) return;
    try {
      if (Build.VERSION.SDK_INT >= 26) {
        if (focusRequest == null) {
          focusRequest = new AudioFocusRequest.Builder(AudioManager.AUDIOFOCUS_GAIN)
            .setAudioAttributes(
              new AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_MEDIA)
                .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
                .build()
            )
            .setOnAudioFocusChangeListener(change -> {
              if (change == AudioManager.AUDIOFOCUS_LOSS) emit("pause");
            })
            .build();
        }
        audioManager.requestAudioFocus(focusRequest);
      } else {
        audioManager.requestAudioFocus(
          change -> {
            if (change == AudioManager.AUDIOFOCUS_LOSS) emit("pause");
          },
          AudioManager.STREAM_MUSIC,
          AudioManager.AUDIOFOCUS_GAIN
        );
      }
    } catch (Exception ignored) {}
  }

  private void abandonFocus() {
    if (audioManager == null) return;
    try {
      if (Build.VERSION.SDK_INT >= 26 && focusRequest != null) audioManager.abandonAudioFocusRequest(focusRequest);
      else audioManager.abandonAudioFocus(null);
    } catch (Exception ignored) {}
  }

  private void emit(String type) {
    if (HudPlugin.instance != null) HudPlugin.instance.emit(type);
  }

  private PendingIntent launch() {
    Intent intent = getPackageManager().getLaunchIntentForPackage(getPackageName());
    if (intent == null) intent = new Intent(this, MainActivity.class);
    intent.setFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
    return PendingIntent.getActivity(this, 1, intent, PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT);
  }

  private PendingIntent button(String type) {
    Intent intent = new Intent(this, HudReceiver.class);
    intent.setAction("app.dualslot.mobile." + type);
    return PendingIntent.getBroadcast(
      this,
      type.hashCode(),
      intent,
      PendingIntent.FLAG_IMMUTABLE | PendingIntent.FLAG_UPDATE_CURRENT
    );
  }

  private void createChannel() {
    if (Build.VERSION.SDK_INT < 26) return;
    NotificationManager nm = getSystemService(NotificationManager.class);
    if (nm == null) return;
    NotificationChannel channel = new NotificationChannel(CH_MEDIA, "Playback", NotificationManager.IMPORTANCE_DEFAULT);
    channel.setSound(null, null);
    channel.enableVibration(false);
    channel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
    nm.createNotificationChannel(channel);
  }

  private String format(int seconds) {
    int s = Math.max(0, seconds);
    return (s / 60) + ":" + String.format("%02d", s % 60);
  }

  private void shutdown() {
    if (stopped) return;
    stopped = true;
    abandonFocus();
    try {
      if (mediaSession != null) {
        mediaSession.setActive(false);
        mediaSession.release();
        mediaSession = null;
      }
    } catch (Exception ignored) {}
    running = false;
    try {
      stopForeground(true);
    } catch (Exception ignored) {}
    stopSelf();
  }

  @Override
  public void onDestroy() {
    shutdown();
    super.onDestroy();
  }

  @Override
  public IBinder onBind(Intent intent) {
    return null;
  }
}
