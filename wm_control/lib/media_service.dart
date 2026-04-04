import 'dart:async';
import 'dart:convert';
import 'dart:developer';
import 'dart:io';
import 'package:audio_service/audio_service.dart';
import 'package:path_provider/path_provider.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'media_model.dart';

class MediaControlHandler extends BaseAudioHandler with SeekHandler {
  WebSocketChannel? _channel;
  final StreamController<MediaState> _mediaStateController =
      StreamController<MediaState>.broadcast();
  Stream<MediaState> get mediaStateStream => _mediaStateController.stream;
  MediaState _currentMediaState = MediaState.initial();

  Future<void> connect(String url) async {
    _channel = WebSocketChannel.connect(Uri.parse(url));
    _channel!.stream.listen((message) {
      final decoded = jsonDecode(message);
      if (decoded['type'] == 'UPDATE') {
        _currentMediaState = MediaState.fromJson(decoded['data']);
        _mediaStateController.add(_currentMediaState);
        _updateAudioService();
      }
    }, onDone: () {
      log('WebSocket closed');
    }, onError: (e) {
      log('WebSocket error: $e');
    });
  }

  void disconnect() {
    _channel?.sink.close();
    _channel = null;
  }

  Future<void> _updateAudioService() async {
    Uri? artUri;
    if (_currentMediaState.thumbnail != null) {
      try {
        final tempDir = await getTemporaryDirectory();
        final file = File('${tempDir.path}/album_art.jpg');
        await file.writeAsBytes(_currentMediaState.thumbnail!);
        artUri = Uri.file(file.path);
      } catch (e) {
        log('Error saving album art: $e');
      }
    }

    mediaItem.add(MediaItem(
      id: _currentMediaState.appId,
      album: _currentMediaState.album,
      title: _currentMediaState.title,
      artist: _currentMediaState.artist,
      artUri: artUri,
    ));

    playbackState.add(PlaybackState(
      controls: [
        MediaControl.skipToPrevious,
        _currentMediaState.status == PlaybackStatus.playing
            ? MediaControl.pause
            : MediaControl.play,
        MediaControl.skipToNext,
      ],
      systemActions: const {
        MediaAction.seek,
      },
      playing: _currentMediaState.status == PlaybackStatus.playing,
      processingState: AudioProcessingState.ready,
    ));
  }

  void _sendCommand(String command) {
    if (_channel != null) {
      _channel!.sink.add(jsonEncode({'command': command}));
    }
  }

  @override
  Future<void> play() async => _sendCommand('PLAY');
  @override
  Future<void> pause() async => _sendCommand('PAUSE');
  @override
  Future<void> skipToNext() async => _sendCommand('NEXT');
  @override
  Future<void> skipToPrevious() async => _sendCommand('PREVIOUS');
  @override
  Future<void> stop() async {
    _sendCommand('PAUSE');
    await _channel?.sink.close();
  }

  // Handle Play/Pause toggle
  Future<void> togglePlayPause() async {
    _sendCommand('PLAY_PAUSE');
  }
}
