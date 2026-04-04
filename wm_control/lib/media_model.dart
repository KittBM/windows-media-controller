import 'dart:convert';
import 'dart:typed_data';

enum PlaybackStatus {
  Playing,
  Paused,
  Stopped,
}

class MediaState {
  final String title;
  final String artist;
  final String album;
  final PlaybackStatus status;
  final Uint8List? thumbnail;
  final String appId;

  MediaState({
    required this.title,
    required this.artist,
    required this.album,
    required this.status,
    this.thumbnail,
    required this.appId,
  });

  factory MediaState.fromJson(Map<String, dynamic> json) {
    return MediaState(
      title: json['title'] ?? '',
      artist: json['artist'] ?? '',
      album: json['album'] ?? '',
      status: _parseStatus(json['status']),
      thumbnail: json['thumbnail'] != null && json['thumbnail'].toString().isNotEmpty
          ? base64Decode(json['thumbnail'])
          : null,
      appId: json['appId'] ?? '',
    );
  }

  static PlaybackStatus _parseStatus(String? status) {
    switch (status) {
      case 'Playing':
        return PlaybackStatus.Playing;
      case 'Paused':
        return PlaybackStatus.Paused;
      default:
        return PlaybackStatus.Stopped;
    }
  }

  static MediaState initial() => MediaState(
        title: 'No Media',
        artist: '',
        album: '',
        status: PlaybackStatus.Stopped,
        appId: '',
      );
}
