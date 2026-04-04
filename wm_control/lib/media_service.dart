import 'dart:async';
import 'dart:convert';
import 'package:audio_service/audio_service.dart';
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
      print('WebSocket closed');
    }, onError: (e) {
      print('WebSocket error: $e');
    });
  }

  void _updateAudioService() {
    mediaItem.add(MediaItem(
      id: _currentMediaState.appId,
      album: _currentMediaState.album,
      title: _currentMediaState.title,
      artist: _currentMediaState.artist,
      artUri: _currentMediaState.thumbnail != null
          ? Uri.dataFromBytes(_currentMediaState.thumbnail!)
          : null,
    ));

    playbackState.add(PlaybackState(
      controls: [
        MediaControl.skipToPrevious,
        _currentMediaState.status == PlaybackStatus.Playing
            ? MediaControl.pause
            : MediaControl.play,
        MediaControl.skipToNext,
      ],
      systemActions: const {
        MediaAction.seek,
      },
      playing: _currentMediaState.status == PlaybackStatus.Playing,
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
