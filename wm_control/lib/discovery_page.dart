import 'package:flutter/material.dart';
import 'package:nsd/nsd.dart';
import 'player_page.dart';

class DiscoveryPage extends StatefulWidget {
  const DiscoveryPage({super.key});

  @override
  State<DiscoveryPage> createState() => _DiscoveryPageState();
}

class _DiscoveryPageState extends State<DiscoveryPage> {
  final List<Service> _services = [];
  bool _isScanning = false;

  @override
  void initState() {
    super.initState();
    _startDiscovery();
  }

  Future<void> _startDiscovery() async {
    setState(() => _isScanning = true);
    final discovery = await startDiscovery('_winmedia._tcp');
    discovery.addListener(() {
      setState(() {
        _services.clear();
        _services.addAll(discovery.services);
      });
    });
    // Stop after some time
    Future.delayed(const Duration(seconds: 10), () async {
      await stopDiscovery(discovery);
      if (mounted) setState(() => _isScanning = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Connect to PC'),
        actions: [
          if (_isScanning)
            const Padding(
              padding: EdgeInsets.all(16.0),
              child: SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2)),
            )
          else
            IconButton(icon: const Icon(Icons.refresh), onPressed: _startDiscovery),
        ],
      ),
      body: ListView.builder(
        itemCount: _services.length,
        itemBuilder: (context, index) {
          final service = _services[index];
          return ListTile(
            leading: const Icon(Icons.desktop_windows),
            title: Text(service.name ?? 'Unknown PC'),
            subtitle: Text('${service.host}:${service.port}'),
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => PlayerPage(service: service)),
              );
            },
          );
        },
      ),
    );
  }
}
