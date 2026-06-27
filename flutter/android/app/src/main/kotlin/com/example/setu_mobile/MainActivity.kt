package com.example.setu_mobile

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Exposes Android's native DownloadManager to Dart for the in-app update APK
 * download. DownloadManager runs as a system service independent of the app
 * process, so the download survives the app being minimized or having its
 * background execution throttled by the OS/OEM battery optimizer — unlike a
 * plain Dio request tied to the Flutter engine's isolate, which several
 * Android OEMs (common on site devices) freeze within seconds of the app
 * leaving the foreground.
 */
class MainActivity : FlutterActivity() {
    private val channelName = "com.setu.setu_mobile/download"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "enqueue" -> enqueue(call, result)
                    "query" -> query(call, result)
                    "remove" -> remove(call, result)
                    else -> result.notImplemented()
                }
            }
    }

    private fun enqueue(call: io.flutter.plugin.common.MethodCall, result: MethodChannel.Result) {
        val url = call.argument<String>("url")
        val fileName = call.argument<String>("fileName")
        if (url == null || fileName == null) {
            result.error("BAD_ARGS", "url and fileName are required", null)
            return
        }
        val title = call.argument<String>("title") ?: fileName
        try {
            val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle(title)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                // App-specific external storage — no WRITE_EXTERNAL_STORAGE permission
                // needed, and the file is reachable via a plain filesystem path once done.
                .setDestinationInExternalFilesDir(applicationContext, null, fileName)
                .setAllowedOverMetered(true)
                .setAllowedOverRoaming(true)
            val id = downloadManager.enqueue(request)
            result.success(id)
        } catch (e: Exception) {
            result.error("ENQUEUE_FAILED", e.message, null)
        }
    }

    private fun query(call: io.flutter.plugin.common.MethodCall, result: MethodChannel.Result) {
        val id = (call.argument<Number>("downloadId"))?.toLong()
        if (id == null) {
            result.error("BAD_ARGS", "downloadId is required", null)
            return
        }
        try {
            val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            val cursor = downloadManager.query(DownloadManager.Query().setFilterById(id))
            if (cursor != null && cursor.moveToFirst()) {
                val status = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS))
                val downloaded = cursor.getLong(
                    cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR)
                )
                val total = cursor.getLong(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES))
                val localUri = cursor.getString(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_LOCAL_URI))
                val reason = cursor.getInt(cursor.getColumnIndexOrThrow(DownloadManager.COLUMN_REASON))
                cursor.close()
                result.success(
                    mapOf(
                        "status" to status,
                        "bytesDownloaded" to downloaded,
                        "totalBytes" to total,
                        "localUri" to localUri,
                        "reason" to reason,
                    )
                )
            } else {
                cursor?.close()
                result.success(null)
            }
        } catch (e: Exception) {
            result.error("QUERY_FAILED", e.message, null)
        }
    }

    private fun remove(call: io.flutter.plugin.common.MethodCall, result: MethodChannel.Result) {
        val id = (call.argument<Number>("downloadId"))?.toLong()
        if (id == null) {
            result.error("BAD_ARGS", "downloadId is required", null)
            return
        }
        try {
            val downloadManager = getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
            downloadManager.remove(id)
            result.success(null)
        } catch (e: Exception) {
            result.error("REMOVE_FAILED", e.message, null)
        }
    }
}
