package app.dualslot.mobile;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import androidx.activity.result.ActivityResult;
import androidx.documentfile.provider.DocumentFile;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import android.util.Base64;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.util.Arrays;
import java.util.Comparator;
import java.util.Locale;

@CapacitorPlugin(name = "MusicFolder")
public class MusicFolderPlugin extends Plugin {
  private static final String[] AUDIO_EXT = {
    ".mp3", ".wav", ".ogg", ".oga", ".m4a", ".aac", ".flac", ".webm", ".opus"
  };
  private static final int MAX_TRACKS = 300;
  private static final int MAX_DEPTH = 3;

  @PluginMethod
  public void pickFolder(PluginCall call) {
    Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);
    intent.addFlags(
      Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION
    );
    startActivityForResult(call, intent, "onFolderPicked");
  }

  @ActivityCallback
  private void onFolderPicked(PluginCall call, ActivityResult result) {
    if (call == null) return;
    if (result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
      call.reject("cancelled");
      return;
    }
    Uri uri = result.getData().getData();
    if (uri == null) {
      call.reject("cancelled");
      return;
    }
    try {
      getContext()
        .getContentResolver()
        .takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
    } catch (SecurityException ignored) {}
    call.resolve(folderPayload(uri));
  }

  @PluginMethod
  public void listFolder(PluginCall call) {
    String uriString = call.getString("uri");
    if (uriString == null || uriString.isEmpty()) {
      call.reject("missing uri");
      return;
    }
    try {
      call.resolve(folderPayload(Uri.parse(uriString)));
    } catch (Exception e) {
      call.reject(e.getMessage() == null ? "list failed" : e.getMessage());
    }
  }

  @PluginMethod
  public void readFile(PluginCall call) {
    String uriString = call.getString("uri");
    if (uriString == null || uriString.isEmpty()) {
      call.reject("missing uri");
      return;
    }
    try {
      Uri uri = Uri.parse(uriString);
      File dir = new File(getContext().getCacheDir(), "music");
      if (!dir.exists() && !dir.mkdirs()) {
        call.reject("cache failed");
        return;
      }
      String outName = Integer.toHexString(uriString.hashCode()) + extOf(uriString);
      File out = new File(dir, outName);
      if (!out.exists() || out.length() == 0) {
        try (
          InputStream in = getContext().getContentResolver().openInputStream(uri);
          FileOutputStream os = new FileOutputStream(out)
        ) {
          if (in == null) {
            call.reject("unreadable");
            return;
          }
          byte[] buf = new byte[8192];
          int n;
          while ((n = in.read(buf)) > 0) {
            os.write(buf, 0, n);
          }
        }
      }
      JSObject ret = new JSObject();
      ret.put("path", out.getAbsolutePath());
      if (out.length() > 0 && out.length() < 8 * 1024 * 1024) {
        byte[] bytes = new byte[(int) out.length()];
        try (FileInputStream fis = new FileInputStream(out)) {
          int off = 0;
          while (off < bytes.length) {
            int n = fis.read(bytes, off, bytes.length - off);
            if (n < 0) break;
            off += n;
          }
        }
        ret.put("base64", Base64.encodeToString(bytes, Base64.NO_WRAP));
      }
      call.resolve(ret);
    } catch (Exception e) {
      call.reject(e.getMessage() == null ? "read failed" : e.getMessage());
    }
  }

  private JSObject folderPayload(Uri uri) {
    DocumentFile root = DocumentFile.fromTreeUri(getContext(), uri);
    JSArray files = new JSArray();
    if (root != null) {
      collect(root, 0, files);
    }
    JSObject ret = new JSObject();
    ret.put("uri", uri.toString());
    String label = root != null ? root.getName() : null;
    ret.put("label", label == null || label.isEmpty() ? "folder" : label);
    ret.put("files", files);
    return ret;
  }

  private void collect(DocumentFile dir, int depth, JSArray acc) {
    if (depth > MAX_DEPTH || acc.length() >= MAX_TRACKS) return;
    DocumentFile[] children = dir.listFiles();
    Arrays.sort(children, Comparator.comparing(file -> {
      String name = file.getName();
      return name == null ? "" : name.toLowerCase(Locale.ROOT);
    }));
    for (DocumentFile child : children) {
      if (acc.length() >= MAX_TRACKS) break;
      if (child.isDirectory()) {
        collect(child, depth + 1, acc);
      } else if (child.isFile() && isAudio(child)) {
        JSObject row = new JSObject();
        String name = child.getName();
        row.put("name", name == null ? "track" : name);
        row.put("uri", child.getUri().toString());
        acc.put(row);
      }
    }
  }

  private boolean isAudio(DocumentFile file) {
    String name = file.getName();
    if (name != null) {
      String lower = name.toLowerCase(Locale.ROOT);
      for (String ext : AUDIO_EXT) {
        if (lower.endsWith(ext)) return true;
      }
    }
    String mime = file.getType();
    return mime != null && mime.startsWith("audio/");
  }

  private String extOf(String uriString) {
    String lower = uriString.toLowerCase(Locale.ROOT);
    for (String ext : AUDIO_EXT) {
      if (lower.contains(ext)) return ext;
    }
    return ".bin";
  }
}
