import 'package:audio_service/audio_service.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'discovery_page.dart';
import 'media_service.dart';

late MediaControlHandler _audioHandler;

Future<void> main() async {
  // Initialize audio_service
  _audioHandler = await AudioService.init(
    builder: () => MediaControlHandler(),
    config: const AudioServiceConfig(
      androidNotificationChannelId: 'com.example.windows_media_controller.channel.audio',
      androidNotificationChannelName: 'Media Playback',
      androidNotificationOngoing: true,
    ),
  );

  runApp(
    Provider<MediaControlHandler>(
      create: (_) => _audioHandler,
      child: const MyApp(),
    ),
  );
}

class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Windows Media Controller',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        brightness: Brightness.dark,
        primarySwatch: Colors.blue,
        useMaterial3: true,
        scaffoldBackgroundColor: const Color(0xFF121212),
        appBarTheme: const AppBarTheme(
          backgroundColor: Colors.transparent,
          elevation: 0,
        ),
      ),
      home: const DiscoveryPage(),
    );
  }
}
