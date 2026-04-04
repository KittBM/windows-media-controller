import 'dart:developer';

import 'package:flutter/material.dart';
import 'package:nsd/nsd.dart';
import 'package:provider/provider.dart';
import 'media_model.dart';
import 'media_service.dart';

class PlayerPage extends StatefulWidget {
  final Service service;

  const PlayerPage({super.key, required this.service});

  @override
  State<PlayerPage> createState() => _PlayerPageState();
}

class _PlayerPageState extends State<PlayerPage> {
  late MediaControlHandler _handler;

  @override
  void initState() {
    super.initState();
    _handler = Provider.of<MediaControlHandler>(context, listen: false);
    connectToPC();
  }

  Future<void> connectToPC() async {
    var targetHost = widget.service.host ?? '';
    var targetPort = widget.service.port ?? 8080;

    if (widget.service.txt != null) {
      if (widget.service.txt!.containsKey('ip') &&
          widget.service.txt!['ip'] != null) {
        targetHost = String.fromCharCodes(widget.service.txt!['ip']!);
      }
      if (widget.service.txt!.containsKey('port') &&
          widget.service.txt!['port'] != null) {
        targetPort =
            int.tryParse(String.fromCharCodes(widget.service.txt!['port']!)) ??
                targetPort;
      }
    }

    final url = 'ws://$targetHost:$targetPort';
    log('Connecting to $url');
    await _handler.connect(url);
  }

  @override
  void dispose() {
    _handler.disconnect();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF121212), // Dark mode
      appBar: AppBar(
        title: Text(widget.service.name ?? 'Control'),
        backgroundColor: Colors.transparent,
        elevation: 0,
      ),
      body: StreamBuilder<MediaState>(
        stream: _handler.mediaStateStream,
        initialData: MediaState.initial(),
        builder: (context, snapshot) {
          final state = snapshot.data!;
          return Center(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Album Art
                Container(
                  width: 300,
                  height: 300,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.5),
                        blurRadius: 20,
                        spreadRadius: 5,
                      ),
                    ],
                  ),
                  clipBehavior: Clip.antiAlias,
                  child: state.thumbnail != null
                      ? Image.memory(state.thumbnail!, fit: BoxFit.cover)
                      : Container(
                          color: Colors.grey[900],
                          child: const Icon(Icons.music_note,
                              size: 100, color: Colors.white24),
                        ),
                ),
                const SizedBox(height: 40),
                // Metadata
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 40),
                  child: Column(
                    children: [
                      Text(
                        state.title,
                        textAlign: TextAlign.center,
                        style: const TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Colors.white),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: 10),
                      Text(
                        state.artist,
                        textAlign: TextAlign.center,
                        style: TextStyle(
                            fontSize: 18,
                            color: Colors.white.withValues(alpha: 0.7)),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 60),
                // Controls
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    IconButton(
                      iconSize: 48,
                      icon:
                          const Icon(Icons.skip_previous, color: Colors.white),
                      onPressed: () => _handler.skipToPrevious(),
                    ),
                    const SizedBox(width: 20),
                    Container(
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        iconSize: 64,
                        icon: Icon(
                          state.status == PlaybackStatus.playing
                              ? Icons.pause
                              : Icons.play_arrow,
                          color: Colors.black,
                        ),
                        onPressed: () => _handler.togglePlayPause(),
                      ),
                    ),
                    const SizedBox(width: 20),
                    IconButton(
                      iconSize: 48,
                      icon: const Icon(Icons.skip_next, color: Colors.white),
                      onPressed: () => _handler.skipToNext(),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }
}
