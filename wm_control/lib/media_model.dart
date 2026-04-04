import 'dart:convert';
import 'dart:typed_data';

enum PlaybackStatus {
  playing,
  paused,
  stopped,
}

class MediaState {
  final String title;
  final String artist;
  final String album;
  final PlaybackStatus status;
  final Uint8List? thumbnail;
  final String appId;
  final Duration position;
  final Duration duration;
  final DateTime lastUpdated;

  MediaState({
    required this.title,
    required this.artist,
    required this.album,
    required this.status,
    this.thumbnail,
    required this.appId,
    required this.position,
    required this.duration,
    required this.lastUpdated,
  });

  factory MediaState.fromJson(Map<String, dynamic> json) {
    return MediaState(
      title: json['title'] ?? '',
      artist: json['artist'] ?? '',
      album: json['album'] ?? '',
      status: _parseStatus(json['status']),
      thumbnail:
          json['thumbnail'] != null && json['thumbnail'].toString().isNotEmpty
              ? base64Decode(json['thumbnail'])
              : null,
      appId: json['appId'] ?? '',
      // Check if position and duration use the same units.
      // Some cases suggest duration might be in seconds while position is in ms.
      position: Duration(milliseconds: (json['position'] ?? 0).toInt()),
      duration: Duration(milliseconds: (json['duration'] ?? 0).toInt()),
      lastUpdated: json['lastUpdatedTime'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['lastUpdatedTime'])
          : DateTime.now(),
    );
  }

  static PlaybackStatus _parseStatus(String? status) {
    switch (status) {
      case 'Playing':
        return PlaybackStatus.playing;
      case 'Paused':
        return PlaybackStatus.paused;
      default:
        return PlaybackStatus.stopped;
    }
  }

  static MediaState initial() => MediaState(
        title: 'No Media',
        artist: '',
        album: '',
        status: PlaybackStatus.stopped,
        appId: '',
        position: Duration.zero,
        duration: Duration.zero,
        lastUpdated: DateTime.now(),
      );
}
